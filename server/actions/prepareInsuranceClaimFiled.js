import { buildMarkInsuranceClaimFiledProposal } from "./insuranceClaimFiled.js"

export class InsuranceClaimPreparationError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "InsuranceClaimPreparationError"
        this.status = status
        this.reason = reason
    }
}

export async function prepareMarkInsuranceClaimFiled({
    repository,
    petId,
    reminderId,
    filedDate,
    requestSource = "dashboard",
    requestedBy,
    currentCareDate,
}) {
    assertRepository(repository)
    assertRequiredString(petId, "petId")
    assertRequiredString(reminderId, "reminderId")
    assertRequiredString(filedDate, "filedDate")
    assertRequiredString(requestedBy, "requestedBy")

    const reminder = await repository.findReminder({ petId, reminderId })

    if (!reminder) {
        throw preparationError({
            status: 404,
            reason: "reminder_not_found",
            message: "The trusted reminder was not found for this pet.",
        })
    }

    const sourceDocumentId =
        reminder.doc_id || reminder.details_json?.source_document_id

    if (typeof sourceDocumentId !== "string" || !sourceDocumentId.trim()) {
        throw preparationError({
            status: 409,
            reason: "source_evidence_missing",
            message:
                "This insurance claim reminder is missing its verified source document.",
        })
    }

    const sourceDocument = await repository.findVerifiedDocument({
        petId,
        documentId: sourceDocumentId,
    })

    if (!sourceDocument) {
        throw preparationError({
            status: 409,
            reason: "source_evidence_missing",
            message:
                "The verified source document was not found for this insurance claim reminder.",
        })
    }

    let proposal

    try {
        proposal = buildMarkInsuranceClaimFiledProposal({
            petId,
            reminder,
            sourceDocument,
            filedDate,
            requestSource,
            requestedBy,
            currentCareDate,
        })
    } catch (error) {
        throw preparationError({
            status: 409,
            reason: "action_not_eligible",
            message:
                error?.message ||
                "This reminder is not eligible for this action.",
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
        "findVerifiedDocument",
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
    return new InsuranceClaimPreparationError(options)
}