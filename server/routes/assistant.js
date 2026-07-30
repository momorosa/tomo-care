import express from "express"
import { buildQueryPlan } from "../assistant/queryPlanner.js"
import { buildTrustedContext } from "../assistant/contextBuilder.js"
import { composeGroundedAnswer } from "../assistant/answerComposer.js"
import { prepareAssistantHomeMedicationAction } from "../assistant/homeMedicationAction.js"
import { coordinateLibrelaAppointmentRequest } from "../orchestration/librelaAppointmentCoordinator.js"
import { isReadOnlyEvaluationBlocked } from "../assistant/evalAssertions.js"
import { getCareDate } from "../lib/careDates.js"
import { careActionRepository } from "../repositories/careActionRepository.js"

const router = express.Router()
const ASSISTANT_CARE_ACTOR = "Rosa"

router.post("/pets/:petId/assistant/query", async (req, res) => {
    const { petId } = req.params
    const { question, evaluationMode } = req.body || {}

    if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question is required." })
    }

    try {
        const currentCareDate = getCareDate()
        const queryPlan = buildQueryPlan(question, { currentCareDate })

        if (
            isReadOnlyEvaluationBlocked({
                evaluationMode,
                queryPlan,
            })
        ) {
            return res.status(409).json({
                error:
                    "Read-only assistant evals cannot prepare a care action.",
                reason: "read_only_eval_action_blocked",
            })
        }

        const context = await buildTrustedContext(petId)
        const actionPreparation =
            queryPlan.intent === "home_medication_given_action"
                ? await prepareAssistantHomeMedicationAction({
                      repository: careActionRepository,
                      petId,
                      queryPlan,
                      context,
                      requestedBy: ASSISTANT_CARE_ACTOR,
                      currentCareDate,
                  })
                : null
        const messageDraftPreparation =
            queryPlan.intent === "librela_appointment_message"
                ? coordinateLibrelaAppointmentRequest({
                      context,
                      currentCareDate,
                      senderName: ASSISTANT_CARE_ACTOR,
                      petName: "Momo",
                  })
                : null

        const response = composeGroundedAnswer({
            question,
            queryPlan,
            context,
            actionPreparation,
            messageDraftPreparation,
        })

        res.json(response)
    } catch (err) {
        console.error("[assistant] query failed:", err)
        res.status(500).json({
            error: err?.message || "Assistant query failed.",
        })
    }
})

export default router
