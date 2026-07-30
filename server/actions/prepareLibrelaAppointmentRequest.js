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
    orchestrationRunId,
    reminderId,
    injectionId,
    messageBody,
    requestSource = "dashboard",
    requestedBy,
}) {
    assertRepository(repository)
    assertRequiredString(petId, "petId")
    assertRequiredString(orchestrationRunId, "orchestrationRunId")
    assertRequiredString(reminderId, "reminderId")
    assertRequiredString(injectionId, "injectionId")
    assertRequiredString(messageBody, "messageBody")
    assertRequiredString(requestedBy, "requestedBy")

    const [reminder, injection, orchestrationRun] = await Promise.all([
        repository.findReminder({ petId, reminderId }),
        repository.findEvent({ petId, eventId: injectionId }),
        repository.findOrchestrationRunById(orchestrationRunId),
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

    assertEligibleOrchestrationRun({
        run: orchestrationRun,
        petId,
        reminderId,
        injectionId,
    })

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
            orchestrationRunId,
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
            action: await ensureOrchestrationLink({
                repository,
                action: existing,
                orchestrationRunId,
            }),
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
            action: await ensureOrchestrationLink({
                repository,
                action: racedAction,
                orchestrationRunId,
            }),
        }
    }
}

function assertEligibleOrchestrationRun({
    run,
    petId,
    reminderId,
    injectionId,
}) {
    if (!run) {
        throw preparationError({
            status: 404,
            reason: "orchestration_run_not_found",
            message:
                "The appointment workflow was not found. Ask TomoCare to prepare a new request.",
        })
    }

    const draft = run.result_json?.draft
    const evidence = draft?.evidence
    const eligible =
        run.pet_id === petId &&
        run.workflow_type === "librela_appointment_request" &&
        run.status === "awaiting_human_review" &&
        run.current_step === "human_review" &&
        run.external_action_taken === false &&
        run.result_json?.status === "prepared" &&
        evidence?.reminder_event_id === reminderId &&
        evidence?.injection_event_id === injectionId

    if (!eligible) {
        throw preparationError({
            status: 409,
            reason: "orchestration_run_changed",
            message:
                "The appointment workflow no longer matches this draft. Ask TomoCare to prepare it again.",
        })
    }
}

async function ensureOrchestrationLink({
    repository,
    action,
    orchestrationRunId,
}) {
    if (action.orchestration_run_id === orchestrationRunId) {
        return action
    }

    if (action.orchestration_run_id) {
        throw preparationError({
            status: 409,
            reason: "action_link_conflict",
            message:
                "This exact request belongs to a different workflow. Review the existing action before continuing.",
        })
    }

    const linked = await repository.linkActionToOrchestrationRun({
        actionId: action.id,
        orchestrationRunId,
    })

    if (linked?.orchestration_run_id === orchestrationRunId) {
        return linked
    }

    const latest = await repository.findActiveActionByIdempotencyKey(
        action.idempotency_key
    )

    if (latest?.orchestration_run_id === orchestrationRunId) {
        return latest
    }

    throw preparationError({
        status: 409,
        reason: "action_link_changed",
        message:
            "The appointment request changed while TomoCare was linking it to the workflow. Review it again.",
    })
}

function assertRepository(repository) {
    const requiredMethods = [
        "findReminder",
        "findEvent",
        "findOrchestrationRunById",
        "findVerifiedProviderContacts",
        "findActiveActionByIdempotencyKey",
        "insertProposedAction",
        "linkActionToOrchestrationRun",
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
