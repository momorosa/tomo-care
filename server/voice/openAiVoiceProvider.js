import { Buffer } from "node:buffer"
import process from "node:process"
import {
    TOMO_TRANSCRIPTION_KEYWORDS,
    TOMO_TRANSCRIPTION_PROMPT,
} from "./careVocabulary.js"
import { getTomoSpeechInstructions } from "./tomoPersonality.js"

export const DEFAULT_STT_MODEL = "gpt-transcribe"
export const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts-2025-12-15"
export const DEFAULT_TTS_VOICE = "marin"
export const MAX_VOICE_AUDIO_BYTES = 10 * 1024 * 1024

const AUDIO_FILE_EXTENSIONS = new Map([
    ["audio/mp3", "mp3"],
    ["audio/mpeg", "mp3"],
    ["audio/mp4", "mp4"],
    ["audio/m4a", "m4a"],
    ["audio/wav", "wav"],
    ["audio/webm", "webm"],
])

export class VoiceProviderError extends Error {
    constructor(message, { status = 502, reason = "voice_provider_error" } = {}) {
        super(message)
        this.name = "VoiceProviderError"
        this.status = status
        this.reason = reason
    }
}

function normalizedContentType(contentType = "") {
    return contentType.split(";")[0].trim().toLowerCase()
}

export function isSupportedVoiceAudioType(contentType) {
    return AUDIO_FILE_EXTENSIONS.has(normalizedContentType(contentType))
}

function requireApiKey(apiKey) {
    if (!apiKey) {
        throw new VoiceProviderError(
            "Voice is not configured yet. Add the OpenAI API key and restart TomoCare.",
            {
                status: 503,
                reason: "voice_not_configured",
            }
        )
    }
}

async function safeProviderFailure(response, message, reason) {
    await response.arrayBuffer().catch(() => null)
    throw new VoiceProviderError(message, {
        status: 502,
        reason,
    })
}

export function createOpenAiVoiceProvider({
    apiKey = process.env.OPENAI_API_KEY,
    sttModel = process.env.TOMO_STT_MODEL || DEFAULT_STT_MODEL,
    ttsModel = process.env.TOMO_TTS_MODEL || DEFAULT_TTS_MODEL,
    ttsVoice = process.env.TOMO_TTS_VOICE || DEFAULT_TTS_VOICE,
    fetchImpl = globalThis.fetch,
} = {}) {
    return {
        async transcribe({ audioBuffer, contentType }) {
            requireApiKey(apiKey)

            if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
                throw new VoiceProviderError(
                    "I didn’t hear anything. Try recording again.",
                    {
                        status: 422,
                        reason: "empty_audio",
                    }
                )
            }

            if (audioBuffer.length > MAX_VOICE_AUDIO_BYTES) {
                throw new VoiceProviderError(
                    "That recording is too long. Keep it under 30 seconds and try again.",
                    {
                        status: 413,
                        reason: "audio_too_large",
                    }
                )
            }

            const mimeType = normalizedContentType(contentType)
            const extension = AUDIO_FILE_EXTENSIONS.get(mimeType)

            if (!extension) {
                throw new VoiceProviderError(
                    "This browser created an audio format TomoCare cannot use.",
                    {
                        status: 415,
                        reason: "unsupported_audio_type",
                    }
                )
            }

            const form = new FormData()
            form.append(
                "file",
                new Blob([audioBuffer], { type: mimeType }),
                `tomo-question.${extension}`
            )
            form.append("model", sttModel)
            form.append("prompt", TOMO_TRANSCRIPTION_PROMPT)

            if (sttModel === DEFAULT_STT_MODEL) {
                for (const keyword of TOMO_TRANSCRIPTION_KEYWORDS) {
                    form.append("keywords[]", keyword)
                }
                form.append("languages[]", "en")
            }

            const response = await fetchImpl(
                "https://api.openai.com/v1/audio/transcriptions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: form,
                }
            )

            if (!response.ok) {
                return safeProviderFailure(
                    response,
                    "Tomo could not understand the recording right now.",
                    "transcription_failed"
                )
            }

            const data = await response.json()
            const transcript = data?.text?.trim()

            if (!transcript) {
                throw new VoiceProviderError(
                    "I couldn’t make out any words. Try recording again.",
                    {
                        status: 422,
                        reason: "empty_transcript",
                    }
                )
            }

            return transcript
        },

        async synthesize({ text, answerType }) {
            requireApiKey(apiKey)

            if (!text?.trim()) {
                throw new VoiceProviderError(
                    "There is no grounded answer to speak.",
                    {
                        status: 422,
                        reason: "empty_spoken_answer",
                    }
                )
            }

            const response = await fetchImpl(
                "https://api.openai.com/v1/audio/speech",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: ttsModel,
                        voice: ttsVoice,
                        input: text,
                        instructions: getTomoSpeechInstructions(answerType),
                        response_format: "mp3",
                    }),
                }
            )

            if (!response.ok) {
                return safeProviderFailure(
                    response,
                    "Tomo found the answer but could not speak it right now.",
                    "speech_generation_failed"
                )
            }

            return Buffer.from(await response.arrayBuffer())
        },
    }
}
