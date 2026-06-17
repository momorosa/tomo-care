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

export function formatDisplayDate(value) {
    if (!value) return "date pending"

    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}
