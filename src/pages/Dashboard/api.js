const JSON_HEADERS = { "Content-Type": "application/json" }

async function jsonOrThrow(response, fallbackMessage) {
    const data = await response.json()

    if (!response.ok || data.error) {
        throw new Error(data.error || fallbackMessage)
    }

    return data
}

export async function fetchPendingReviewDocuments(petId) {
    const response = await fetch(
        `/api/pets/${petId}/documents?status=needs_review&limit=10`
    )

    const data = await jsonOrThrow(
        response,
        "Could not load pending review documents"
    )

    return data.documents || []
}

export async function checkInboxForDocuments() {
    const response = await fetch("/api/gmail/check-inbox", {
        method: "POST",
        headers: JSON_HEADERS,
    })

    return jsonOrThrow(response, "Inbox check failed")
}

export async function fetchReminders(petId) {
    const response = await fetch(`/api/pets/${petId}/reminders`)

    const data = await jsonOrThrow(response, "Could not load reminders")

    return data.reminders || []
}

export async function fetchVerifiedDocuments(petId) {
    const response = await fetch(
        `/api/pets/${petId}/documents?status=verified&limit=10`
    )

    const data = await jsonOrThrow(
        response,
        "Could not load verified documents"
    )

    return data.documents || []
}