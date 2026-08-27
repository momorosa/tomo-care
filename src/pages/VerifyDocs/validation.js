const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isIsoDate = (v) => typeof v === "string" && ISO_DATE_RE.test(v)
const isRealIsoDate = (value) => {
    if (!isIsoDate(value)) return false
    const [year, month, day] = value.split("-").map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
    )
}

const isNumberLike = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return true
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
        return true
    }
    return false
}

export function validateExtracted(ex) {
    const errs = {}

    if (ex?.invoice_id != null && typeof ex.invoice_id !== "string") {
        errs["invoice_id"] = "Invoice ID must be text."
    }


    if (ex?.source_org != null && typeof ex.source_org !== "string") {
        errs["source_org"] = "Clinic must be text."
    }

    if (ex?.doc_date && !isIsoDate(ex.doc_date)) {
        errs["doc_date"] = "Use YYYY-MM-DD."
    }

    if (ex?.weight_measurement != null) {
        const weight = ex.weight_measurement
        const value = Number(weight.value)

        if (!isNumberLike(weight.value)) {
            errs["weight_measurement.value"] = "Must be a number."
        }
        if (!["kg", "lb"].includes(weight.unit)) {
            errs["weight_measurement.unit"] = "Use kg or lb."
        }
        if (weight.measured_date && !isIsoDate(weight.measured_date)) {
            errs["weight_measurement.measured_date"] = "YYYY-MM-DD."
        }
        if (!weight.measured_date) {
            errs["weight_measurement.measured_date"] = "Required."
        }
        if (
            Number.isFinite(value) &&
            ((weight.unit === "kg" && (value < 8 || value > 25)) ||
                (weight.unit === "lb" && (value < 18 || value > 55)))
        ) {
            errs["weight_measurement.value"] =
                "Outside the supported range for Momo."
        }
    }

    if (Array.isArray(ex?.events)) {
        ex.events.forEach((e, i) => {
            if (!e?.event_type) errs[`events.${i}.event_type`] = "Required."
            if (!e?.event_date) errs[`events.${i}.event_date`] = "Required."
            if (e?.event_date && !isIsoDate(e.event_date)) {
                errs[`events.${i}.event_date`] = "YYYY-MM-DD."
            }

            const desc = e?.details_json?.description
            if (desc != null && typeof desc !== "string") {
                errs[`events.${i}.description`] = "Must be text."
            }
        })
    }

    if (Array.isArray(ex?.cost_items)) {
        ex.cost_items.forEach((ci, i) => {
            if (!ci?.label) errs[`cost_items.${i}.label`] = "Required."
            if (ci?.service_date && !isIsoDate(ci.service_date)) {
                errs[`cost_items.${i}.service_date`] = "YYYY-MM-DD."
            }
            if (!isNumberLike(ci?.amount)) {
                errs[`cost_items.${i}.amount`] = "Must be a number."
            }
            if (!ci?.currency) errs[`cost_items.${i}.currency`] = "Required."
        })
    }

    if (Array.isArray(ex?.vaccine_evidence)) {
        if (ex.vaccine_evidence.length > 1) {
            errs["vaccine_evidence"] =
                "Phase 3E.7a supports one Rabies evidence group per document."
        }
        ex.vaccine_evidence.forEach((candidate, candidateIndex) => {
            const base = `vaccine_evidence.${candidateIndex}`
            if (candidate?.schema_version !== 1) {
                errs[`${base}.schema_version`] = "Schema version must be 1."
            }
            if (candidate?.care_kind !== "vaccine") {
                errs[`${base}.care_kind`] = "Must be vaccine."
            }
            if (candidate?.care_item !== "rabies") {
                errs[`${base}.care_item`] = "This phase supports Rabies only."
            }
            if (
                !["vaccination_certificate", "receipt"].includes(
                    candidate?.source_record_type
                )
            ) {
                errs[`${base}.source_record_type`] = "Select a source type."
            }
            if (!candidate?.assertions?.length) {
                errs[`${base}.assertions`] = "Add at least one source assertion."
            }
            const seen = new Set()
            ;(candidate?.assertions || []).forEach((assertion, index) => {
                const assertionBase = `${base}.assertions.${index}`
                if (seen.has(assertion?.assertion_type)) {
                    errs[`${assertionBase}.assertion_type`] =
                        "Use each assertion type once."
                }
                seen.add(assertion?.assertion_type)
                if (
                    ["administration", "next_due"].includes(
                        assertion?.assertion_type
                    ) &&
                    !isRealIsoDate(assertion?.date)
                ) {
                    errs[`${assertionBase}.date`] = "Use a real YYYY-MM-DD date."
                }
                if (
                    assertion?.assertion_type === "administration" &&
                    candidate.source_record_type !== "vaccination_certificate"
                ) {
                    errs[`${assertionBase}.date`] =
                        "Only an official certificate can verify administration."
                }
            })
            const administration = candidate?.assertions?.find(
                (assertion) => assertion.assertion_type === "administration"
            )
            const nextDue = candidate?.assertions?.find(
                (assertion) => assertion.assertion_type === "next_due"
            )
            if (
                isRealIsoDate(administration?.date) &&
                isRealIsoDate(nextDue?.date) &&
                nextDue.date < administration.date
            ) {
                errs[`${base}.assertions`] =
                    "Clinic-reported next due cannot predate administration."
            }
            const productExpiration =
                candidate?.product_details?.product_expiration_date
            if (productExpiration && !isRealIsoDate(productExpiration)) {
                errs[`${base}.product_expiration_date`] =
                    "Use a real YYYY-MM-DD product date."
            }
        })
    }

    return errs
}
