export class ActionCancellationError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "ActionCancellationError"
        this.status = status
        this.reason = reason
    }
}

export async function cancelCareAction({
    repository,
    actionId,
    cancelledAt = new Date().toISOString(),
}) {
    assertRepository(repository)
    assertRequiredString(actionId, "actionId")

    const action = await repository.findActionById(actionId)

    if (!action) {
        throw cancellationError(
            404,
            "action_not_found",
            "The proposed care action was not found."
        )
    }

    if (action.status === "cancelled") {
        return {
            disposition: "existing",
            action,
        }
    }

    if (action.status !== "proposed") {
        throw cancellationError(
            409,
            "action_not_cancellable",
            `Only a proposal that has not been approved can be cancelled. Current status: ${action.status}`
        )
    }

    const cancelledAction = await repository.cancelProposedAction({
        actionId: action.id,
        cancelledAt,
        expectedUpdatedAt: action.updated_at,
    })

    if (cancelledAction) {
        return {
            disposition: "cancelled",
            action: cancelledAction,
        }
    }

    const latestAction = await repository.findActionById(action.id)

    if (latestAction?.status === "cancelled") {
        return {
            disposition: "existing",
            action: latestAction,
        }
    }

    throw cancellationError(
        409,
        "action_state_changed",
        "The action changed before it could be cancelled. Refresh and review its current state."
    )
}

function assertRepository(repository) {
    const requiredMethods = ["findActionById", "cancelProposedAction"]

    for (const method of requiredMethods) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw cancellationError(400, "invalid_request", `${label} is required.`)
    }
}

function cancellationError(status, reason, message) {
    return new ActionCancellationError({ status, reason, message })
}
