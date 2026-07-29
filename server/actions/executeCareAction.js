import { MARK_HOME_MEDICATION_GIVEN } from "./homeMedicationGiven.js"
import { MARK_INSURANCE_CLAIM_FILED } from "./insuranceClaimFiled.js"
import { SEND_LIBRELA_APPOINTMENT_REQUEST } from "./librelaAppointmentRequest.js"
import {
    LibrelaAppointmentExecutionError,
    executeSendLibrelaAppointmentRequest,
} from "./executeLibrelaAppointmentRequest.js"
import { createOutboundMessageProvider } from "../messaging/outboundMessageProvider.js"
import { getCareDate } from "../lib/careDates.js"

const EXECUTION_ACTOR = "tomo-care-backend"
const EXECUTION_METHODS = {
    [MARK_HOME_MEDICATION_GIVEN]: "executeMarkHomeMedicationGiven",
    [MARK_INSURANCE_CLAIM_FILED]: "executeMarkInsuranceClaimFiled",
}

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
            "The trusted evidence used to prepare this action is no longer available. Nothing was changed.",
        recovery: "prepare_again",
    },
    source_evidence_changed: {
        status: 409,
        message:
            "Momo’s trusted evidence changed after this action was reviewed. Nothing was changed.",
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
    outboundMessageProvider,
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

    if (action.action_type === SEND_LIBRELA_APPOINTMENT_REQUEST) {
        let execution

        try {
            execution = await executeSendLibrelaAppointmentRequest({
                repository,
                actionId: action.id,
                provider:
                    outboundMessageProvider ||
                    createOutboundMessageProvider(),
            })
        } catch (error) {
            if (error instanceof LibrelaAppointmentExecutionError) {
                throw executionError({
                    status: error.status,
                    reason: error.reason,
                    message: error.message,
                    recovery: error.recovery,
                    retryable: error.retryable,
                    outcomeUnknown: error.outcomeUnknown,
                    cause: error,
                })
            }

            throw executionError({
                status: 503,
                reason: "delivery_outcome_unknown",
                message:
                    "TomoCare could not complete or confirm the outbound delivery workflow. The action must be reviewed before any new send attempt.",
                recovery: "review_delivery",
                retryable: false,
                outcomeUnknown: true,
                cause: error,
            })
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
                    "TomoCare received an incomplete message result. Review the action before continuing.",
                recovery: "review_delivery",
                outcomeUnknown: true,
            })
        }

        return {
            disposition: execution.disposition,
            actionId: execution.action_id,
            actionType: action.action_type,
            status: execution.status,
            result: execution.result,
        }
    }

    const executionMethod = EXECUTION_METHODS[action.action_type]

    if (!executionMethod) {
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
            actionType: action.action_type,
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

    if (typeof repository[executionMethod] !== "function") {
        throw new Error(`repository.${executionMethod} is required.`)
    }

    let execution

    try {
        execution = await repository[executionMethod]({
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
        actionType: action.action_type,
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
    const requiredMethods = ["findActionById"]

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