import express from "express"
import {
    answerAssistantQuestion,
    AssistantServiceError,
} from "../assistant/assistantService.js"
import {
    isSupportedVoiceAudioType,
    VoiceProviderError,
} from "../voice/openAiVoiceProvider.js"
import { answerVoiceQuestion } from "../voice/voiceQuery.js"

const router = express.Router()

const parseVoiceAudio = express.raw({
    type: (req) => isSupportedVoiceAudioType(req.headers["content-type"]),
    limit: "10mb",
})

router.post(
    "/pets/:petId/assistant/voice",
    parseVoiceAudio,
    async (req, res) => {
        const contentType = req.headers["content-type"] || ""

        if (!isSupportedVoiceAudioType(contentType)) {
            return res.status(415).json({
                error:
                    "This browser created an audio format TomoCare cannot use.",
                reason: "unsupported_audio_type",
            })
        }

        try {
            const response = await answerVoiceQuestion({
                petId: req.params.petId,
                audioBuffer: req.body,
                contentType,
                dependencies: {
                    answerQuestion: answerAssistantQuestion,
                },
            })

            return res.json(response)
        } catch (err) {
            if (
                err instanceof VoiceProviderError ||
                err instanceof AssistantServiceError
            ) {
                return res.status(err.status).json({
                    error: err.message,
                    reason: err.reason,
                })
            }

            console.error("[voice] request failed:", {
                name: err?.name || "Error",
                message: err?.message || "Voice request failed",
            })
            return res.status(500).json({
                error: "TomoCare could not answer by voice right now.",
                reason: "voice_request_failed",
            })
        }
    }
)

router.use((err, req, res, next) => {
    if (err?.type === "entity.too.large") {
        return res.status(413).json({
            error:
                "That recording is too long. Keep it under 30 seconds and try again.",
            reason: "audio_too_large",
        })
    }

    return next(err)
})

export default router