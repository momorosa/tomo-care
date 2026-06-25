import express from "express"
import { buildQueryPlan } from "../assistant/queryPlanner.js"
import { buildTrustedContext } from "../assistant/contextBuilder.js"
import { composeGroundedAnswer } from "../assistant/answerComposer.js"

const router = express.Router()

router.post("/pets/:petId/assistant/query", async (req, res) => {
    const { petId } = req.params
    const { question } = req.body || {}

    if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question is required." })
    }

    try {
        const queryPlan = buildQueryPlan(question)
        const context = await buildTrustedContext(petId)

        const response = composeGroundedAnswer({
            question,
            queryPlan,
            context,
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