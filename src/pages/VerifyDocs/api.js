import { EMPTY_COUNTS } from "./constants.js"

const JSON_HEADERS = { "Content-Type": "application/json" }

async function jsonOrThrow(res, fallbackMessage) {
    const j = await res.json()
    if (!res.ok || j.error) throw new Error(j.error || fallbackMessage)
    return j
}

export async function fetchDocumentList(petId) {
    const r = await fetch(`/api/pets/${petId}/documents?status=all&limit=50`)
    const j = await jsonOrThrow(r, "Failed to fetch documents")

    return j.documents || j.data || []
}

export async function fetchDocument(id) {
    const d = await fetch(`/api/documents/${id}`).then((r) => r.json())
    if (d?.error) throw new Error(d.error)

    return { doc: d.doc || d, counts: d.counts || EMPTY_COUNTS }
}

export async function fetchViewUrl(id) {
    const u = await fetch(`/api/documents/${id}/view-url`).then((r) => r.json())
    if (u?.error) throw new Error(u.error)

    return u.url
}

export async function runTriage(id, { force = false } = {}) {
    const r = await fetch(`/api/documents/${id}/triage`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ force }),
    })

    return jsonOrThrow(r, "Triage failed")
}

export async function approveDocument(id, { verifiedBy = "rosa", notes = "" } = {}) {
    const r = await fetch(`/api/documents/${id}/approve`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ verifiedBy, notes }),
    })

    return jsonOrThrow(r, "Approve failed")
}

export async function patchExtracted(id, textExtracted, status = "needs_review") {
    const r = await fetch(`/api/documents/${id}/text-extracted`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ text_extracted: textExtracted, status }),
    })

    return jsonOrThrow(r, "Save failed")
}

export async function createLibrelaReminder(id, { requestedBy = "rosa" } = {}) {
    const r = await fetch(`/api/documents/${id}/actions/librela-reminder`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ requestedBy }),
    })

    return jsonOrThrow(r, "Failed to create Librela reminder")
}

export async function createInsuranceClaimReminder(
    id,
    { requestedBy = "rosa", insuranceProvider = "Nationwide" } = {}
) {
    const r = await fetch(
        `/api/documents/${id}/actions/insurance-claim-reminder`,
        {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ requestedBy, insuranceProvider }),
        }
    )

    return jsonOrThrow(r, "Failed to create insurance claim reminder")
}

export async function syncReminderToGoogleCalendar(eventId) {
    const r = await fetch(
        `/api/events/${eventId}/actions/sync-google-calendar`,
        {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({}),
        }
    )

    const j = await r.json()

    // This is not a system failure. It means TomoCare correctly refused
    // to sync something stale or ineligible.
    if (r.status === 409 && j.reason === "timing_state_not_eligible") {
        return {
            ...j,
            blocked: true,
        }
    }

    if (!r.ok || j.error) {
        throw new Error(j.error || "Failed to sync reminder to Google Calendar")
    }

    return j
}
