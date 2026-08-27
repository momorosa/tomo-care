export function buildVaccineEvidencePresentation(candidate = {}) {
    const assertions = Array.isArray(candidate.assertions)
        ? candidate.assertions
        : []
    const find = (type) =>
        assertions.find((item) => item?.assertion_type === type) || null

    return {
        careItem: candidate.care_item || "rabies",
        sourceType: candidate.source_record_type || null,
        administration: find("administration"),
        nextDue: find("next_due"),
        clinicStatus: find("clinic_reported_status"),
        product: candidate.product_details || {},
    }
}

export function updateVaccineAssertion(candidate, type, patch) {
    const next = structuredClone(candidate || {})
    next.assertions = Array.isArray(next.assertions) ? next.assertions : []
    const index = next.assertions.findIndex(
        (item) => item?.assertion_type === type
    )

    if (patch === null) {
        next.assertions = next.assertions.filter(
            (item) => item?.assertion_type !== type
        )
        return next
    }

    const value = {
        ...(index >= 0 ? next.assertions[index] : {}),
        assertion_type: type,
        ...patch,
    }
    if (index >= 0) next.assertions[index] = value
    else next.assertions.push(value)

    return next
}
