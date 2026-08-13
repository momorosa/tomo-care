const RESOLUTION_ACTOR = "Rosa"
const RESOLUTION_STATES = {
    sent: "user_reported_sent",
    not_sent: "user_confirmed_not_sent",
}

export class AppleMessagesHandoffResolutionError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "AppleMessagesHandoffResolutionError"
        this.status = status
        this.reason = reason
    }
}

export async function resolveLibrelaAppleMessagesHandoff({
    repository,
    actionId,
    resolution,
}) {
    assertRepository(repository)
    assertRequiredString(actionId, "actionId")

    const resolutionState = RESOLUTION_STATES[resolution]

    if (!resolutionState) {
        throw resolutionError(
            400,
            "invalid_resolution",
            "Choose whether you sent the Messages draft or did not send it."
        )
    }

    let resolved

    try {
        resolved = await repository.resolveLibrelaAppleMessagesHandoff({
            actionId,
            resolution: resolutionState,
            resolvedBy: RESOLUTION_ACTOR,
        })
    } catch (error) {
        throw mapResolutionError(error)
    }

    assertResolvedContract(resolved, resolutionState)

    return {
        disposition: resolved.disposition,
        action: {
            id: resolved.action_id,
            status: resolved.action_status,
        },
        handoff: {
            id: resolved.handoff_id,
            state: resolved.state,
            target_app: resolved.target_app,
            contract_version: resolved.contract_version,
            resolved_at: resolved.resolved_at,
        },
    }
}

function assertResolvedContract(resolved, expectedState) {
    const expectedActionStatus =
        expectedState === "user_reported_sent" ? "succeeded" : "cancelled"

    if (
        !resolved ||
        !["resolved", "existing"].includes(resolved.disposition) ||
        resolved.state !== expectedState ||
        resolved.action_status !== expectedActionStatus ||
        resolved.target_app !== "apple_messages" ||
        resolved.contract_version !== 1
    ) {
        throw resolutionError(
            502,
            "invalid_resolution_response",
            "TomoCare could not confirm the handoff resolution. Review the pending request again."
        )
    }

    for (const field of [
        "action_id",
        "handoff_id",
        "resolved_at",
    ]) {
        if (typeof resolved[field] !== "string" || !resolved[field].trim()) {
            throw resolutionError(
                502,
                "invalid_resolution_response",
                "TomoCare could not confirm the handoff resolution. Review the pending request again."
            )
        }
    }
}

function mapResolutionError(error) {
    const reason = String(error?.message || "").split(":", 1)[0]
    const mappings = {
        invalid_request: [400, "The handoff resolution is incomplete."],
        action_not_found: [404, "The appointment request was not found."],
        handoff_not_found: [409, "Open the approved request in Messages before resolving it."],
        unsupported_action_type: [409, "This action does not have a Messages handoff."],
        action_not_approved: [409, "This request is no longer awaiting a Messages outcome."],
        handoff_resolution_conflict: [409, "This request already has a different recorded outcome."],
    }
    const mapping = mappings[reason]

    if (!mapping) return error

    return new AppleMessagesHandoffResolutionError({
        status: mapping[0],
        reason,
        message: mapping[1],
        cause: error,
    })
}

function assertRepository(repository) {
    if (typeof repository?.resolveLibrelaAppleMessagesHandoff !== "function") {
        throw new Error(
            "repository.resolveLibrelaAppleMessagesHandoff is required."
        )
    }
}

function assertRequiredString(value, field) {
    if (typeof value !== "string" || !value.trim()) {
        throw resolutionError(400, "invalid_request", `${field} is required.`)
    }
}

function resolutionError(status, reason, message) {
    return new AppleMessagesHandoffResolutionError({
        status,
        reason,
        message,
    })
}
