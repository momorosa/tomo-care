import express from "express"
import {
    ActionPreparationError,
    prepareMarkHomeMedicationGiven,
} from "../actions/prepareHomeMedicationGiven.js"
import {
    ActionApprovalError,
    approveCareAction,
} from "../actions/approveCareAction.js"
import {
    ActionExecutionError,
    executeCareAction,
} from "../actions/executeCareAction.js"
import {
    ActionCancellationError,
    cancelCareAction,
} from "../actions/cancelCareAction.js"
import {
    InsuranceClaimPreparationError,
    prepareMarkInsuranceClaimFiled,
} from "../actions/prepareInsuranceClaimFiled.js"
import { MARK_HOME_MEDICATION_GIVEN } from "../actions/homeMedicationGiven.js"
import { MARK_INSURANCE_CLAIM_FILED } from "../actions/insuranceClaimFiled.js"
import { listPendingCareActions } from "../actions/listPendingCareActions.js"
import { careActionRepository } from "../repositories/careActionRepository.js"

const router = express.Router()

// GET /api/pets/:petId/care-actions/pending
//
// Returns the server-owned set of actions that still need review, execution,
// or recovery. The dashboard uses this rather than presenting a boolean as a
// count.
router.get("/pets/:petId/care-actions/pending", async (req, res) => {
    const { petId } = req.params

    try {
        const result = await listPendingCareActions({
            repository: careActionRepository,
            petId,
        })

        return res.json({
            ok: true,
            pending_count: result.count,
            pending_actions: result.actions,
        })
    } catch (error) {
        console.error("[care-action:pending] error:", error)

        return res.status(500).json({
            ok: false,
            reason: "pending_action_lookup_failed",
            error: "Failed to load pending care actions.",
        })
    }
})

// GET /api/care-actions/:actionId
//
// Reloads the server-owned action ledger so the dashboard can recover after
// a refresh or an interrupted approval/execution request.
router.get("/care-actions/:actionId", async (req, res) => {
    const { actionId } = req.params

    try {
        const action = await careActionRepository.findActionById(actionId)

        if (!action) {
            return res.status(404).json({
                ok: false,
                reason: "action_not_found",
                error: "The care action was not found.",
            })
        }

        return res.json({
            ok: true,
            care_action: action,
        })
    } catch (error) {
        console.error("[care-action:get] error:", error)

        return res.status(500).json({
            ok: false,
            reason: "action_lookup_failed",
            error: "Failed to load the care action.",
        })
    }
})

// POST /api/pets/:petId/actions/home-medication-given/prepare
//
// This route can only prepare a proposal. It does not update the source
// reminder, create a medication event, or schedule the next reminder.
router.post(
    "/pets/:petId/actions/home-medication-given/prepare",
    async (req, res) => {
        const { petId } = req.params
        const { reminderId, administeredDate, requestedBy } = req.body || {}

        try {
            const result = await prepareMarkHomeMedicationGiven({
                repository: careActionRepository,
                petId,
                reminderId,
                administeredDate,
                requestSource: "dashboard",
                requestedBy,
            })

            return res.status(result.disposition === "created" ? 201 : 200).json({
                ok: true,
                disposition: result.disposition,
                message:
                    result.disposition === "created"
                        ? "Medication confirmation prepared for approval."
                        : "This medication confirmation is already awaiting action.",
                proposed_action: result.action,
            })
        } catch (error) {
            if (error instanceof ActionPreparationError) {
                return res.status(error.status).json({
                    ok: false,
                    reason: error.reason,
                    error: error.message,
                })
            }

            console.error("[home-medication-given:prepare] error:", error)

            return res.status(500).json({
                ok: false,
                reason: "preparation_failed",
                error: "Failed to prepare the medication confirmation.",
            })
        }
    }
)

// POST /api/pets/:petId/actions/insurance-claim-filed/prepare
//
// This route prepares a frozen two-change proposal. It does not create a
// claim-submission event, complete the reminder, or change Google Calendar.
router.post(
    "/pets/:petId/actions/insurance-claim-filed/prepare",
    async (req, res) => {
        const { petId } = req.params
        const { reminderId, filedDate, requestedBy } = req.body || {}

        try {
            const result = await prepareMarkInsuranceClaimFiled({
                repository: careActionRepository,
                petId,
                reminderId,
                filedDate,
                requestSource: "dashboard",
                requestedBy,
            })

            return res.status(result.disposition === "created" ? 201 : 200).json({
                ok: true,
                disposition: result.disposition,
                message:
                    result.disposition === "created"
                        ? "Insurance claim filing prepared for approval."
                        : "This insurance claim filing is already awaiting action.",
                proposed_action: result.action,
            })
        } catch (error) {
            if (error instanceof InsuranceClaimPreparationError) {
                return res.status(error.status).json({
                    ok: false,
                    reason: error.reason,
                    error: error.message,
                })
            }

            console.error("[insurance-claim-filed:prepare] error:", error)

            return res.status(500).json({
                ok: false,
                reason: "preparation_failed",
                error: "Failed to prepare the insurance claim filing.",
            })
        }
    }
)

// POST /api/care-actions/:actionId/approve
//
// Approval records explicit human consent. Execution remains a separate
// operation so this endpoint cannot mutate trusted care history.
router.post("/care-actions/:actionId/approve", async (req, res) => {
    const { actionId } = req.params
    const { approvedBy } = req.body || {}

    try {
        const result = await approveCareAction({
            repository: careActionRepository,
            actionId,
            approvedBy,
        })

        return res.json({
            ok: true,
            disposition: result.disposition,
            message:
                result.disposition === "approved"
                    ? "Care action approved. It has not been executed yet."
                    : "This care action was already approved and has not been executed yet.",
            approved_action: result.action,
        })
    } catch (error) {
        if (error instanceof ActionApprovalError) {
            return res.status(error.status).json({
                ok: false,
                reason: error.reason,
                error: error.message,
            })
        }

        console.error("[care-action:approve] error:", error)

        return res.status(500).json({
            ok: false,
            reason: "approval_failed",
            error: "Failed to approve the care action.",
        })
    }
})

// POST /api/care-actions/:actionId/cancel
//
// Cancellation only retires a proposal. It cannot undo an approval or a
// completed action, and it never mutates Momo's trusted care records.
router.post("/care-actions/:actionId/cancel", async (req, res) => {
    const { actionId } = req.params

    try {
        const result = await cancelCareAction({
            repository: careActionRepository,
            actionId,
        })

        return res.json({
            ok: true,
            disposition: result.disposition,
            message:
                result.disposition === "cancelled"
                    ? "Care action proposal cancelled. Nothing was changed."
                    : "This care action proposal was already cancelled.",
            cancelled_action: result.action,
        })
    } catch (error) {
        if (error instanceof ActionCancellationError) {
            return res.status(error.status).json({
                ok: false,
                reason: error.reason,
                error: error.message,
            })
        }

        console.error("[care-action:cancel] error:", error)

        return res.status(500).json({
            ok: false,
            reason: "cancellation_failed",
            error: "Failed to cancel the care action proposal.",
        })
    }
})

// POST /api/care-actions/:actionId/execute
//
// The browser supplies only the action identity. The backend supplies the
// care date and execution actor, while PostgreSQL executes the frozen,
// approved payload atomically.
router.post("/care-actions/:actionId/execute", async (req, res) => {
    const { actionId } = req.params

    try {
        const result = await executeCareAction({
            repository: careActionRepository,
            actionId,
        })

        return res.json({
            ok: true,
            disposition: result.disposition,
            message: getExecutionMessage(result),
            execution: {
                action_id: result.actionId,
                action_type: result.actionType,
                status: result.status,
                result: result.result,
            },
        })
    } catch (error) {
        if (error instanceof ActionExecutionError) {
            return res.status(error.status).json({
                ok: false,
                reason: error.reason,
                error: error.message,
                recovery: error.recovery,
                retryable: error.retryable,
                outcome_unknown: error.outcomeUnknown,
            })
        }

        console.error("[care-action:execute] error:", error)

        return res.status(503).json({
            ok: false,
            reason: "execution_outcome_unknown",
            error:
                "TomoCare couldn’t confirm whether the update finished. Refresh Momo’s records or try again; a retry will not create a duplicate.",
            recovery: "refresh_or_retry",
            retryable: true,
            outcome_unknown: true,
        })
    }
})

function getExecutionMessage({ actionType, disposition }) {
    const wasExecuted = disposition === "executed"

    if (actionType === MARK_HOME_MEDICATION_GIVEN) {
        return wasExecuted
            ? "Medication recorded and the next reminder prepared."
            : "This medication was already recorded and the next reminder is ready."
    }

    if (actionType === MARK_INSURANCE_CLAIM_FILED) {
        return wasExecuted
            ? "Insurance claim recorded as filed and the reminder completed."
            : "This insurance claim was already recorded as filed and the reminder is complete."
    }

    return wasExecuted
        ? "Care action completed."
        : "This care action was already completed."
}

export default router
