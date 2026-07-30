import test from "node:test"
import assert from "node:assert/strict"
import {
    getVoiceStateAfterAnswer,
    getVoiceStateAfterPlayback,
    getVoiceStateLabel,
    VOICE_STATES,
} from "./voiceInteractionState.js"

test("distinguishes every Tomo interaction state with readable status", () => {
    assert.deepEqual(Object.values(VOICE_STATES), [
        "idle",
        "listening",
        "thinking",
        "speaking",
        "waiting_for_review",
        "blocked",
    ])

    for (const state of Object.values(VOICE_STATES)) {
        assert.match(getVoiceStateLabel(state), /^Tomo /)
    }
})

test("spoken playback temporarily owns the visible state", () => {
    assert.equal(
        getVoiceStateAfterAnswer({
            willSpeak: true,
            requiresReview: true,
        }),
        VOICE_STATES.SPEAKING
    )
    assert.equal(
        getVoiceStateAfterPlayback({ requiresReview: true }),
        VOICE_STATES.WAITING_FOR_REVIEW
    )
})

test("a grounded answer returns to idle when no review is waiting", () => {
    assert.equal(
        getVoiceStateAfterAnswer({
            willSpeak: false,
            requiresReview: false,
        }),
        VOICE_STATES.IDLE
    )
})