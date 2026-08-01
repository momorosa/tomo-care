import { createOpenAiVoiceProvider } from "./openAiVoiceProvider.js"
import { composeSpokenAnswer } from "./spokenAnswer.js"
import { TOMO_AI_VOICE_DISCLOSURE } from "./tomoPersonality.js"
import { interpretCareTranscript } from "./careVocabulary.js"

export async function answerVoiceQuestion({
    petId,
    audioBuffer,
    contentType,
    conversationContext,
    dependencies = {},
}) {
    const voiceProvider =
        dependencies.voiceProvider || createOpenAiVoiceProvider()
    const answerQuestion = dependencies.answerQuestion
    const composeSpeech =
        dependencies.composeSpeech || composeSpokenAnswer

    if (typeof answerQuestion !== "function") {
        throw new TypeError("answerQuestion dependency is required.")
    }

    const transcript = await voiceProvider.transcribe({
        audioBuffer,
        contentType,
    })
    const transcriptInterpretation = interpretCareTranscript(transcript)
    const assistantInput = {
        petId,
        question: transcriptInterpretation.interpreted,
    }

    if (conversationContext) {
        assistantInput.conversationContext = conversationContext
    }

    const assistantResponse = await answerQuestion(assistantInput)
    const spokenAnswer = composeSpeech(assistantResponse)
    let audio = null
    let speechError = null

    try {
        audio = await voiceProvider.synthesize({
            text: spokenAnswer,
            answerType: assistantResponse.answer_type,
            personalityMode: assistantResponse.personality?.mode,
        })
    } catch (err) {
        speechError = {
            error:
                err?.message ||
                "Tomo found the answer but could not speak it right now.",
            reason: err?.reason || "speech_generation_failed",
        }
    }

    return {
        ...assistantResponse,
        transcript: transcriptInterpretation.original,
        interpreted_transcript: transcriptInterpretation.interpreted,
        transcript_corrections: transcriptInterpretation.corrections,
        spoken_answer: spokenAnswer,
        voice: {
            audio_base64: audio?.toString("base64") || null,
            content_type: "audio/mpeg",
            disclosure: TOMO_AI_VOICE_DISCLOSURE,
            speech_error: speechError,
        },
    }
}
