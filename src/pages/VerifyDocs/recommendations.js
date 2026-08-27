import { looksLikeLibrela } from "./utils.js"

function hasCostItems(doc) {
    const extracted = doc?.text_extracted || {}

    return (
        Array.isArray(extracted.cost_items) &&
        extracted.cost_items.length > 0
    )
}

function looksLikeReceipt(doc) {
    const extracted = doc?.text_extracted || {}

    if (doc?.doc_type === "vaccination_certificate") return false

    return (
        doc?.doc_type === "receipt" ||
        doc?.doc_type === "invoice" ||
        Boolean(extracted.invoice_id) ||
        hasCostItems(doc)
    )
}

export function getPostVerifyRecommendations(doc) {
    const serverLibrela = doc?.action_recommendations?.librelaReminder || null
    const serverWeight =
        doc?.action_recommendations?.weightMaterialization || null
    const hasUnclassifiedLibrelaMention = !serverLibrela && looksLikeLibrela(doc)
    const isReceipt = looksLikeReceipt(doc)

    return {
        weightMaterialization: serverWeight
            ? {
                  show: Boolean(serverWeight.show),
                  disabled: Boolean(serverWeight.disabled),
                  badge: serverWeight.badge || null,
                  badgeTone: serverWeight.badge_tone || null,
                  buttonLabel: serverWeight.button_label || null,
                  body: serverWeight.body || null,
                  state: serverWeight.state || null,
              }
            : {
                  show: false,
                  disabled: true,
                  badge: null,
                  badgeTone: null,
                  buttonLabel: null,
                  body: null,
                  state: "not_applicable",
              },

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
