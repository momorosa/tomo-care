const TIMEOUT_REASONS = new Set(["timeout", "review_timeout"])

export function shouldOfferVerificationRecheck({
    isVerified = false,
    editMode = false,
    hasCandidateData = false,
    recovery = null,
} = {}) {
    return Boolean(
        !isVerified && !editMode && hasCandidateData && !recovery
    )
}

export function getVerificationRecoveryPresentation({
    triageResult = null,
    triageFailure = null,
} = {}) {
    if (triageResult?.fail_safe === true) {
        const reason = triageResult.source_review?.reason || "unavailable"
        const timedOut = TIMEOUT_REASONS.has(reason)

        return {
            mode: "manual_review",
            reason,
            title: timedOut
                ? "AI comparison took too long"
                : "AI comparison could not finish",
            message:
                "The PDF, source text, and extracted fields are saved. Nothing has been approved or added to Momo’s trusted record.",
            nextStep:
                "Retry the AI comparison, or compare each attention item with the PDF and accept it manually.",
            retryable: triageResult.source_review?.retryable !== false,
            manualReviewAvailable: true,
            reviewLaterAvailable: true,
        }
    }

    if (triageFailure) {
        const timedOut = TIMEOUT_REASONS.has(triageFailure.reason)

        return {
            mode: "retry_required",
            reason: triageFailure.reason || "unavailable",
            title: timedOut
                ? "AI review took too long"
                : "AI review could not finish",
            message:
                "The PDF and extracted fields are saved. No review was approved and nothing was added to Momo’s trusted record.",
            nextStep:
                "Retry the review now, or leave it saved and return later.",
            retryable: triageFailure.retryable !== false,
            manualReviewAvailable: false,
            reviewLaterAvailable: true,
        }
    }

    return null
}
