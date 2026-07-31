import test from "node:test"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { answerVoiceQuestion } from "./voiceQuery.js"

function createVoiceProvider() {
    const calls = []

    return {
        calls,
        async transcribe(input) {
            calls.push({ method: "transcribe", input })
            return "I gave Simparica today."
        },
        async synthesize(input) {
            calls.push({ method: "synthesize", input })
            return Buffer.from("safe-mp3")
        },
    }
}

test("sends the visible transcript through the shared grounded assistant", async () => {
    const voiceProvider = createVoiceProvider()
    const answerCalls = []
    const result = await answerVoiceQuestion({
        petId: "pet-1",
        audioBuffer: Buffer.from("raw-audio"),
        contentType: "audio/webm",
        dependencies: {
            voiceProvider,
            answerQuestion: async (input) => {
                answerCalls.push(input)
                return {
                    answer_type: "grounded_answer",
                    answer: "Momo’s last verified Simparica dose was July 20.",
                    citations: [
                        {
                            type: "trusted_event",
                            id: "event-1",
                        },
                    ],
                }
            },
        },
    })

    assert.deepEqual(answerCalls, [
        {
            petId: "pet-1",
            question: "I gave Simparica today.",
        },
    ])
    assert.equal(result.transcript, "I gave Simparica today.")
    assert.equal(
        result.interpreted_transcript,
        "I gave Simparica today."
    )
    assert.deepEqual(result.transcript_corrections, [])
    assert.equal(
        result.answer,
        "Momo’s last verified Simparica dose was July 20."
    )
    assert.equal(result.citations[0].id, "event-1")
    assert.equal(result.voice.content_type, "audio/mpeg")
    assert.equal(
        Buffer.from(result.voice.audio_base64, "base64").toString(),
        "safe-mp3"
    )
    assert.doesNotMatch(JSON.stringify(result), /raw-audio/)
})

test("uses a safe care-term interpretation while preserving what was heard", async () => {
    const answerCalls = []
    const result = await answerVoiceQuestion({
        petId: "pet-1",
        audioBuffer: Buffer.from("raw-audio"),
        contentType: "audio/webm",
        dependencies: {
            voiceProvider: {
                async transcribe() {
                    return "How much have I spent on Librella?"
                },
                async synthesize() {
                    return Buffer.from("safe-mp3")
                },
            },
            answerQuestion: async (input) => {
                answerCalls.push(input)
                return {
                    answer_type: "grounded_answer",
                    answer: "You have spent $100 on verified Librela items.",
                    citations: [{ type: "cost_item", id: "cost-1" }],
                }
            },
        },
    })

    assert.deepEqual(answerCalls, [
        {
            petId: "pet-1",
            question: "How much have I spent on Librela?",
        },
    ])
    assert.equal(
        result.transcript,
        "How much have I spent on Librella?"
    )
    assert.equal(
        result.interpreted_transcript,
        "How much have I spent on Librela?"
    )
    assert.deepEqual(result.transcript_corrections, [
        {
            heard: "Librella",
            interpreted_as: "Librela",
        },
    ])
})

test("a voice action request can prepare review but cannot approve or execute", async () => {
    const voiceProvider = createVoiceProvider()
    let sharedAssistantCalls = 0
    const result = await answerVoiceQuestion({
        petId: "pet-1",
        audioBuffer: Buffer.from("raw-audio"),
        contentType: "audio/webm",
        dependencies: {
            voiceProvider,
            answerQuestion: async () => {
                sharedAssistantCalls += 1
                return {
                    answer_type: "action_prepared",
                    answer: "I prepared Momo’s medication update.",
                    proposed_action: {
                        id: "action-1",
                        status: "proposed",
                    },
                    citations: [],
                }
            },
        },
    })

    assert.equal(sharedAssistantCalls, 1)
    assert.equal(result.proposed_action.status, "proposed")
    assert.match(
        result.spoken_answer,
        /Nothing changes until you approve it\./
    )
    assert.equal(
        voiceProvider.calls.filter((call) => call.method === "synthesize")
            .length,
        1
    )
    assert.equal("approval" in result, false)
    assert.equal("execution" in result, false)
})

test("keeps the grounded answer visible when speech generation fails", async () => {
    const voiceProvider = {
        async transcribe() {
            return "When was Momo’s last Librela shot?"
        },
        async synthesize() {
            const err = new Error(
                "Tomo found the answer but could not speak it right now."
            )
            err.reason = "speech_generation_failed"
            throw err
        },
    }

    const result = await answerVoiceQuestion({
        petId: "pet-1",
        audioBuffer: Buffer.from("raw-audio"),
        contentType: "audio/webm",
        dependencies: {
            voiceProvider,
            answerQuestion: async () => ({
                answer_type: "grounded_answer",
                answer: "Momo’s last verified Librela injection was June 10.",
                citations: [{ type: "trusted_event", id: "event-1" }],
            }),
        },
    })

    assert.equal(
        result.answer,
        "Momo’s last verified Librela injection was June 10."
    )
    assert.equal(result.citations[0].id, "event-1")
    assert.equal(result.voice.audio_base64, null)
    assert.equal(
        result.voice.speech_error.reason,
        "speech_generation_failed"
    )
})
