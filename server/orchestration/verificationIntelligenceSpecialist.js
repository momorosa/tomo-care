import {
    SpecialistContractError,
    defineSpecialistContract,
} from "./specialistContract.js"
import {
    getCandidateFingerprint,
    isCurrentVerificationAssessment,
} from "../verification/verificationIntelligence.js"

export const VERIFICATION_INTELLIGENCE_CONTRACT = defineSpecialistContract({
    name: "verification_intelligence",
    version: 1,
    description:
        "Compare one current document candidate with its source, deterministic checks, and bounded trusted history.",
    allowedTruthTiers: [
        "source",
        "candidate",
        "trusted",
        "review_assessment",
    ],
    allowedTools: [
        "load_current_document",
        "load_comparable_history",
        "compare_current_source",
        "build_verification_assessment",
        "persist_review_assessment",
    ],
    // Leave enough room for the source-review tool to stop at its own bounded
    // deadline, build a manual-review assessment, and persist that assessment.
    timeoutMs: 60000,
    validateInput: validateVerificationInput,
    validateOutput: validateVerificationOutput,
})

export const verificationIntelligenceSpecialist = Object.freeze({
    contract: VERIFICATION_INTELLIGENCE_CONTRACT,
    handler: runVerificationIntelligence,
})

export async function runVerificationIntelligence({ input, tools }) {
    try {
        const document = await tools.call("load_current_document", {
            documentId: input.document_id,
        })

        if (!document) {
            throw new SpecialistContractError(
                "The document is no longer available for review.",
                {
                    reason: "stale_evidence",
                    retryable: false,
                }
            )
        }

        validateCurrentDocument(document)

        const currentFingerprint = getCandidateFingerprint(
            document.text_extracted
        )

        if (currentFingerprint !== input.candidate_fingerprint) {
            throw new SpecialistContractError(
                "The document candidate changed before specialist review began.",
                {
                    reason: "stale_evidence",
                    retryable: true,
                }
            )
        }

        if (
            !input.force &&
            isCurrentVerificationAssessment(
                document.triage_result,
                document.text_extracted
            )
        ) {
            return buildVerificationResult({
                document,
                assessment: document.triage_result,
                cached: true,
                historyUnavailable: Boolean(
                    document.triage_result?.history?.unavailable
                ),
            })
        }

        let history = []
        let historyUnavailable = false

        try {
            history = await tools.call("load_comparable_history", {
                document,
            })
        } catch (error) {
            if (
                error instanceof SpecialistContractError &&
                ["permission_denied", "timeout"].includes(error.reason)
            ) {
                throw error
            }
            historyUnavailable = true
        }

        const sourceReview = await tools.call("compare_current_source", {
            document,
        })
        const assessment = await tools.call(
            "build_verification_assessment",
            {
                document,
                history,
                historyUnavailable,
                sourceReview,
            }
        )

        if (
            assessment?.candidate_fingerprint !==
            input.candidate_fingerprint
        ) {
            throw new SpecialistContractError(
                "The verification assessment does not match the current candidate.",
                {
                    reason: "stale_evidence",
                    retryable: true,
                }
            )
        }

        await tools.call("persist_review_assessment", {
            documentId: document.id,
            expectedUpdatedAt: document.updated_at,
            assessment,
        })

        return buildVerificationResult({
            document,
            assessment,
            history,
            cached: false,
            historyUnavailable,
        })
    } catch (error) {
        if (error instanceof SpecialistContractError) throw error

        throw new SpecialistContractError(
            safeToolMessage(error),
            {
                reason: safeToolReason(error),
                retryable: error?.retryable !== false,
            }
        )
    }
}

function buildVerificationResult({
    document,
    assessment,
    history = [],
    cached,
    historyUnavailable,
}) {
    const historyIds = cached
        ? assessment?.history?.document_ids || []
        : history
              .map((record) => record.document?.id || record.id)
              .filter(Boolean)
    const failSafe = assessment?.fail_safe === true

    return {
        result_status: cached
            ? "cached_assessment"
            : failSafe
              ? "manual_review"
              : "assessment_ready",
        assessment,
        cached: Boolean(cached),
        history_unavailable: Boolean(historyUnavailable),
        evidence_ids: [document.id, ...historyIds].slice(0, 6),
        pending_human_decision: "review_verification_assessment",
        human_control_boundary:
            "Rosa must review the assessment before the candidate can become trusted records.",
    }
}

function validateVerificationInput(input) {
    return Boolean(
        input?.schema_version === "verification_intelligence_input_v1" &&
            input?.intent === "review_document" &&
            isNonBlank(input?.document_id) &&
            isNonBlank(input?.candidate_fingerprint) &&
            input?.source_metadata &&
            typeof input.source_metadata === "object" &&
            typeof input.force === "boolean" &&
            !Object.hasOwn(input, "raw_text") &&
            !Object.hasOwn(input, "text_extracted")
    )
}

function validateVerificationOutput(output) {
    const resultStatuses = new Set([
        "assessment_ready",
        "manual_review",
        "cached_assessment",
    ])

    return Boolean(
        output &&
            resultStatuses.has(output.result_status) &&
            output.assessment?.specialist === "verification_intelligence" &&
            output.assessment?.status === "ready" &&
            Array.isArray(output.evidence_ids) &&
            output.evidence_ids.length >= 1 &&
            output.evidence_ids.length <= 6 &&
            isNonBlank(output.pending_human_decision) &&
            isNonBlank(output.human_control_boundary) &&
            !Object.hasOwn(output, "raw_text") &&
            !Object.hasOwn(output, "prompt")
    )
}

function validateCurrentDocument(document) {
    const rawText = String(document.raw_text || "").trim()
    const extracted = document.text_extracted

    if (!rawText || rawText.length < 40) {
        throw new SpecialistContractError(
            "No source text is available for verification review.",
            {
                reason: "malformed_input",
                retryable: false,
            }
        )
    }

    if (
        !extracted ||
        typeof extracted !== "object" ||
        Object.keys(extracted).length === 0
    ) {
        throw new SpecialistContractError(
            "No candidate extraction is available for verification review.",
            {
                reason: "malformed_input",
                retryable: false,
            }
        )
    }
}

function safeToolReason(error) {
    const allowed = new Set([
        "timeout",
        "unavailable",
        "stale_evidence",
        "partial_result",
        "permission_denied",
    ])

    return allowed.has(error?.reason) ? error.reason : "internal_error"
}

function safeToolMessage(error) {
    if (typeof error?.message === "string" && error.message.trim()) {
        return error.message.trim().slice(0, 300)
    }

    return "Verification Intelligence could not complete the review."
}

function isNonBlank(value) {
    return typeof value === "string" && Boolean(value.trim())
}
