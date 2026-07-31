import express from "express"
import {
    answerAssistantQuestion,
    AssistantServiceError,
} from "../assistant/assistantService.js"

const router = express.Router()

router.post("/pets/:petId/assistant/query", async (req, res) => {
    const { petId } = req.params
    const {
        question,
        evaluationMode,
        conversationContext,
    } = req.body || {}

    try {
        const response = await answerAssistantQuestion({
            petId,
            question,
            evaluationMode,
            conversationContext,
        })

        res.json(response)
    } catch (err) {
        if (err instanceof AssistantServiceError) {
            return res.status(err.status).json({
                error: err.message,
                reason: err.reason,
            })
        }

        console.error("[assistant] query failed:", err)
        return res.status(500).json({
            error: err?.message || "Assistant query failed.",
        })
    }
})

export default router
