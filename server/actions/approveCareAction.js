import {
    MARK_HOME_MEDICATION_GIVEN,
    buildMarkHomeMedicationGivenProposal,
} from "./homeMedicationGiven.js"

const SUPPORTED_ACTION_TYPES = new Set([MARK_HOME_MEDICATION_GIVEN])

export class ActionApprovalError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "ActionApprovalError"
        this.status = status
        this.reason = reason
    }
}

export async function approveCareAction({
    repository,
    actionId,
    approvedBy,
    currentCareDate,
    approvedAt = new Date().toISOString(),
}) {
    assertRepository(repository)
    assertRequiredString(actionId, "actionId")
    assertRequiredString(approvedBy, "approvedBy")

    const action = await repository.findActionById(actionId)

    if (!action) {
        throw approvalError(
            404,
            "action_not_found",
            "The proposed care action was not found."
        )
    }

    if (!SUPPORTED_ACTION_TYPES.has(action.action_type)) {
        throw approvalError(
            409,
            "unsupported_action_type",
            `Approval is not implemented for action type: ${action.action_type}`
        )
    }

    if (action.status === "approved") {
        return {
            disposition: "existing",
            action,
        }
    }

    if (action.status !== "proposed") {
        throw approvalError(
            409,
            "action_not_proposed",
            `Only a proposed action can be approved. Current status: ${action.status}`
        )
    }

    await assertSourceEvidenceIsCurrent({
        repository,
        action,
        currentCareDate,
    })

    const approvedAction = await repository.approveProposedAction({
        actionId: action.id,
        approvedBy,
        approvedAt,
        expectedUpdatedAt: action.updated_at,
    })

    if (approvedAction) {
        return {
            disposition: "approved",
            action: approvedAction,
        }
    }

    // The conditional update may lose a race to another request. Reload the
    // action and treat an already-approved result as an idempotent success.
    const latestAction = await repository.findActionById(action.id)

    if (latestAction?.status === "approved") {
        return {
            disposition: "existing",
            action: latestAction,
        }
    }

    throw approvalError(
        409,
        "action_state_changed",
        "The action changed while approval was being recorded. Review it again."
    )
}

async function assertSourceEvidenceIsCurrent({
    repository,
    action,
    currentCareDate,
}) {
    const payload = action.payload_json || {}

    if (
        payload.schema_version !== 1 ||
        payload.source_reminder_id !== action.source_event_id ||
        typeof payload.source_reminder_updated_at !== "string" ||
        !payload.source_reminder_updated_at
    ) {
        throw approvalError(
            409,
            "invalid_action_contract",
            "The proposed action is missing its trusted reminder snapshot."
        )
    }

    const reminder = await repository.findReminder({
        petId: action.pet_id,
        reminderId: action.source_event_id,
    })

    if (!reminder) {
        throw approvalError(
            409,
            "source_evidence_missing",
            "The trusted reminder no longer exists. Prepare a new action."
        )
    }

    if (reminder.updated_at !== payload.source_reminder_updated_at) {
        throw approvalError(
            409,
            "source_evidence_changed",
            "The trusted reminder changed after this proposal was prepared. Review and prepare it again."
        )
    }

    let rebuiltProposal

    try {
        rebuiltProposal = buildMarkHomeMedicationGivenProposal({
            petId: action.pet_id,
            reminder,
            administeredDate: payload.administered_date,
            requestSource: action.request_source,
            requestedBy: action.requested_by,
            currentCareDate,
        })
    } catch (error) {
        throw new ActionApprovalError({
            status: 409,
            reason: "action_no_longer_eligible",
            message:
                error?.message ||
                "The care action is no longer eligible for approval.",
            cause: error,
        })
    }

    if (rebuiltProposal.idempotency_key !== action.idempotency_key) {
        throw approvalError(
            409,
            "invalid_action_contract",
            "The proposed action no longer matches its trusted evidence."
        )
    }
}

function assertRepository(repository) {
    const requiredMethods = [
        "findActionById",
        "findReminder",
        "approveProposedAction",
    ]

    for (const method of requiredMethods) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw approvalError(400, "invalid_request", `${label} is required.`)
    }
}

function approvalError(status, reason, message) {
    return new ActionApprovalError({ status, reason, message })
}


