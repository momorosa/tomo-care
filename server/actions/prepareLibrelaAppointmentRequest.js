import { buildSendLibrelaAppointmentRequestProposal } from "./librelaAppointmentRequest.js"

export class LibrelaAppointmentPreparationError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "LibrelaAppointmentPreparationError"
        this.status = status
        this.reason = reason
    }
}

export async function prepareSendLibrelaAppointmentRequest({
    repository,
    petId,
    reminderId,
    injectionId,
    messageBody,
    requestSource = "dashboard",
    requestedBy,
}) {
    assertRepository(repository)
    assertRequiredString(petId, "petId")
    assertRequiredString(reminderId, "reminderId")
    assertRequiredString(injectionId, "injectionId")
    assertRequiredString(messageBody, "messageBody")
    assertRequiredString(requestedBy, "requestedBy")

    const [reminder, injection] = await Promise.all([
        repository.findReminder({ petId, reminderId }),
        repository.findEvent({ petId, eventId: injectionId }),
    ])

    if (!reminder) {
        throw preparationError({
            status: 404,
            reason: "reminder_not_found",
            message: "The trusted Librela reminder was not found for this pet.",
        })
    }

    if (!injection) {
        throw preparationError({
            status: 409,
            reason: "source_evidence_missing",
            message: "The verified Librela injection was not found.",
        })
    }

    const organizationName =
        reminder.details_json?.source_org ||
        reminder.details_json?.provider_name

    if (typeof organizationName !== "string" || !organizationName.trim()) {
        throw preparationError({
            status: 409,
            reason: "recipient_not_found",
            message:
                "The Librela reminder does not identify a trusted clinic recipient.",
        })
    }

    const recipients = await repository.findVerifiedProviderContacts({
        organizationName,
        channel: "sms",
    })

    if (recipients.length === 0) {
        throw preparationError({
            status: 409,
            reason: "recipient_not_found",
            message:
                "No active verified SMS recipient was found for this clinic.",
        })
    }

    if (recipients.length > 1) {
        throw preparationError({
            status: 409,
            reason: "recipient_ambiguous",
            message:
                "More than one active verified SMS recipient was found for this clinic.",
        })
    }

    let proposal

    try {
        proposal = buildSendLibrelaAppointmentRequestProposal({
            petId,
            reminder,
            injection,
            recipient: recipients[0],
            messageBody,
            requestSource,
            requestedBy,
        })
    } catch (error) {
        throw preparationError({
            status: 409,
            reason: "action_not_eligible",
            message:
                error?.message ||
                "This Librela appointment request is not eligible to send.",
            cause: error,
        })
    }

    const existing = await repository.findActiveActionByIdempotencyKey(
        proposal.idempotency_key
    )

    if (existing) {
        return {
            disposition: "existing",
            action: existing,
        }
    }

    try {
        const action = await repository.insertProposedAction(proposal)

        return {
            disposition: "created",
            action,
        }
    } catch (error) {
        if (error?.code !== "23505") throw error

        const racedAction =
            await repository.findActiveActionByIdempotencyKey(
                proposal.idempotency_key
            )

        if (!racedAction) throw error

        return {
            disposition: "existing",
            action: racedAction,
        }
    }
}

function assertRepository(repository) {
    const requiredMethods = [
        "findReminder",
        "findEvent",
        "findVerifiedProviderContacts",
        "findActiveActionByIdempotencyKey",
        "insertProposedAction",
    ]

    for (const method of requiredMethods) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw preparationError({
            status: 400,
            reason: "invalid_request",
            message: `${label} is required.`,
        })
    }
}

function preparationError(options) {
    return new LibrelaAppointmentPreparationError(options)
}