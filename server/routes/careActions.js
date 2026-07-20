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
import { careActionRepository } from "../repositories/careActionRepository.js"

const router = express.Router()

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
            message:
                result.disposition === "executed"
                    ? "Medication recorded and the next reminder prepared."
                    : "This medication was already recorded and the next reminder is ready.",
            execution: {
                action_id: result.actionId,
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

export default router


