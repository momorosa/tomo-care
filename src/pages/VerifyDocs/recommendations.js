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
    const serverLibrela = doc?.action_recommendations?.librelaReminder || null
    const hasUnclassifiedLibrelaMention = !serverLibrela && looksLikeLibrela(doc)
    const isReceipt = looksLikeReceipt(doc)

    return {
        librelaReminder: serverLibrela
            ? {
                  show: Boolean(serverLibrela.show),
                  disabled: Boolean(serverLibrela.disabled),
                  recommended: Boolean(serverLibrela.recommended),
                  badge: serverLibrela.badge || null,
                  badgeTone: serverLibrela.badge_tone || null,
                  buttonLabel: serverLibrela.button_label || null,
                  body: serverLibrela.body || null,
                  state: serverLibrela.state || null,
              }
            : {
                  show: hasUnclassifiedLibrelaMention,
                  disabled: true,
                  recommended: false,
                  badge: hasUnclassifiedLibrelaMention
                      ? "Review required"
                      : null,
                  badgeTone: "warning",
                  buttonLabel: "Review",
                  body: hasUnclassifiedLibrelaMention
                      ? "TomoCare needs to verify structured Librela administration evidence before creating a reminder."
                      : null,
                  state: hasUnclassifiedLibrelaMention
                      ? "review_required"
                      : "not_applicable",
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