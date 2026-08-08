import { randomUUID } from "node:crypto"
import process from "node:process"
import { AccessToken } from "livekit-server-sdk"

export const DEFAULT_AVATAR_MAX_DURATION_SECONDS = 120
export const RUNWAY_MAX_DURATION_SECONDS = 300

export class AvatarConfigurationError extends Error {
    constructor(message, reason = "avatar_not_configured") {
        super(message)
        this.name = "AvatarConfigurationError"
        this.status = 503
        this.reason = reason
    }
}

function isEnabled(value) {
    return String(value || "").trim().toLowerCase() === "true"
}

function boundedDuration(value) {
    const parsed = Number.parseInt(value, 10)

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_AVATAR_MAX_DURATION_SECONDS
    }

    return Math.min(parsed, RUNWAY_MAX_DURATION_SECONDS)
}

export function getLiveAvatarConfig(env = process.env) {
    const enabled = isEnabled(env.TOMO_RUNWAY_ENABLED)
    const config = {
        enabled,
        avatarId: env.TOMO_RUNWAY_AVATAR_ID?.trim() || "",
        runwayApiSecret: env.RUNWAYML_API_SECRET?.trim() || "",
        livekitUrl: env.LIVEKIT_URL?.trim() || "",
        livekitApiKey: env.LIVEKIT_API_KEY?.trim() || "",
        livekitApiSecret: env.LIVEKIT_API_SECRET?.trim() || "",
        maxDurationSeconds: boundedDuration(
            env.TOMO_RUNWAY_MAX_DURATION_SECONDS
        ),
    }

    if (!enabled) return config

    const missing = [
        ["TOMO_RUNWAY_AVATAR_ID", config.avatarId],
        ["RUNWAYML_API_SECRET", config.runwayApiSecret],
        ["LIVEKIT_URL", config.livekitUrl],
        ["LIVEKIT_API_KEY", config.livekitApiKey],
        ["LIVEKIT_API_SECRET", config.livekitApiSecret],
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name)

    if (missing.length > 0) {
        throw new AvatarConfigurationError(
            "Live animation is not configured yet. Add the missing provider settings and restart TomoCare."
        )
    }

    return config
}

export async function createLiveAvatarSession({
    env = process.env,
    createId = randomUUID,
    AccessTokenClass = AccessToken,
} = {}) {
    const config = getLiveAvatarConfig(env)

    if (!config.enabled) {
        throw new AvatarConfigurationError(
            "Live animation is turned off for this environment.",
            "avatar_disabled"
        )
    }

    const sessionId = createId()
    const roomName = `tomo-avatar-${sessionId}`
    const participantIdentity = `tomo-user-${sessionId}`
    const token = new AccessTokenClass(
        config.livekitApiKey,
        config.livekitApiSecret,
        {
            identity: participantIdentity,
            name: "TomoCare",
            ttl: config.maxDurationSeconds + 90,
        }
    )

    token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: false,
        canPublishData: true,
        canSubscribe: true,
    })

    return {
        enabled: true,
        livekit_url: config.livekitUrl,
        token: await token.toJwt(),
        room_name: roomName,
        max_duration_seconds: config.maxDurationSeconds,
    }
}
