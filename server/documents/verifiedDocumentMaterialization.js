import { canonicalizeVerifiedLibrelaEvents } from "../lib/librelaEvidence.js"
import { getVerifiedWeightCandidate } from "../lib/verifiedWeight.js"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function firstValidDate(...values) {
    return (
        values.find(
            (value) => typeof value === "string" && DATE_RE.test(value)
        ) || null
    )
}

function normalizeEventDetails(eventType, details, { verifiedAt, verifiedBy }) {
    const normalized =
        details && typeof details === "object" ? { ...details } : {}
    const description = String(normalized.description || "").toLowerCase()

    if (eventType === "injection" && description.includes("librela")) {
        normalized.subtype = "Librela"
    }

    normalized.verified_at = verifiedAt
    normalized.verified_by = verifiedBy

    return normalized
}

export function buildVerifiedDocumentMaterialization({
    document,
    extracted = document?.text_extracted,
    verifiedBy = "rosa",
    verifiedAt = new Date().toISOString(),
    notes = "",
} = {}) {
    if (!document?.id || !document?.pet_id) {
        throw new Error("A source document and pet are required.")
    }

    if (
        !extracted ||
        typeof extracted !== "object" ||
        Object.keys(extracted).length === 0
    ) {
        throw new Error("No text_extracted found for this document.")
    }

    const approvedDocDate = firstValidDate(
        extracted.doc_date,
        extracted.events?.[0]?.event_date,
        extracted.cost_items?.[0]?.service_date,
        document.doc_date
    )

    const verifiedDocument = {
        ...document,
        status: "verified",
        doc_date: approvedDocDate || document.doc_date,
        text_extracted: extracted,
    }

    const canonicalized = canonicalizeVerifiedLibrelaEvents({
        document: verifiedDocument,
        events: Array.isArray(extracted.events) ? extracted.events : [],
    })

    const events = canonicalized.events
        .filter(
            (event) =>
                event &&
                typeof event === "object" &&
                event.event_type &&
                event.event_date
        )
        .map((event) => ({
            pet_id: document.pet_id,
            doc_id: document.id,
            event_type: event.event_type,
            event_date: event.event_date,
            status: "verified",
            details_json: normalizeEventDetails(
                event.event_type,
                event.details_json,
                { verifiedAt, verifiedBy }
            ),
        }))

    const costItems = Array.isArray(extracted.cost_items)
        ? extracted.cost_items
              .filter(
                  (item) =>
                      item &&
                      typeof item === "object" &&
                      (item.label || item.amount != null)
              )
              .map((item) => ({
                  pet_id: document.pet_id,
                  doc_id: document.id,
                  service_date:
                      item.service_date ||
                      extracted.doc_date ||
                      approvedDocDate ||
                      document.doc_date,
                  category: item.category || "other",
                  item_name: item.label || "Unknown item",
                  quantity: null,
                  unit: null,
                  amount: item.amount ?? 0,
                  currency: item.currency || "USD",
                  tax_amount: 0,
                  status: "verified",
                  confidence: extracted.confidence ?? null,
                  verified_at: verifiedAt,
                  verified_by: verifiedBy,
              }))
        : []

    const documentUpdate = {
        status: "verified",
        remarks: notes,
    }

    if (approvedDocDate) {
        documentUpdate.doc_date = approvedDocDate
    }

    return {
        approvedDocDate,
        documentUpdate,
        verifiedDocument,
        canonicalization: canonicalized,
        events,
        costItems,
        labs: [],
        weightMeasurement: getVerifiedWeightCandidate(verifiedDocument, {
            allowRawText: false,
        }),
    }
}
