import test from "node:test"
import assert from "node:assert/strict"
import { VOICE_STATES } from "./voiceInteractionState.js"
import {
    getMotionPhaseForVoiceTransition,
    getNextMotionPhase,
    TOMO_MOTION_CLIPS,
    TOMO_MOTION_PHASES,
} from "./tomoMotionSequence.js"

test("starts the pose-matched sequence when Tomo begins listening", () => {
    assert.equal(
        getMotionPhaseForVoiceTransition({
            previousVoiceState: VOICE_STATES.IDLE,
            nextVoiceState: VOICE_STATES.LISTENING,
        }),
        TOMO_MOTION_PHASES.ACKNOWLEDGING
    )
    assert.equal(
        getMotionPhaseForVoiceTransition({
            previousVoiceState: VOICE_STATES.LISTENING,
            nextVoiceState: VOICE_STATES.THINKING,
            currentPhase: TOMO_MOTION_PHASES.ACKNOWLEDGING,
        }),
        TOMO_MOTION_PHASES.ACKNOWLEDGING
    )
    assert.equal(
        getMotionPhaseForVoiceTransition({
            previousVoiceState: VOICE_STATES.THINKING,
            nextVoiceState: VOICE_STATES.IDLE,
        }),
        TOMO_MOTION_PHASES.IDLE
    )
})

test("advances acknowledgment through listening-c into thinking-b", () => {
    assert.equal(
        getNextMotionPhase({
            currentPhase: TOMO_MOTION_PHASES.ACKNOWLEDGING,
            voiceState: VOICE_STATES.LISTENING,
        }),
        TOMO_MOTION_PHASES.LISTENING_C
    )
    assert.equal(
        getNextMotionPhase({
            currentPhase: TOMO_MOTION_PHASES.LISTENING_C,
            voiceState: VOICE_STATES.THINKING,
        }),
        TOMO_MOTION_PHASES.THINKING_B
    )
    assert.equal(
        TOMO_MOTION_CLIPS[TOMO_MOTION_PHASES.LISTENING_C].src,
        "/media/tomo/motion/listening-c.mp4"
    )
})

test("plays every core local clip once so its final frame can hold", () => {
    for (const phase of [
        TOMO_MOTION_PHASES.IDLE,
        TOMO_MOTION_PHASES.ACKNOWLEDGING,
        TOMO_MOTION_PHASES.LISTENING_C,
        TOMO_MOTION_PHASES.THINKING_B,
    ]) {
        assert.equal(TOMO_MOTION_CLIPS[phase].loop, false)
    }
})

test("does not restart the active listening or thinking pose", () => {
    assert.equal(
        getMotionPhaseForVoiceTransition({
            previousVoiceState: VOICE_STATES.LISTENING,
            nextVoiceState: VOICE_STATES.LISTENING,
            currentPhase: TOMO_MOTION_PHASES.LISTENING_C,
        }),
        TOMO_MOTION_PHASES.LISTENING_C
    )
    assert.equal(
        getNextMotionPhase({
            currentPhase: TOMO_MOTION_PHASES.THINKING_B,
            voiceState: VOICE_STATES.THINKING,
        }),
        TOMO_MOTION_PHASES.THINKING_B
    )
})

test("keeps thinking footage visible until live avatar playback actually starts", () => {
    assert.equal(
        getMotionPhaseForVoiceTransition({
            previousVoiceState: VOICE_STATES.THINKING,
            nextVoiceState: VOICE_STATES.SPEAKING,
            currentPhase: TOMO_MOTION_PHASES.THINKING_B,
        }),
        TOMO_MOTION_PHASES.THINKING_B
    )
})


test("only bounded answer cues choose one-shot expressions", async () => {
    const { getReactionPhase, canShowReaction } = await import("./tomoMotionSequence.js")
    assert.equal(getReactionPhase({ id: 1, expression: "pleased" }), TOMO_MOTION_PHASES.PLEASED)
    assert.equal(getReactionPhase({ id: 2, expression: "amused" }), TOMO_MOTION_PHASES.AMUSED)
    for (const expression of ["attentive", "neutral", "https://untrusted/clip", "__proto__"]) {
        assert.equal(getReactionPhase({ id: 3, expression }), null)
    }
    assert.equal(getReactionPhase({ expression: "pleased" }), null)
    for (const state of [VOICE_STATES.LISTENING, VOICE_STATES.THINKING, VOICE_STATES.WAITING_FOR_REVIEW, VOICE_STATES.BLOCKED]) {
        assert.equal(canShowReaction(state), false)
    }
    assert.equal(canShowReaction(VOICE_STATES.IDLE), true)
    assert.equal(TOMO_MOTION_CLIPS[TOMO_MOTION_PHASES.PLEASED].loop, false)
    assert.equal(TOMO_MOTION_CLIPS[TOMO_MOTION_PHASES.AMUSED].loop, false)
})
