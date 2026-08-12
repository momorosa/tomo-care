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

    return {
        flaggedTotal: flaggedFields.length,
        flaggedResolved: isVerified
            ? flaggedFields.length
            : flaggedFields.length - unresolvedPaths.length,
        unresolvedPaths,
        unreviewedCount: unresolvedPaths.length,
        hasTriage: fields.length > 0,
        failSafe,
        blocksApprove:
            !isVerified &&
            fields.length > 0 &&
            !failSafe &&
            unresolvedPaths.length > 0,
    }
}
