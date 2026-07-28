import { buildMarkHomeMedicationGivenProposal } from "./homeMedicationGiven.js"

export class ActionPreparationError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "ActionPreparationError"
        this.status = status
        this.reason = reason
    }
}

export async function prepareMarkHomeMedicationGiven({
    repository,
    petId,
    reminderId,
    administeredDate,
    requestSource = "dashboard",
    requestedBy,
    currentCareDate,
}) {
    assertRepository(repository)
    assertRequiredString(petId, "petId")
    assertRequiredString(reminderId, "reminderId")
    assertRequiredString(administeredDate, "administeredDate")
    assertRequiredString(requestedBy, "requestedBy")

    const reminder = await repository.findReminder({ petId, reminderId })

    if (!reminder) {
        throw new ActionPreparationError({
            status: 404,
            reason: "reminder_not_found",
            message: "The trusted reminder was not found for this pet.",
        })
    }

    let proposal

    try {
        proposal = buildMarkHomeMedicationGivenProposal({
            petId,
            reminder,
            administeredDate,
            requestSource,
            requestedBy,
            currentCareDate,
        })
    } catch (error) {
        throw new ActionPreparationError({
            status: 409,
            reason: "action_not_eligible",
            message: error?.message || "This reminder is not eligible for this action.",
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

        // A second request may pass the first lookup at the same time. The
        // database unique index is the final authority in that race.
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
        throw new ActionPreparationError({
            status: 400,
            reason: "invalid_request",
            message: `${label} is required.`,
        })
    }
}