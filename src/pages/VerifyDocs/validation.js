const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isIsoDate = (v) => typeof v === "string" && ISO_DATE_RE.test(v)

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

    return errs
}
