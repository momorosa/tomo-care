import express from "express"
import { buildQueryPlan } from "../assistant/queryPlanner.js"
import { buildTrustedContext } from "../assistant/contextBuilder.js"
import { composeGroundedAnswer } from "../assistant/answerComposer.js"
import { prepareAssistantHomeMedicationAction } from "../assistant/homeMedicationAction.js"
import { getCareDate } from "../lib/careDates.js"
import { careActionRepository } from "../repositories/careActionRepository.js"

const router = express.Router()
const ASSISTANT_CARE_ACTOR = "Rosa"

router.post("/pets/:petId/assistant/query", async (req, res) => {
    const { petId } = req.params
    const { question } = req.body || {}

    if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question is required." })
    }

    try {
        const currentCareDate = getCareDate()
        const queryPlan = buildQueryPlan(question, { currentCareDate })
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

        const response = composeGroundedAnswer({
            question,
            queryPlan,
            context,
            actionPreparation,
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