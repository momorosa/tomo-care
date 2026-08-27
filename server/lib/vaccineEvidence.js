const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const VACCINE_EVIDENCE_SCHEMA_VERSION = 1
export const RABIES_CARE_ITEM = "rabies"

const SOURCE_RECORD_TYPES = new Set([
    "vaccination_certificate",
    "receipt",
])
const ASSERTION_TYPES = new Set([
    "administration",
    "next_due",
    "clinic_reported_status",
])
const CLINIC_STATUSES = new Set(["current", "due", "overdue", "unknown"])

export function isRealIsoDate(value) {
    if (typeof value !== "string" || !DATE_RE.test(value)) return false

    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}

export function getVaccineAssertion(candidate, assertionType) {
    return (candidate?.assertions || []).find(
        (assertion) => assertion?.assertion_type === assertionType
    ) || null
}

export function validateVaccineEvidenceCandidate(candidate) {
    const errors = []

    if (!candidate || typeof candidate !== "object") {
        return { ok: false, errors: ["Vaccine evidence must be an object."] }
    }

    if (candidate.schema_version !== VACCINE_EVIDENCE_SCHEMA_VERSION) {
        errors.push("Vaccine evidence schema_version must be 1.")
    }
    if (candidate.care_kind !== "vaccine") {
        errors.push("care_kind must be vaccine.")
    }
    if (candidate.care_item !== RABIES_CARE_ITEM) {
        errors.push("Phase 3E.7a only supports rabies evidence.")
    }
    if (!SOURCE_RECORD_TYPES.has(candidate.source_record_type)) {
        errors.push("Source record type must be vaccination_certificate or receipt.")
    }

    const assertions = Array.isArray(candidate.assertions)
        ? candidate.assertions
        : []
    if (!assertions.length) {
        errors.push("At least one source assertion is required.")
    }

    const seenTypes = new Set()
    for (const assertion of assertions) {
        const type = assertion?.assertion_type
        if (!ASSERTION_TYPES.has(type)) {
            errors.push("Assertion type is not supported.")
            continue
        }
        if (seenTypes.has(type)) {
            errors.push(`Only one ${type} assertion is allowed per document.`)
        }
        seenTypes.add(type)

        if (type === "administration") {
            if (!isRealIsoDate(assertion.date)) {
                errors.push("Administration date must be a real YYYY-MM-DD date.")
            }
            if (assertion.date_meaning !== "administered_on") {
                errors.push("Administration date_meaning must be administered_on.")
            }
        }

        if (type === "next_due") {
            if (!isRealIsoDate(assertion.date)) {
                errors.push("Next-due date must be a real YYYY-MM-DD date.")
            }
            if (assertion.date_meaning !== "clinic_reported_next_due") {
                errors.push(
                    "Next-due date_meaning must be clinic_reported_next_due."
                )
            }
        }

        if (type === "clinic_reported_status") {
            if (!CLINIC_STATUSES.has(assertion.status)) {
                errors.push("Clinic-reported status is not supported.")
            }
            if (
                assertion.as_of_date != null &&
                !isRealIsoDate(assertion.as_of_date)
            ) {
                errors.push("Clinic-reported status date must be a real YYYY-MM-DD date.")
            }
        }

        if (
            assertion.source_context != null &&
            typeof assertion.source_context !== "string"
        ) {
            errors.push("Assertion source context must be text.")
        }
    }

    const administration = getVaccineAssertion(candidate, "administration")
    const nextDue = getVaccineAssertion(candidate, "next_due")
    if (
        isRealIsoDate(administration?.date) &&
        isRealIsoDate(nextDue?.date) &&
        nextDue.date < administration.date
    ) {
        errors.push("Clinic-reported next due cannot predate administration.")
    }

    if (
        candidate.source_record_type === "receipt" &&
        seenTypes.has("administration")
    ) {
        errors.push(
            "A receipt candidate cannot establish verified administration in Phase 3E.7a."
        )
    }

    const product = candidate.product_details
    if (product != null && typeof product !== "object") {
        errors.push("Product details must be an object.")
    } else if (
        product?.product_expiration_date != null &&
        !isRealIsoDate(product.product_expiration_date)
    ) {
        errors.push("Product expiration must be a real YYYY-MM-DD date.")
    }

    return { ok: errors.length === 0, errors }
}

export function getVerifiedRabiesEvidence(extracted = {}) {
    const candidates = Array.isArray(extracted.vaccine_evidence)
        ? extracted.vaccine_evidence
        : []

    return candidates.filter((candidate) => {
        const validation = validateVaccineEvidenceCandidate(candidate)
        return validation.ok && candidate.care_item === RABIES_CARE_ITEM
    })
}

export function summarizeVaccineEvidence(candidate) {
    const administration = getVaccineAssertion(candidate, "administration")
    const nextDue = getVaccineAssertion(candidate, "next_due")
    const clinicStatus = getVaccineAssertion(
        candidate,
        "clinic_reported_status"
    )

    return {
        care_item: candidate?.care_item || null,
        source_record_type: candidate?.source_record_type || null,
        administered_on: administration?.date || null,
        clinic_reported_next_due: nextDue?.date || null,
        clinic_reported_status: clinicStatus?.status || null,
        product_expiration_date:
            candidate?.product_details?.product_expiration_date || null,
    }
}
