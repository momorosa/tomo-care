import { formatDisplayDate as formatCareDate } from "../../lib/displayDate.js"

export function formatDisplayDate(value) {
    return formatCareDate(value, "date pending")
}

export function looksLikeLibrela(doc) {
    const extracted = doc?.text_extracted || {}
    const haystack = [
        doc?.title,
        doc?.doc_type,
        JSON.stringify(extracted),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}
