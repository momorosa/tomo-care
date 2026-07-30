export const VOICE_STATES = Object.freeze({
    IDLE: "idle",
    LISTENING: "listening",
    THINKING: "thinking",
    SPEAKING: "speaking",
    WAITING_FOR_REVIEW: "waiting_for_review",
    BLOCKED: "blocked",
})

const VOICE_STATE_LABELS = Object.freeze({
    [VOICE_STATES.IDLE]: "Tomo is ready",
    [VOICE_STATES.LISTENING]: "Tomo is listening",
    [VOICE_STATES.THINKING]: "Tomo is checking trusted records",
    [VOICE_STATES.SPEAKING]: "Tomo is speaking",
    [VOICE_STATES.WAITING_FOR_REVIEW]: "Tomo is waiting for your review",
    [VOICE_STATES.BLOCKED]: "Tomo needs your attention",
})

export function getVoiceStateLabel(state) {
    return VOICE_STATE_LABELS[state] || VOICE_STATE_LABELS[VOICE_STATES.IDLE]
}

export function getVoiceStateAfterAnswer({ willSpeak, requiresReview }) {
    if (willSpeak) return VOICE_STATES.SPEAKING
    if (requiresReview) return VOICE_STATES.WAITING_FOR_REVIEW
    return VOICE_STATES.IDLE
}

export function getVoiceStateAfterPlayback({ requiresReview }) {
    return requiresReview
        ? VOICE_STATES.WAITING_FOR_REVIEW
        : VOICE_STATES.IDLE
}