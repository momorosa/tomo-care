import test from "node:test"
import assert from "node:assert/strict"
import {
    createVoiceLatencySummary,
    mergeAvatarLatency,
    reportVoiceLatency,
} from "./voiceLatency.js"

test("combines server stages with browser round-trip latency", () => {
    assert.deepEqual(
        createVoiceLatencySummary({
            serverTimings: {
                transcription_ms: 120,
                answer_generation_ms: 240,
                speech_generation_ms: 310,
                server_total_ms: 670,
            },
            requestStartedAt: 1000,
            responseReceivedAt: 1725,
        }),
        {
            transcription_ms: 120,
            answer_generation_ms: 240,
            speech_generation_ms: 310,
            server_total_ms: 670,
            voice_round_trip_ms: 725,
            network_and_serialization_ms: 55,
        }
    )
})

test("reports numeric-only timing data without conversation content", () => {
    const calls = []
    const merged = mergeAvatarLatency(
        { transcription_ms: 120, transcript: "private words" },
        { speech_transfer_ms: 18, request_id: "private-id" }
    )

    reportVoiceLatency(merged, (...args) => calls.push(args))

    assert.deepEqual(merged, {
        transcription_ms: 120,
        speech_transfer_ms: 18,
    })
    assert.deepEqual(calls, [["[Tomo latency]", merged]])
})

