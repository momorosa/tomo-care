export const VERIFICATION_INTELLIGENCE_SCHEMA_VERSION =
    "verification_intelligence_v1"

export function isLegacyVerificationReview({
    triageResult,
    isVerified = false,
} = {}) {
    return Boolean(
        isVerified &&
            Array.isArray(triageResult?.fields) &&
            triageResult.fields.length > 0 &&
            triageResult.schema_version !==
                VERIFICATION_INTELLIGENCE_SCHEMA_VERSION
    )
}

export function getTriageReviewState({
    triageResult,
    acceptedPaths = new Set(),
    isVerified = false,
} = {}) {
    const fields = Array.isArray(triageResult?.fields)
        ? triageResult.fields
        : []
    const accepted =
        acceptedPaths instanceof Set
            ? acceptedPaths
            : new Set(acceptedPaths || [])
    const flaggedFields = fields.filter(
        (field) =>
            field.blocks_approval === true ||
            field.outcome === "changed_from_pattern" ||
            field.outcome === "conflict_or_uncertainty" ||
            field.outcome === "manual_review" ||
            field.state === "needs-confirmation" ||
            field.state === "unreadable-source"
    )
    const unresolvedPaths = isVerified
        ? []
        : flaggedFields
              .filter((field) => !accepted.has(field.path))
              .map((field) => field.path)
    const failSafe =
        triageResult?.fail_safe === true ||
        (triageResult &&
            triageResult.overall_confidence === "low" &&
            fields.length === 0)
    const currentAssessment = triageResult?.schema_version
        ? triageResult.status === "ready"
        : fields.length > 0

    return {
        flaggedTotal: flaggedFields.length,
        flaggedResolved: isVerified
            ? flaggedFields.length
            : flaggedFields.length - unresolvedPaths.length,
        unresolvedPaths,
        unreviewedCount: unresolvedPaths.length,
        hasTriage: fields.length > 0,
        currentAssessment,
        failSafe,
        blocksApprove:
            !isVerified &&
            (!currentAssessment || unresolvedPaths.length > 0),
    }
}
