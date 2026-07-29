import { createHash } from "node:crypto"
import { addDaysToIsoDate } from "../lib/careDates.js"

export const SEND_LIBRELA_APPOINTMENT_REQUEST =
    "send_librela_appointment_request"

const LIBRELA_SUBTYPE = "librela"
const SMS_CHANNEL = "sms"
const VERIFIED_STATUS = "verified"
const MAX_MESSAGE_LENGTH = 1600
const ALLOWED_REQUEST_SOURCES = new Set([
    "dashboard",
    "assistant",
    "system",
])

export function buildSendLibrelaAppointmentRequestProposal({
    petId,
    reminder,
    injection,
    recipient,
    messageBody,
    requestSource,
    requestedBy,
}) {
    assertNonBlank(petId, "petId")
    assertNonBlank(requestedBy, "requestedBy")

    if (!ALLOWED_REQUEST_SOURCES.has(requestSource)) {
        throw new Error(`Unsupported request source: ${requestSource}`)
    }

    const reminderEvidence = validateLibrelaReminder({ petId, reminder })
    validateLibrelaInjection({
        petId,
        reminder,
        injection,
    })
    const recipientEvidence = validateVerifiedRecipient({
        recipient,
        expectedOrganization: reminderEvidence.recipientOrganization,
    })
    const frozenMessage = validateMessageBody(messageBody)
    const messageSha256 = sha256(frozenMessage)
    const recipientFingerprint = sha256(
        `${recipientEvidence.channel}:${recipientEvidence.address}`
    )

    const idempotencyKey = [
        SEND_LIBRELA_APPOINTMENT_REQUEST,
        petId,
        reminder.id,
        recipient.id,
        messageSha256,
    ].join(":")

    return {
        pet_id: petId,
        source_event_id: reminder.id,
        action_type: SEND_LIBRELA_APPOINTMENT_REQUEST,
        status: "proposed",
        request_source: requestSource,
        requested_by: requestedBy,
        idempotency_key: idempotencyKey,
        preview_json: {
            title: "Send Librela appointment request",
            confirmation_message:
                `Send this exact message to ${recipient.organization_name} ` +
                "using its verified SMS contact?",
            recipient_name: recipient.organization_name,
            recipient_channel: recipient.channel,
            message_body: frozenMessage,
            message_sha256: messageSha256,
            last_verified_injection_date: injection.event_date,
            reminder_date: reminder.event_date,
            due_date: reminderEvidence.dueDate,
            changes: [
                {
                    operation: "send",
                    record_type: "outbound_message",
                    channel: recipient.channel,
                    recipient_name: recipient.organization_name,
                },
            ],
        },
        payload_json: {
            schema_version: 1,
            pet_id: petId,
            source_reminder_id: reminder.id,
            source_reminder_updated_at: reminder.updated_at,
            injection_event_id: injection.id,
            injection_event_updated_at: injection.updated_at,
            last_verified_injection_date: injection.event_date,
            reminder_date: reminder.event_date,
            due_date: reminderEvidence.dueDate,
            provider_contact_id: recipient.id,
            provider_contact_updated_at: recipient.updated_at,
            recipient_name: recipient.organization_name,
            recipient_channel: recipient.channel,
            recipient_fingerprint_sha256: recipientFingerprint,
            recipient_verification_source: recipient.verification_source,
            recipient_verified_by: recipient.verified_by,
            recipient_verified_at: recipient.verified_at,
            message_body: frozenMessage,
            message_sha256: messageSha256,
            purpose: "schedule_librela_injection",
        },
        evidence_json: [
            {
                type: "event",
                id: reminder.id,
                label: "Current planned Librela reminder",
                event_date: reminder.event_date,
                due_date: reminderEvidence.dueDate,
                updated_at: reminder.updated_at,
            },
            {
                type: "event",
                id: injection.id,
                label: "Last verified Librela injection",
                event_date: injection.event_date,
                updated_at: injection.updated_at,
            },
            {
                type: "provider_contact",
                id: recipient.id,
                label: "Verified clinic SMS recipient",
                organization_name: recipient.organization_name,
                channel: recipient.channel,
                verification_source: recipient.verification_source,
                verified_by: recipient.verified_by,
                verified_at: recipient.verified_at,
                updated_at: recipient.updated_at,
            },
        ],
    }
}

export function sha256(value) {
    return createHash("sha256").update(value, "utf8").digest("hex")
}

function validateLibrelaReminder({ petId, reminder }) {
    if (!reminder || typeof reminder !== "object") {
        throw new Error("A trusted Librela reminder is required.")
    }

    assertNonBlank(reminder.id, "reminder.id")
    assertNonBlank(reminder.updated_at, "reminder.updated_at")

    if (reminder.pet_id !== petId) {
        throw new Error("Reminder does not belong to this pet.")
    }

    if (reminder.event_type !== "reminder" || reminder.status !== "planned") {
        throw new Error("Only a planned Librela reminder can be used.")
    }

    const details = reminder.details_json || {}

    if (!isLibrelaRelated(reminder)) {
        throw new Error("Reminder is not for Librela.")
    }

    const dueDate = assertIsoDate(details.due_date, "details_json.due_date")
    const reminderDate = assertIsoDate(reminder.event_date, "reminder.event_date")

    if (reminderDate > dueDate) {
        throw new Error("Librela reminder date cannot be after its due date.")
    }

    const recipientOrganization =
        details.source_org || details.provider_name || null
    assertNonBlank(
        recipientOrganization,
        "details_json.source_org"
    )

    return {
        dueDate,
        recipientOrganization,
    }
}

function validateLibrelaInjection({ petId, reminder, injection }) {
    if (!injection || typeof injection !== "object") {
        throw new Error("A verified Librela injection is required.")
    }

    assertNonBlank(injection.id, "injection.id")
    assertNonBlank(injection.updated_at, "injection.updated_at")

    if (injection.pet_id !== petId) {
        throw new Error("Injection does not belong to this pet.")
    }

    if (
        injection.event_type !== "injection" ||
        injection.status !== VERIFIED_STATUS ||
        !isLibrelaRelated(injection)
    ) {
        throw new Error("Injection must be a verified Librela event.")
    }

    const injectionDate = assertIsoDate(
        injection.event_date,
        "injection.event_date"
    )
    const dueDate = assertIsoDate(
        reminder.details_json?.due_date,
        "details_json.due_date"
    )
    const anchorEventId = reminder.details_json?.anchor_event_id

    if (anchorEventId && anchorEventId !== injection.id) {
        throw new Error(
            "Librela reminder does not match the verified injection."
        )
    }

    if (injectionDate >= dueDate) {
        throw new Error("Librela due date must follow the verified injection.")
    }

    return { injectionDate }
}

function validateVerifiedRecipient({ recipient, expectedOrganization }) {
    if (!recipient || typeof recipient !== "object") {
        throw new Error("A verified clinic recipient is required.")
    }

    for (const field of [
        "id",
        "organization_name",
        "channel",
        "address",
        "verification_status",
        "verification_source",
        "verified_by",
        "verified_at",
        "updated_at",
    ]) {
        assertNonBlank(recipient[field], `recipient.${field}`)
    }

    if (
        recipient.channel !== SMS_CHANNEL ||
        recipient.verification_status !== VERIFIED_STATUS ||
        recipient.is_active !== true
    ) {
        throw new Error("Clinic recipient is not an active verified SMS contact.")
    }

    if (
        recipient.organization_name.trim().toLowerCase() !==
        expectedOrganization.trim().toLowerCase()
    ) {
        throw new Error("Clinic recipient does not match the reminder provider.")
    }

    if (!/^\+[1-9]\d{7,14}$/.test(recipient.address)) {
        throw new Error("Verified SMS contact is not in E.164 format.")
    }

    return {
        channel: recipient.channel,
        address: recipient.address,
    }
}

function validateMessageBody(messageBody) {
    if (typeof messageBody !== "string" || !messageBody.trim()) {
        throw new Error("messageBody is required.")
    }

    if (messageBody.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
            `messageBody cannot exceed ${MAX_MESSAGE_LENGTH} characters.`
        )
    }

    return messageBody
}

function isLibrelaRelated(event) {
    const details = event?.details_json || {}
    const values = [
        details.subtype,
        details.target_subtype,
        details.medication,
        details.medication_name,
        details.care_item,
    ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())

    return values.some((value) => value.includes(LIBRELA_SUBTYPE))
}

function assertIsoDate(value, label) {
    try {
        return addDaysToIsoDate(value, 0)
    } catch {
        throw new Error(`${label} must be a valid ISO date.`)
    }
}

function assertNonBlank(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} is required.`)
    }
}