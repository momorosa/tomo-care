const JSON_HEADERS = { "Content-Type": "application/json" }

async function jsonOrThrow(response, fallbackMessage) {
    const data = await response.json()

    if (!response.ok || data.error) {
        const error = new Error(data.error || fallbackMessage)
        error.status = response.status
        error.reason = data.reason || null
        error.recovery = data.recovery || null
        error.retryable = Boolean(data.retryable)
        error.outcomeUnknown = Boolean(data.outcome_unknown)
        throw error
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

export async function fetchCareSummary(petId) {
    const response = await fetch(`/api/pets/${petId}/care-summary`)
    const data = await jsonOrThrow(response, "Could not load care summary")

    return data.summary || {}
}

export async function prepareHomeMedicationGiven({
    petId,
    reminderId,
    administeredDate,
    requestedBy,
}) {
    const response = await fetch(
        `/api/pets/${petId}/actions/home-medication-given/prepare`,
        {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
                reminderId,
                administeredDate,
                requestedBy,
            }),
        }
    )

    return jsonOrThrow(response, "Could not prepare the medication update")
}

export async function fetchCareAction(actionId) {
    const response = await fetch(`/api/care-actions/${actionId}`)
    return jsonOrThrow(response, "Could not recover the care action")
}

export async function approveCareAction(actionId, approvedBy) {
    const response = await fetch(`/api/care-actions/${actionId}/approve`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ approvedBy }),
    })

    return jsonOrThrow(response, "Could not approve the care action")
}

export async function executeCareAction(actionId) {
    const response = await fetch(`/api/care-actions/${actionId}/execute`, {
        method: "POST",
        headers: JSON_HEADERS,
    })

    return jsonOrThrow(response, "Could not complete the care action")
}

export async function cancelCareAction(actionId) {
    const response = await fetch(`/api/care-actions/${actionId}/cancel`, {
        method: "POST",
        headers: JSON_HEADERS,
    })

    return jsonOrThrow(response, "Could not cancel the care action")
}

export async function askAssistant(petId, question) {
    const response = await fetch(`/api/pets/${petId}/assistant/query`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
    })

    const data = await jsonOrThrow(response, "Could not ask TomoCare")
    return data
}

export async function fetchDocumentSourceUrl(docId) {
    const response = await fetch(`/api/documents/${docId}/source-url`)

    return jsonOrThrow(response, "Could not open source PDF")
}
