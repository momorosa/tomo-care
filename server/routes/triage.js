import express from "express"
import process from "node:process"

import { sbAdmin } from "../supabase.js"
import {
    buildVerificationAssessment,
    enumerateVerificationFields,
    isCurrentVerificationAssessment,
} from "../verification/verificationIntelligence.js"
import { loadComparableVerificationHistory } from "../verification/verificationHistoryRepository.js"
import {
    buildSourceReviewFailSafe,
    buildSourceReviewSystemPrompt,
    buildSourceReviewUserPrompt,
    parseSourceReview,
} from "../verification/sourceReviewContract.js"

const router = express.Router()

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TRIAGE_MODEL = process.env.TRIAGE_MODEL || "claude-sonnet-4-6"

// POST /api/documents/:docId/triage
// Runs the read-only Verification Intelligence specialist. The model compares
// candidate fields with the current source; deterministic code owns history,
// arithmetic, date consistency, weight comparison, and the final outcomes.
router.post("/documents/:docId/triage", async (req, res) => {
    const { docId } = req.params
    const { force = false } = req.body || {}

    try {
        const { data: document, error } = await sbAdmin
            .from("documents")
            .select(
                "id, pet_id, raw_text, text_extracted, triage_result, doc_type, doc_date, source_org, title, status, updated_at"
            )
            .eq("id", docId)
            .single()

        if (error || !document) {
            return res
                .status(404)
                .json({ error: error?.message || "Document not found" })
        }

        const rawText = String(document.raw_text || "").trim()
        const extracted = document.text_extracted

        if (!rawText || rawText.length < 40) {
            return res.status(400).json({
                error: "No raw_text available for verification review.",
            })
        }

        if (
            !extracted ||
            typeof extracted !== "object" ||
            Object.keys(extracted).length === 0
        ) {
            return res.status(400).json({
                error: "No text_extracted available for verification review.",
            })
        }

        if (
            !force &&
            isCurrentVerificationAssessment(
                document.triage_result,
                extracted
            )
        ) {
            return res.json({
                ok: true,
                cached: true,
                triage_result: document.triage_result,
            })
        }

        let history = []
        let historyUnavailable = false

        try {
            history = await loadComparableVerificationHistory({
                document,
                client: sbAdmin,
                limit: 5,
            })
        } catch (historyError) {
            historyUnavailable = true
            console.error(
                "[verification-intelligence] history error:",
                historyError
            )
        }

        const sourceReview = await runSourceReview({
            rawText,
            extracted,
            document,
        })

        const assessment = buildVerificationAssessment({
            rawText,
            extracted,
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

        const { error: updateError } = await sbAdmin
            .from("documents")
            .update({ triage_result: assessment })
            .eq("id", docId)

        if (updateError) {
            return res.status(500).json({ error: updateError.message })
        }

        return res.json({
            ok: true,
            cached: false,
            triage_result: assessment,
        })
    } catch (error) {
        console.error("[verification-intelligence] error:", error)
        return res.status(500).json({
            error: error?.message || "Verification review failed",
        })
    }
})

export async function runSourceReview({ rawText, extracted, document }) {
    const fields = enumerateVerificationFields(extracted)

    if (!ANTHROPIC_API_KEY) {
        console.warn(
            "[verification-intelligence] No ANTHROPIC_API_KEY; requiring manual source review"
        )
        return buildSourceReviewFailSafe(
            fields,
            "Source reviewer is unavailable",
            TRIAGE_MODEL
        )
    }

    if (!fields.length) {
        return {
            model: TRIAGE_MODEL,
            failed: false,
            fields: [],
            notes: "No candidate fields were available for source comparison.",
        }
    }

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: TRIAGE_MODEL,
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
            const errorBody = await response.text()
            console.error(
                "[verification-intelligence] source API error:",
                response.status,
                errorBody
            )
            return buildSourceReviewFailSafe(
                fields,
                `Source reviewer returned ${response.status}`,
                TRIAGE_MODEL
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
                TRIAGE_MODEL
            )
        }

        return {
            model: TRIAGE_MODEL,
            failed: false,
            fields: parsed.fields,
            notes: parsed.notes || null,
        }
    } catch (error) {
        console.error("[verification-intelligence] source fetch error:", error)
        return buildSourceReviewFailSafe(fields, error.message, TRIAGE_MODEL)
    }
}

export default router
