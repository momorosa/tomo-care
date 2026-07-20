import { MARK_HOME_MEDICATION_GIVEN } from "./homeMedicationGiven.js"
import { getCareDate } from "../lib/careDates.js"

const EXECUTION_ACTOR = "tomo-care-backend"

const DATABASE_ERROR_RESPONSES = {
    action_not_found: {
        status: 404,
        message: "The care action was not found.",
        recovery: "refresh",
    },
    action_not_approved: {
        status: 409,
        message: "This care action must be approved before it can be completed.",
        recovery: "review_action",
    },
    unsupported_action_type: {
        status: 409,
        message: "TomoCare cannot complete this type of care action yet.",
        recovery: "review_action",
    },
    invalid_action_contract: {
        status: 409,
        message:
            "This action no longer matches the care plan that was reviewed. Nothing was changed.",
        recovery: "prepare_again",
    },
    action_no_longer_eligible: {
        status: 409,
        message:
            "This action is no longer eligible to run. Nothing was changed.",
        recovery: "prepare_again",
    },
    source_evidence_missing: {
        status: 409,
        message:
            "The reminder used to prepare this action is no longer available. Nothing was changed.",
        recovery: "prepare_again",
    },
    source_evidence_changed: {
        status: 409,
        message:
            "Momo’s reminder changed after this action was reviewed. Nothing was changed.",
        recovery: "prepare_again",
    },
    ambiguous_next_reminder: {
        status: 409,
        message:
            "TomoCare found more than one possible next reminder and did not change anything.",
        recovery: "review_reminders",
    },
    invalid_request: {
        status: 400,
        message: "The execution request is incomplete.",
        recovery: "review_action",
    },
}

export class ActionExecutionError extends Error {
    constructor({
        status,
        reason,
        message,
        recovery,
        retryable = false,
        outcomeUnknown = false,
        cause,
    }) {
        super(message, cause ? { cause } : undefined)
        this.name = "ActionExecutionError"
        this.status = status
        this.reason = reason
        this.recovery = recovery
        this.retryable = retryable
        this.outcomeUnknown = outcomeUnknown
    }
}

export async function executeCareAction({
    repository,
    actionId,
    currentCareDate = getCareDate(),
}) {
    assertRepository(repository)
    assertRequiredString(actionId, "actionId")

    const action = await repository.findActionById(actionId)

    if (!action) {
        throw executionError({
            status: 404,
            reason: "action_not_found",
            message: "The care action was not found.",
            recovery: "refresh",
        })
    }

    if (action.action_type !== MARK_HOME_MEDICATION_GIVEN) {
        throw executionError({
            status: 409,
            reason: "unsupported_action_type",
            message: "TomoCare cannot complete this type of care action yet.",
            recovery: "review_action",
        })
    }

    if (action.status === "succeeded") {
        if (!action.result_json) {
            throw executionError({
                status: 502,
                reason: "invalid_execution_response",
                message:
                    "This action is marked complete, but its result could not be confirmed. Refresh Momo’s records before continuing.",
                recovery: "refresh",
                outcomeUnknown: true,
            })
        }

        return {
            disposition: "existing",
            actionId: action.id,
            status: action.status,
            result: action.result_json,
        }
    }

    if (action.status !== "approved") {
        throw executionError({
            status: 409,
            reason: "action_not_approved",
            message: `Only an approved action can be completed. Current status: ${action.status}`,
            recovery: "review_action",
        })
    }

    let execution

    try {
        execution = await repository.executeMarkHomeMedicationGiven({
            actionId: action.id,
            executedBy: EXECUTION_ACTOR,
            careDate: currentCareDate,
        })
    } catch (error) {
        throw mapDatabaseExecutionError(error)
    }

    if (
        !execution ||
        !["executed", "existing"].includes(execution.disposition) ||
        execution.status !== "succeeded" ||
        !execution.result
    ) {
        throw executionError({
            status: 502,
            reason: "invalid_execution_response",
            message:
                "TomoCare received an incomplete execution result. Refresh Momo’s records before trying again.",
            recovery: "refresh",
            retryable: true,
            outcomeUnknown: true,
        })
    }

    return {
        disposition: execution.disposition,
        actionId: execution.action_id,
        status: execution.status,
        result: execution.result,
    }
}

export function mapDatabaseExecutionError(error) {
    const rawMessage = String(error?.message || "")
    const reason = rawMessage.split(":", 1)[0].trim()
    const knownResponse = DATABASE_ERROR_RESPONSES[reason]

    if (knownResponse) {
        return executionError({
            ...knownResponse,
            reason,
            cause: error,
        })
    }

    // A transport failure can happen after PostgreSQL committed but before
    // the API received the response. Do not claim that nothing changed. The
    // database action is idempotent, so retrying is safe in either outcome.
    return executionError({
        status: 503,
        reason: "execution_outcome_unknown",
        message:
            "TomoCare couldn’t confirm whether the update finished. Refresh Momo’s records or try again; a retry will not create a duplicate.",
        recovery: "refresh_or_retry",
        retryable: true,
        outcomeUnknown: true,
        cause: error,
    })
}

function assertRepository(repository) {
    const requiredMethods = [
        "findActionById",
        "executeMarkHomeMedicationGiven",
    ]

    for (const method of requiredMethods) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw executionError({
            status: 400,
            reason: "invalid_request",
            message: `${label} is required.`,
            recovery: "review_action",
        })
    }
}

function executionError(options) {
    return new ActionExecutionError(options)
}