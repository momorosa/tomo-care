import {
    SpecialistContractError,
    defineSpecialistContract,
} from "./specialistContract.js"

export const CARE_OPERATIONS_INPUT_VERSION =
    "care_operations_input_v1"

const CARE_OPERATIONS_INTENTS = new Set([
    "home_medication_status",
    "home_medication_due",
    "home_medication_given_action",
])

const HOME_MEDICATION_SUBJECTS = new Set([
    "simparica_trio",
    "adequan",
    "home_medications",
    null,
])

const CLARIFICATION_ISSUES = new Set([
    "uncertain_statement",
    "missing_medication",
    "multiple_medications",
    "unsupported_medication",
    "missing_date",
    "ambiguous_date",
])

const RESULT_STATUSES = new Set([
    "answer_only",
    "clarification_required",
    "reminder_not_found",
    "multiple_reminders",
    "not_eligible",
    "action_prepared",
    "action_already_prepared",
    "existing_action_requires_review",
])

export const CARE_OPERATIONS_CONTRACT = defineSpecialistContract({
    name: "care_operations",
    version: 1,
    description:
        "Reconcile trusted Simparica Trio and Adequan state and prepare at most one governed home-medication proposal.",
    allowedTruthTiers: ["trusted", "action_state"],
    allowedTools: [
        "load_home_medication_state",
        "prepare_home_medication_action",
    ],
    timeoutMs: 10000,
    validateInput: validateCareOperationsInput,
    validateOutput: validateCareOperationsOutput,
})

export const careOperationsSpecialist = Object.freeze({
    contract: CARE_OPERATIONS_CONTRACT,
    handler: runCareOperations,
})

export async function runCareOperations({ input, tools }) {
    try {
        const state = await tools.call("load_home_medication_state", {
            petId: input.pet_id,
            subject: input.medication_subject,
        })

        validateCurrentState(state, input)

        if (input.intent !== "home_medication_given_action") {
            return buildResult({
                resultStatus: "answer_only",
                state,
                pendingHumanDecision: null,
                humanControlBoundary:
                    "Care Operations read trusted medication state only. No care action was prepared.",
            })
        }

        if (input.request.issue) {
            return buildResult({
                resultStatus: "clarification_required",
                state,
                pendingHumanDecision: "clarify_home_medication_statement",
                humanControlBoundary:
                    "Rosa must provide an unambiguous medication and administration date before any proposal can be prepared.",
                actionPreparation: {
                    status: input.request.issue,
                    displayName: input.display_name,
                },
            })
        }

        const pendingForMedication = state.pending_actions.filter(
            (action) =>
                action.medication_subject ===
                input.medication_subject
        )

        if (pendingForMedication.length > 0) {
            const matching = pendingForMedication.find(
                (action) =>
                    action.administered_date ===
                    input.request.administered_date
            )
            const action = matching || pendingForMedication[0]
            const exactMatch = Boolean(
                matching && matching.status === "proposed"
            )

            return buildResult({
                resultStatus: exactMatch
                    ? "action_already_prepared"
                    : "existing_action_requires_review",
                state,
                pendingHumanDecision: exactMatch
                    ? "review_proposed_care_action"
                    : "review_existing_care_action",
                humanControlBoundary:
                    "The existing proposal still requires Rosa’s explicit review and approval. Care Operations did not approve or execute it.",
                governedAction: action,
                actionPreparation: exactMatch
                    ? {
                          status: "prepared",
                          displayName: input.display_name,
                          administeredDate:
                              input.request.administered_date,
                          disposition: "existing",
                          action,
                          reminder: findReminder(
                              state,
                              action.source_event_id
                          ),
                      }
                    : {
                          status: "not_eligible",
                          displayName: input.display_name,
                          message:
                              action.status === "proposed"
                                  ? "A different pending update already exists for this medication. Review or cancel it before preparing another."
                                  : "An existing home-medication action has already moved beyond proposal. Review its current status before preparing another.",
                      },
            })
        }

        const preparation = await tools.call(
            "prepare_home_medication_action",
            {
                petId: input.pet_id,
                medicationSubject: input.medication_subject,
                administeredDate: input.request.administered_date,
            }
        )

        return resultFromPreparation({
            input,
            state,
            preparation,
        })
    } catch (error) {
        if (error instanceof SpecialistContractError) throw error

        throw new SpecialistContractError(
            safeMessage(error),
            {
                reason: safeReason(error),
                retryable: error?.retryable !== false,
            }
        )
    }
}

function resultFromPreparation({ input, state, preparation }) {
    if (preparation?.status === "prepared") {
        const governedAction = normalizePreparedAction(
            preparation.action
        )

        if (!governedAction) {
            throw new SpecialistContractError(
                "The governed home-medication proposal was malformed.",
                {
                    reason: "malformed_result",
                    retryable: false,
                }
            )
        }

        return buildResult({
            resultStatus:
                preparation.disposition === "existing"
                    ? "action_already_prepared"
                    : "action_prepared",
            state,
            pendingHumanDecision: "review_proposed_care_action",
            humanControlBoundary:
                "The proposal requires Rosa’s explicit review and approval before trusted care state can change.",
            governedAction,
            actionPreparation: preparation,
        })
    }

    const safeStatus = RESULT_STATUSES.has(preparation?.status)
        ? preparation.status
        : preparation?.status === "reminder_not_found"
          ? "reminder_not_found"
          : preparation?.status === "multiple_reminders"
            ? "multiple_reminders"
            : "not_eligible"

    return buildResult({
        resultStatus: safeStatus,
        state,
        pendingHumanDecision:
            safeStatus === "reminder_not_found" ||
            safeStatus === "multiple_reminders"
                ? "review_home_medication_reminders"
                : "review_home_medication_request",
        humanControlBoundary:
            "No care action was prepared and no trusted medication state changed.",
        actionPreparation: {
            ...preparation,
            displayName:
                preparation?.displayName || input.display_name,
        },
    })
}

function buildResult({
    resultStatus,
    state,
    pendingHumanDecision,
    humanControlBoundary,
    governedAction = null,
    actionPreparation = null,
}) {
    const evidenceIds = [
        ...state.reminders.map((record) => record.id),
        ...state.administrations.map((record) => record.id),
    ].filter(Boolean)

    return {
        result_status: resultStatus,
        run_disposition: governedAction
            ? "awaiting_human_review"
            : "complete_no_action",
        reconciliation: {
            reminder_count: state.reminders.length,
            administration_count: state.administrations.length,
            pending_action_count: state.pending_actions.length,
        },
        evidence_ids: [...new Set(evidenceIds)].slice(0, 12),
        pending_human_decision: pendingHumanDecision,
        human_control_boundary: humanControlBoundary,
        governed_action: governedAction,
        action_preparation: actionPreparation,
    }
}

function validateCareOperationsInput(input) {
    const requestIsValid =
        input?.intent !== "home_medication_given_action" ||
        (input.request &&
            typeof input.request === "object" &&
            HOME_MEDICATION_SUBJECTS.has(
                input.request.medication_subject ?? null
            ) &&
            input.request.medication_subject ===
                (input.medication_subject ?? null) &&
            (input.request.issue === null ||
                CLARIFICATION_ISSUES.has(input.request.issue)) &&
            (input.request.administered_date === null ||
                isIsoDate(input.request.administered_date)))

    return Boolean(
        input?.schema_version === CARE_OPERATIONS_INPUT_VERSION &&
            CARE_OPERATIONS_INTENTS.has(input?.intent) &&
            isNonBlank(input?.pet_id) &&
            HOME_MEDICATION_SUBJECTS.has(
                input?.medication_subject ?? null
            ) &&
            isNonBlank(input?.display_name) &&
            isIsoDate(input?.current_care_date) &&
            isNonBlank(input?.context_fingerprint) &&
            requestIsValid &&
            !Object.hasOwn(input, "question") &&
            !Object.hasOwn(input, "conversation") &&
            !Object.hasOwn(input, "raw_text")
    )
}

function validateCareOperationsOutput(output) {
    const hasAction = output?.governed_action !== null
    const dispositionMatches = hasAction
        ? output?.run_disposition === "awaiting_human_review"
        : output?.run_disposition === "complete_no_action"
    const preparationMatches =
        output?.action_preparation?.status !== "prepared" ||
        (hasAction &&
            output.action_preparation.action?.status === "proposed")

    return Boolean(
        output &&
            RESULT_STATUSES.has(output.result_status) &&
            dispositionMatches &&
            preparationMatches &&
            output.reconciliation &&
            Number.isInteger(output.reconciliation.reminder_count) &&
            Number.isInteger(
                output.reconciliation.administration_count
            ) &&
            Number.isInteger(
                output.reconciliation.pending_action_count
            ) &&
            Array.isArray(output.evidence_ids) &&
            output.evidence_ids.length <= 12 &&
            (output.pending_human_decision === null ||
                isNonBlank(output.pending_human_decision)) &&
            isNonBlank(output.human_control_boundary) &&
            (!hasAction ||
                (isNonBlank(output.governed_action.id) &&
                    [
                        "proposed",
                        "approved",
                        "executing",
                        "outcome_unknown",
                    ].includes(output.governed_action.status) &&
                    output.governed_action.action_type ===
                        "mark_home_medication_given")) &&
            !Object.hasOwn(output, "question") &&
            !Object.hasOwn(output, "prompt") &&
            !Object.hasOwn(output, "hidden_reasoning")
    )
}

function validateCurrentState(state, input) {
    if (
        !state ||
        state.context_fingerprint !== input.context_fingerprint ||
        !Array.isArray(state.reminders) ||
        !Array.isArray(state.administrations) ||
        !Array.isArray(state.pending_actions)
    ) {
        throw new SpecialistContractError(
            "Trusted home-medication evidence changed before Care Operations could reconcile it.",
            {
                reason: "stale_evidence",
                retryable: true,
            }
        )
    }
}

function normalizePreparedAction(action) {
    if (
        !isNonBlank(action?.id) ||
        action?.status !== "proposed" ||
        action?.action_type !== "mark_home_medication_given"
    ) {
        return null
    }

    return {
        id: action.id,
        status: action.status,
        action_type: action.action_type,
        source_event_id: action.source_event_id || null,
        administered_date:
            action.preview_json?.administered_date || null,
        medication_subject: getSubject(
            action.preview_json?.care_item
        ),
        record: action,
    }
}

function findReminder(state, reminderId) {
    return (
        state.reminders.find(
            (reminder) => reminder.id === reminderId
        ) || null
    )
}

function getSubject(careItem) {
    const normalized = String(careItem || "").toLowerCase()

    if (normalized.includes("simparica")) return "simparica_trio"
    if (normalized.includes("adequan")) return "adequan"
    return null
}

function safeReason(error) {
    const allowed = new Set([
        "timeout",
        "unavailable",
        "stale_evidence",
        "partial_result",
        "permission_denied",
        "malformed_result",
    ])

    return allowed.has(error?.reason) ? error.reason : "internal_error"
}

function safeMessage(error) {
    if (typeof error?.message === "string" && error.message.trim()) {
        return error.message.trim().slice(0, 300)
    }

    return "Care Operations could not complete the reconciliation."
}

function isNonBlank(value) {
    return typeof value === "string" && Boolean(value.trim())
}

function isIsoDate(value) {
    return (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
    )
}
