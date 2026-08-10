import { VOICE_STATES } from "./voiceInteractionState.js"

export const TOMO_MOTION_PHASES = Object.freeze({
    IDLE: "idle-a",
    LISTENING_A: "listening-a",
    LISTENING_B: "listening-b",
    LISTENING_C: "listening-c",
    ACKNOWLEDGING: "acknowledging-a",
    THINKING_A: "thinking-a",
    THINKING_B: "thinking-b",
})

export const TOMO_MOTION_TRANSITION_MS = Object.freeze({
    COVER: 100,
    REVEAL: 120,
})

export const TOMO_MOTION_CLIPS = Object.freeze({
    [TOMO_MOTION_PHASES.IDLE]: {
        src: "/media/tomo/motion/idle-a.mp4",
        loop: false,
    },
    [TOMO_MOTION_PHASES.LISTENING_A]: {
        src: "/media/tomo/motion/listening-a.mp4",
        fallbackSrc: "/media/tomo/motion/Tomo-Listening.mp4",
        loop: false,
    },
    [TOMO_MOTION_PHASES.LISTENING_B]: {
        src: "/media/tomo/motion/listening-b.mp4",
        loop: false,
    },
    [TOMO_MOTION_PHASES.LISTENING_C]: {
        src: "/media/tomo/motion/listening-c.mp4",
        loop: false,
    },
    [TOMO_MOTION_PHASES.ACKNOWLEDGING]: {
        src: "/media/tomo/motion/acknowledging-a.mp4",
        loop: false,
    },
    [TOMO_MOTION_PHASES.THINKING_A]: {
        src: "/media/tomo/motion/thinking-a.mp4",
        loop: false,
    },
    [TOMO_MOTION_PHASES.THINKING_B]: {
        src: "/media/tomo/motion/thinking-b.mp4",
        loop: false,
    },
})

const ACTIVE_PHASES = new Set([
    TOMO_MOTION_PHASES.ACKNOWLEDGING,
    TOMO_MOTION_PHASES.LISTENING_C,
    TOMO_MOTION_PHASES.THINKING_B,
])

export function getMotionPhaseForVoiceTransition({
    nextVoiceState,
    currentPhase = TOMO_MOTION_PHASES.IDLE,
}) {
    if (nextVoiceState === VOICE_STATES.LISTENING) {
        return ACTIVE_PHASES.has(currentPhase)
            ? currentPhase
            : TOMO_MOTION_PHASES.ACKNOWLEDGING
    }

    if (nextVoiceState === VOICE_STATES.THINKING) {
        if (currentPhase === TOMO_MOTION_PHASES.ACKNOWLEDGING) {
            return currentPhase
        }

        return TOMO_MOTION_PHASES.THINKING_B
    }

    if (
        nextVoiceState === VOICE_STATES.SPEAKING &&
        ACTIVE_PHASES.has(currentPhase)
    ) {
        return currentPhase
    }

    return TOMO_MOTION_PHASES.IDLE
}

export function getNextMotionPhase({ currentPhase, voiceState }) {
    if (
        currentPhase === TOMO_MOTION_PHASES.ACKNOWLEDGING &&
        (voiceState === VOICE_STATES.LISTENING ||
            voiceState === VOICE_STATES.THINKING ||
            voiceState === VOICE_STATES.SPEAKING)
    ) {
        return TOMO_MOTION_PHASES.LISTENING_C
    }

    if (
        currentPhase === TOMO_MOTION_PHASES.LISTENING_C &&
        (voiceState === VOICE_STATES.THINKING ||
            voiceState === VOICE_STATES.SPEAKING)
    ) {
        return TOMO_MOTION_PHASES.THINKING_B
    }

    return currentPhase
}
