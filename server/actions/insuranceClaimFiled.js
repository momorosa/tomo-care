import { addDaysToIsoDate, getCareDate } from "../lib/careDates.js"

export const MARK_INSURANCE_CLAIM_FILED = "mark_insurance_claim_filed"

const INSURANCE_CLAIM_SUBTYPE = "Insurance claim"
const ALLOWED_REQUEST_SOURCES = new Set([
    "dashboard",
    "assistant",
    "system",
])

export function buildMarkInsuranceClaimFiledProposal({
    petId,
    reminder,
    sourceDocument,
    filedDate,
    requestSource,
    requestedBy,
    currentCareDate = getCareDate(),
}) {
    assertNonBlank(petId, "petId")
    assertNonBlank(requestedBy, "requestedBy")

    if (!ALLOWED_REQUEST_SOURCES.has(requestSource)) {
        throw new Error(`Unsupported request source: ${requestSource}`)
    }

    const details = validateInsuranceClaimReminder({ petId, reminder })
    validateVerifiedSourceDocument({
        petId,
        reminder,
        sourceDocument,
        treatmentDate: details.treatment_date,
    })

    const normalizedFiledDate = validateFiledDate({
        filedDate,
        currentCareDate,
        treatmentDate: details.treatment_date,
    })

    const idempotencyKey = [
        MARK_INSURANCE_CLAIM_FILED,
        petId,
        reminder.id,
        normalizedFiledDate,
    ].join(":")

    return {
        pet_id: petId,
        source_event_id: reminder.id,
        action_type: MARK_INSURANCE_CLAIM_FILED,
        status: "proposed",
        request_source: requestSource,
        requested_by: requestedBy,
        idempotency_key: idempotencyKey,
        preview_json: {
            title: `Mark ${details.insurance_provider} claim as filed`,
            confirmation_message:
                `Record the ${details.insurance_provider} claim as filed on ` +
                `${normalizedFiledDate} and complete this reminder?`,
            insurance_provider: details.insurance_provider,
            treatment_date: details.treatment_date,
            filed_date: normalizedFiledDate,
            source_document_title: sourceDocument.title,
            changes: [
                {
                    operation: "create",
                    record_type: "insurance_claim_submission",
                    status: "verified",
                    event_date: normalizedFiledDate,
                },
                {
                    operation: "update",
                    record_type: "reminder",
                    record_id: reminder.id,
                    status: "completed",
                },
            ],
        },
        payload_json: {
            schema_version: 1,
            pet_id: petId,
            source_reminder_id: reminder.id,
            source_reminder_updated_at: reminder.updated_at,
            source_document_id: sourceDocument.id,
            source_document_status: sourceDocument.status,
            source_document_title: sourceDocument.title,
            source_document_date: sourceDocument.doc_date,
            source_org: sourceDocument.source_org || null,
            insurance_provider: details.insurance_provider,
            treatment_date: details.treatment_date,
            target_submit_date: details.target_submit_date,
            claim_deadline_date: details.claim_deadline_date,
            filed_date: normalizedFiledDate,
            filed_by: requestedBy,
            source: "owner_confirmation",
        },
        evidence_json: [
            {
                type: "event",
                id: reminder.id,
                label: "Current planned insurance-claim reminder",
                event_date: reminder.event_date,
                updated_at: reminder.updated_at,
            },
            {
                type: "document",
                id: sourceDocument.id,
                label: "Verified source document",
                title: sourceDocument.title,
                document_date: sourceDocument.doc_date,
                status: sourceDocument.status,
            },
        ],
    }
}

function validateInsuranceClaimReminder({ petId, reminder }) {
    if (!reminder || typeof reminder !== "object") {
        throw new Error("A trusted reminder is required.")
    }

    assertNonBlank(reminder.id, "reminder.id")
    assertNonBlank(reminder.updated_at, "reminder.updated_at")

    if (reminder.pet_id !== petId) {
        throw new Error("Reminder does not belong to this pet.")
    }

    if (reminder.event_type !== "reminder") {
        throw new Error("Source event must be a reminder.")
    }

    if (reminder.status !== "planned") {
        throw new Error("Only a planned reminder can be marked as filed.")
    }

    const details = reminder.details_json || {}

    if (details.subtype !== INSURANCE_CLAIM_SUBTYPE) {
        throw new Error("Reminder is not an insurance-claim reminder.")
    }

    assertNonBlank(
        details.insurance_provider,
        "details_json.insurance_provider"
    )
    assertIsoDate(details.treatment_date, "details_json.treatment_date")
    assertIsoDate(
        details.target_submit_date,
        "details_json.target_submit_date"
    )
    assertIsoDate(
        details.claim_deadline_date,
        "details_json.claim_deadline_date"
    )

    return details
}

function validateVerifiedSourceDocument({
    petId,
    reminder,
    sourceDocument,
    treatmentDate,
}) {
    if (!sourceDocument || typeof sourceDocument !== "object") {
        throw new Error("A verified source document is required.")
    }

    assertNonBlank(sourceDocument.id, "sourceDocument.id")
    assertNonBlank(sourceDocument.title, "sourceDocument.title")
    assertIsoDate(sourceDocument.doc_date, "sourceDocument.doc_date")

    if (sourceDocument.pet_id !== petId) {
        throw new Error("Source document does not belong to this pet.")
    }

    if (sourceDocument.status !== "verified") {
        throw new Error("Source document must still be verified.")
    }

    const reminderDocumentIds = [
        reminder.doc_id,
        reminder.details_json?.source_document_id,
    ].filter(Boolean)

    if (
        reminderDocumentIds.length === 0 ||
        reminderDocumentIds.some((id) => id !== sourceDocument.id)
    ) {
        throw new Error(
            "Insurance claim reminder does not match the verified source document."
        )
    }

    if (sourceDocument.doc_date !== treatmentDate) {
        throw new Error(
            "Treatment date no longer matches the verified source document."
        )
    }
}

function validateFiledDate({ filedDate, currentCareDate, treatmentDate }) {
    const normalizedFiledDate = addDaysToIsoDate(filedDate, 0)
    const normalizedCurrentCareDate = addDaysToIsoDate(currentCareDate, 0)

    if (normalizedFiledDate > normalizedCurrentCareDate) {
        throw new Error("Claim filing date cannot be in the future.")
    }

    if (normalizedFiledDate < treatmentDate) {
        throw new Error("Claim filing date cannot be before the treatment date.")
    }

    return normalizedFiledDate
}

function assertIsoDate(value, label) {
    try {
        addDaysToIsoDate(value, 0)
    } catch {
        throw new Error(`${label} must be a valid ISO date.`)
    }
}

function assertNonBlank(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} is required.`)
    }
}