import { looksLikeLibrela } from "./utils.js"

function asSearchText(value) {
    return JSON.stringify(value || {})
        .toLowerCase()
        .replace(/\s+/g, " ")
}

function hasCostItems(doc) {
    const extracted = doc?.text_extracted || {}

    return (
        Array.isArray(extracted.cost_items) &&
        extracted.cost_items.length > 0
    )
}

function looksLikeReceipt(doc) {
    const extracted = doc?.text_extracted || {}

    const text = asSearchText({
        title: doc?.title,
        doc_type: doc?.doc_type,
        source_org: doc?.source_org,
        extracted,
    })

    return (
        doc?.doc_type === "receipt" ||
        doc?.doc_type === "invoice" ||
        text.includes("receipt") ||
        text.includes("invoice") ||
        hasCostItems(doc)
    )
}

export function getPostVerifyRecommendations(doc) {
    const isLibrela = looksLikeLibrela(doc)
    const isReceipt = looksLikeReceipt(doc)

    return {
        librelaReminder: {
            show: isLibrela,
            disabled: !isLibrela,
            recommended: isLibrela,
            badge: isLibrela ? "Recommended" : null,
        },

        insuranceClaimReminder: {
            show: isReceipt,
            disabled: !isReceipt,
            recommended: isReceipt,
            badge: isReceipt ? "Recommended" : null,
        },

        appointmentDraft: {
            show: true,
            disabled: true,
            recommended: false,
            badge: "Coming next",
        },
    }
}