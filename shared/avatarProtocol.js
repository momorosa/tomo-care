export const AVATAR_SPEECH_TOPIC = "tomo.avatar.speech.v1"
export const AVATAR_STATUS_TOPIC = "tomo.avatar.status.v1"
export const AVATAR_CONTROL_TOPIC = "tomo.avatar.control.v1"

export const AVATAR_STATUS = Object.freeze({
    ACCEPTED: "accepted",
    PLAYING: "playing",
    COMPLETED: "completed",
    FAILED: "failed",
    INTERRUPTED: "interrupted",
})

export const AVATAR_CONTROL = Object.freeze({
    STOP: "stop",
})

export const MAX_AVATAR_SPEECH_BYTES = 3 * 1024 * 1024

export function createAvatarStatus({ requestId, status, reason = null }) {
    return {
        type: "avatar_speech_status",
        request_id: requestId,
        status,
        reason,
    }
}

export function createAvatarControl({ requestId, action }) {
    return {
        type: "avatar_speech_control",
        request_id: requestId,
        action,
    }
}

export function parseAvatarMessage(value) {
    if (typeof value !== "string" || !value.trim()) return null

    try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === "object" ? parsed : null
    } catch {
        return null
    }
}
