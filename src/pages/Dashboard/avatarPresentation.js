export const AVATAR_PRESENTATION_STATES = Object.freeze({
    LOCAL_ONLY: "local_only",
    STARTING: "starting",
    READY: "ready",
    ENDED: "ended",
    FAILED: "failed",
})

export const AVATAR_PRESENTATION_REASONS = Object.freeze({
    REDUCED_MOTION: "reduced_motion",
    USER_ENDED: "user_ended",
    SESSION_EXPIRED: "session_expired",
    AVATAR_DISABLED: "avatar_disabled",
    AVATAR_NOT_CONFIGURED: "avatar_not_configured",
    AVATAR_SESSION_FAILED: "avatar_session_failed",
    INVALID_AVATAR_SESSION: "invalid_avatar_session",
    AVATAR_STARTUP_TIMEOUT: "avatar_startup_timeout",
    AVATAR_DISCONNECTED: "avatar_disconnected",
    AVATAR_AUDIO_UNAVAILABLE: "avatar_audio_unavailable",
    EMPTY_AUDIO: "empty_audio",
    AUDIO_TOO_LARGE: "audio_too_large",
    UNSUPPORTED_AUDIO: "unsupported_audio",
    AVATAR_PLAYBACK_FAILED: "avatar_playback_failed",
    AVATAR_PLAYBACK_TIMEOUT: "avatar_playback_timeout",
    UNKNOWN_FAILURE: "avatar_unknown_failure",
})

const ALLOWED_REASONS = new Set(Object.values(AVATAR_PRESENTATION_REASONS))

const STARTUP_REASONS = new Set([
    AVATAR_PRESENTATION_REASONS.AVATAR_SESSION_FAILED,
    AVATAR_PRESENTATION_REASONS.INVALID_AVATAR_SESSION,
    AVATAR_PRESENTATION_REASONS.AVATAR_STARTUP_TIMEOUT,
])

const PLAYBACK_REASONS = new Set([
    AVATAR_PRESENTATION_REASONS.AVATAR_AUDIO_UNAVAILABLE,
    AVATAR_PRESENTATION_REASONS.EMPTY_AUDIO,
    AVATAR_PRESENTATION_REASONS.AUDIO_TOO_LARGE,
    AVATAR_PRESENTATION_REASONS.UNSUPPORTED_AUDIO,
    AVATAR_PRESENTATION_REASONS.AVATAR_PLAYBACK_FAILED,
    AVATAR_PRESENTATION_REASONS.AVATAR_PLAYBACK_TIMEOUT,
])

export function normalizeAvatarPresentationReason(
    reason,
    fallback = AVATAR_PRESENTATION_REASONS.UNKNOWN_FAILURE
) {
    return ALLOWED_REASONS.has(reason) ? reason : fallback
}

function action(kind, label, disabled = false) {
    return { kind, label, disabled }
}

export function getAvatarPresentation({
    state = AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
    reason = null,
} = {}) {
    const safeReason = reason
        ? normalizeAvatarPresentationReason(reason)
        : null

    if (state === AVATAR_PRESENTATION_STATES.STARTING) {
        return {
            state,
            reason: null,
            title: "Starting live animation…",
            description: "Tomo’s local Voice stays available while this connects.",
            tone: "neutral",
            retryable: false,
            action: null,
        }
    }

    if (state === AVATAR_PRESENTATION_STATES.READY) {
        return {
            state,
            reason: null,
            title: null,
            description: null,
            tone: "neutral",
            retryable: false,
            action: action("end", "End live animation"),
        }
    }

    if (state === AVATAR_PRESENTATION_STATES.ENDED) {
        const expired =
            safeReason === AVATAR_PRESENTATION_REASONS.SESSION_EXPIRED

        return {
            state,
            reason: expired
                ? AVATAR_PRESENTATION_REASONS.SESSION_EXPIRED
                : AVATAR_PRESENTATION_REASONS.USER_ENDED,
            title: expired
                ? "Live animation session ended"
                : "Live animation ended",
            description: expired
                ? "Tomo is using local Voice. Start a new session when you want."
                : "Tomo is using local Voice.",
            tone: "neutral",
            retryable: expired,
            action: expired
                ? action("retry", "Start animation again")
                : action("start", "Animate Tomo"),
        }
    }

    if (state === AVATAR_PRESENTATION_STATES.FAILED) {
        if (safeReason === AVATAR_PRESENTATION_REASONS.AVATAR_DISCONNECTED) {
            return {
                state,
                reason: safeReason,
                title: "Live animation disconnected",
                description: "Tomo switched back to local Voice.",
                tone: "warning",
                retryable: true,
                action: action("retry", "Try animation again"),
            }
        }

        if (PLAYBACK_REASONS.has(safeReason)) {
            return {
                state,
                reason: safeReason,
                title: "This answer couldn’t finish in live animation",
                description: "Tomo is continuing with local Voice.",
                tone: "warning",
                retryable: true,
                action: action("retry", "Try animation again"),
            }
        }

        return {
            state,
            reason: STARTUP_REASONS.has(safeReason)
                ? safeReason
                : AVATAR_PRESENTATION_REASONS.UNKNOWN_FAILURE,
            title: "Live animation couldn’t start",
            description: "Tomo’s local Voice still works.",
            tone: "warning",
            retryable: true,
            action: action("retry", "Try animation again"),
        }
    }

    if (safeReason === AVATAR_PRESENTATION_REASONS.REDUCED_MOTION) {
        return {
            state: AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
            reason: safeReason,
            title: "Live animation is off",
            description: "Reduce Motion is enabled. Tomo’s local Voice still works.",
            tone: "neutral",
            retryable: false,
            action: action("start", "Animate Tomo", true),
        }
    }

    if (
        safeReason === AVATAR_PRESENTATION_REASONS.AVATAR_DISABLED ||
        safeReason === AVATAR_PRESENTATION_REASONS.AVATAR_NOT_CONFIGURED
    ) {
        return {
            state: AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
            reason: safeReason,
            title: "Live animation is unavailable",
            description: "Tomo’s local Voice still works.",
            tone: "neutral",
            retryable: false,
            action: null,
        }
    }

    return {
        state: AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
        reason: null,
        title: null,
        description: null,
        tone: "neutral",
        retryable: false,
        action: action("start", "Animate Tomo"),
    }
}
