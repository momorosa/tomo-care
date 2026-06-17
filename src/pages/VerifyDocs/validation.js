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
