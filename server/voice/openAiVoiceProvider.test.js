import test from "node:test"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import {
    createOpenAiVoiceProvider,
    DEFAULT_STT_MODEL,
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_VOICE,
    VoiceProviderError,
} from "./openAiVoiceProvider.js"

test("transcribes bounded WebM audio with the configured server credential", async () => {
    const requests = []
    const provider = createOpenAiVoiceProvider({
        apiKey: "server-only-test-key",
        fetchImpl: async (url, options) => {
            requests.push({ url, options })
            return Response.json({ text: "When was Momo’s last shot?" })
        },
    })

    const transcript = await provider.transcribe({
        audioBuffer: Buffer.from("bounded-audio"),
        contentType: "audio/webm;codecs=opus",
    })

    assert.equal(transcript, "When was Momo’s last shot?")
    assert.equal(
        requests[0].url,
        "https://api.openai.com/v1/audio/transcriptions"
    )
    assert.equal(
        requests[0].options.headers.Authorization,
        "Bearer server-only-test-key"
    )
    assert.equal(requests[0].options.body.get("model"), DEFAULT_STT_MODEL)
    assert.equal(
        requests[0].options.body.get("file").type,
        "audio/webm"
    )
    assert.match(
        requests[0].options.body.get("prompt"),
        /Momo’s pet care/
    )
    assert.deepEqual(
        requests[0].options.body.getAll("keywords[]"),
        [
            "Momo",
            "Tomo",
            "Librela",
            "Simparica Trio",
            "Adequan",
            "SoMa Animal Hospital",
        ]
    )
    assert.deepEqual(
        requests[0].options.body.getAll("languages[]"),
        ["en"]
    )
})

test("synthesizes MP3 using the pinned Tomo voice defaults", async () => {
    let request
    const provider = createOpenAiVoiceProvider({
        apiKey: "server-only-test-key",
        fetchImpl: async (url, options) => {
            request = { url, options }
            return new Response(Buffer.from("mp3-audio"), {
                status: 200,
                headers: { "Content-Type": "audio/mpeg" },
            })
        },
    })

    const audio = await provider.synthesize({
        text: "Momo’s last verified injection was June 10.",
        answerType: "grounded_answer",
        personalityMode: "relational",
    })
    const body = JSON.parse(request.options.body)

    assert.equal(request.url, "https://api.openai.com/v1/audio/speech")
    assert.equal(body.model, DEFAULT_TTS_MODEL)
    assert.equal(body.voice, DEFAULT_TTS_VOICE)
    assert.equal(body.response_format, "mp3")
    assert.match(body.instructions, /Do not add, omit, or paraphrase/)
    assert.equal(audio.toString(), "mp3-audio")
})

test("uses restrained speech delivery for sensitive answers", async () => {
    let request
    const provider = createOpenAiVoiceProvider({
        apiKey: "server-only-test-key",
        fetchImpl: async (url, options) => {
            request = { url, options }
            return new Response(Buffer.from("mp3-audio"), {
                status: 200,
                headers: { "Content-Type": "audio/mpeg" },
            })
        },
    })

    await provider.synthesize({
        text: "I can summarize the verified trend, but a vet must interpret it.",
        answerType: "grounded_answer",
        personalityMode: "restrained",
    })

    const body = JSON.parse(request.options.body)
    assert.match(body.instructions, /calm, clear, and restrained/)
    assert.doesNotMatch(body.instructions, /lightly playful/)
})

test("rejects empty audio before making a provider call", async () => {
    let providerCalled = false
    const provider = createOpenAiVoiceProvider({
        apiKey: "server-only-test-key",
        fetchImpl: async () => {
            providerCalled = true
            return Response.json({})
        },
    })

    await assert.rejects(
        () =>
            provider.transcribe({
                audioBuffer: Buffer.alloc(0),
                contentType: "audio/webm",
            }),
        (err) =>
            err instanceof VoiceProviderError &&
            err.reason === "empty_audio" &&
            err.status === 422
    )
    assert.equal(providerCalled, false)
})

test("returns a safe error for an empty or unintelligible transcript", async () => {
    const provider = createOpenAiVoiceProvider({
        apiKey: "server-only-test-key",
        fetchImpl: async () => Response.json({ text: "   " }),
    })

    await assert.rejects(
        () =>
            provider.transcribe({
                audioBuffer: Buffer.from("silence"),
                contentType: "audio/webm",
            }),
        (err) =>
            err instanceof VoiceProviderError &&
            err.reason === "empty_transcript"
    )
})

test("does not expose provider response details on failure", async () => {
    const provider = createOpenAiVoiceProvider({
        apiKey: "server-only-test-key",
        fetchImpl: async () =>
            Response.json(
                {
                    error: {
                        message:
                            "private provider request detail and server-only-test-key",
                    },
                },
                { status: 429 }
            ),
    })

    await assert.rejects(
        () =>
            provider.transcribe({
                audioBuffer: Buffer.from("audio"),
                contentType: "audio/webm",
            }),
        (err) => {
            assert.equal(err.reason, "transcription_failed")
            assert.doesNotMatch(err.message, /private|server-only-test-key/)
            return true
        }
    )
})

test("requires server voice configuration without leaking a credential", async () => {
    const provider = createOpenAiVoiceProvider({ apiKey: "" })

    await assert.rejects(
        () =>
            provider.transcribe({
                audioBuffer: Buffer.from("audio"),
                contentType: "audio/webm",
            }),
        (err) =>
            err.reason === "voice_not_configured" && err.status === 503
    )
})
