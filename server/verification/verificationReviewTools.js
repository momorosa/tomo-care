import process from "node:process"

import {
    buildVerificationAssessment,
    enumerateVerificationFields,
} from "./verificationIntelligence.js"
import { loadComparableVerificationHistory } from "./verificationHistoryRepository.js"
import {
    buildSourceReviewFailSafe,
    buildSourceReviewSystemPrompt,
    buildSourceReviewUserPrompt,
    parseSourceReview,
} from "./sourceReviewContract.js"

const DOCUMENT_COLUMNS = [
    "id",
    "pet_id",
    "raw_text",
    "text_extracted",
    "triage_result",
    "doc_type",
    "doc_date",
    "source_org",
    "title",
    "status",
    "updated_at",
].join(", ")

export const SOURCE_REVIEW_TIMEOUT_MS = 45000

export class VerificationReviewToolError extends Error {
    constructor(message, { reason = "internal_error", retryable = true } = {}) {
        super(message)
        this.name = "VerificationReviewToolError"
        this.reason = reason
        this.retryable = Boolean(retryable)
    }
}

export function createVerificationReviewTools({
    client = null,
    sourceReviewer = runSourceReview,
} = {}) {
    return Object.freeze({
        async load_current_document({ documentId }) {
            const database = await resolveClient(client)
            const { data, error } = await database
                .from("documents")
                .select(DOCUMENT_COLUMNS)
                .eq("id", documentId)
                .maybeSingle()

            if (error) {
                throw new VerificationReviewToolError(
                    "The current document could not be loaded.",
                    {
                        reason: "unavailable",
                        retryable: true,
                    }
                )
            }

            return data || null
        },

        async load_comparable_history({ document }) {
            const database = await resolveClient(client)
            return loadComparableVerificationHistory({
                document,
                client: database,
                limit: 5,
            })
        },

        async compare_current_source({ document }, { signal } = {}) {
            return sourceReviewer({
                rawText: String(document.raw_text || "").trim(),
                extracted: document.text_extracted,
                document,
                signal,
            })
        },

        async build_verification_assessment({
            document,
            history,
            historyUnavailable,
            sourceReview,
        }) {
            const assessment = buildVerificationAssessment({
                rawText: String(document.raw_text || "").trim(),
                extracted: document.text_extracted,
                document,
                history,
                sourceReview,
                sourceReviewFailed: sourceReview.failed,
                correctionHistory:
                    document.triage_result?.correction_history || [],
                model: sourceReview.model,
            })

            if (historyUnavailable) {
                assessment.history.unavailable = true
                assessment.notes = `${assessment.notes} Recent trusted history was unavailable, so no historical pattern was assumed.`
            }

            return assessment
        },

        async persist_review_assessment({
            documentId,
            expectedUpdatedAt,
            assessment,
        }) {
            const database = await resolveClient(client)
            const { data, error } = await database
                .from("documents")
                .update({ triage_result: assessment })
                .eq("id", documentId)
                .eq("updated_at", expectedUpdatedAt)
                .select("id, updated_at")
                .maybeSingle()

            if (error) {
                throw new VerificationReviewToolError(
                    "The verification assessment could not be saved.",
                    {
                        reason: "unavailable",
                        retryable: true,
                    }
                )
            }

            if (!data) {
                throw new VerificationReviewToolError(
                    "The document changed while Verification Intelligence was reviewing it.",
                    {
                        reason: "stale_evidence",
                        retryable: true,
                    }
                )
            }

            return data
        },
    })
}

async function resolveClient(client) {
    if (client) return client
    return (await import("../supabase.js")).sbAdmin
}

export async function runSourceReview({
    rawText,
    extracted,
    document,
    signal,
    timeoutMs = SOURCE_REVIEW_TIMEOUT_MS,
    fetchImpl = fetch,
    now = () => Date.now(),
}) {
    const fields = enumerateVerificationFields(extracted)
    const apiKey = process.env.ANTHROPIC_API_KEY
    const model = process.env.TRIAGE_MODEL || "claude-sonnet-4-6"

    if (!apiKey) {
        console.warn(
            "[verification-intelligence] No ANTHROPIC_API_KEY; requiring manual source review"
        )
        return buildSourceReviewFailSafe(
            fields,
            "Source reviewer is unavailable",
            model,
            {
                reasonCode: "not_configured",
                retryable: false,
            }
        )
    }

    if (!fields.length) {
        return {
            model,
            failed: false,
            fields: [],
            notes: "No candidate fields were available for source comparison.",
        }
    }

    const controller = new AbortController()
    const startedAt = now()
    let sourceTimedOut = false
    let timeoutId = null
    const abortFromSpecialist = () => controller.abort()

    if (signal?.aborted) {
        throw new VerificationReviewToolError(
            "Source comparison timed out.",
            {
                reason: "timeout",
                retryable: true,
            }
        )
    }

    signal?.addEventListener("abort", abortFromSpecialist, { once: true })
    timeoutId = setTimeout(() => {
        sourceTimedOut = true
        controller.abort()
    }, timeoutMs)

    try {
        const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: buildSourceReviewSystemPrompt(),
                messages: [
                    {
                        role: "user",
                        content: buildSourceReviewUserPrompt({
                            rawText,
                            extracted,
                            fields,
                            document,
                        }),
                    },
                ],
            }),
        })

        if (!response.ok) {
            console.error(
                "[verification-intelligence] source API error:",
                response.status
            )
            return buildSourceReviewFailSafe(
                fields,
                `Source reviewer returned ${response.status}`,
                model,
                {
                    reasonCode: "provider_error",
                    retryable: response.status >= 500 || response.status === 429,
                    elapsedMs: now() - startedAt,
                }
            )
        }

        const data = await response.json()
        const text = (data.content || [])
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("")
        const parsed = parseSourceReview(text, fields)

        if (!parsed) {
            return buildSourceReviewFailSafe(
                fields,
                "Source reviewer returned an invalid response",
                model,
                {
                    reasonCode: "malformed_result",
                    retryable: true,
                    elapsedMs: now() - startedAt,
                }
            )
        }

        return {
            model,
            failed: false,
            fields: parsed.fields,
            notes: parsed.notes || null,
        }
    } catch (error) {
        if (sourceTimedOut) {
            return buildSourceReviewFailSafe(
                fields,
                "AI comparison took too long; compare this field with the PDF.",
                model,
                {
                    reasonCode: "timeout",
                    retryable: true,
                    elapsedMs: now() - startedAt,
                }
            )
        }

        if (signal?.aborted) {
            throw new VerificationReviewToolError(
                "Source comparison timed out.",
                {
                    reason: "timeout",
                    retryable: true,
                }
            )
        }

        console.error(
            "[verification-intelligence] source fetch error:",
            error?.name || "request_failed"
        )
        return buildSourceReviewFailSafe(
            fields,
            "Source reviewer is unavailable",
            model,
            {
                reasonCode: "unavailable",
                retryable: true,
                elapsedMs: now() - startedAt,
            }
        )
    } finally {
        if (timeoutId) clearTimeout(timeoutId)
        signal?.removeEventListener("abort", abortFromSpecialist)
    }
}
