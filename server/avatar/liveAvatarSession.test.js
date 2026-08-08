import test from "node:test"
import assert from "node:assert/strict"
import {
    AvatarConfigurationError,
    createLiveAvatarSession,
    getLiveAvatarConfig,
    RUNWAY_MAX_DURATION_SECONDS,
} from "./liveAvatarSession.js"

const COMPLETE_ENV = {
    TOMO_RUNWAY_ENABLED: "true",
    TOMO_RUNWAY_AVATAR_ID: "avatar-123",
    TOMO_RUNWAY_MAX_DURATION_SECONDS: "120",
    RUNWAYML_API_SECRET: "runway-secret",
    LIVEKIT_URL: "wss://tomo.livekit.cloud",
    LIVEKIT_API_KEY: "livekit-key",
    LIVEKIT_API_SECRET: "livekit-secret",
}

test("keeps live animation feature-gated and validates configuration", () => {
    assert.equal(getLiveAvatarConfig({}).enabled, false)
    assert.throws(
        () => getLiveAvatarConfig({ TOMO_RUNWAY_ENABLED: "true" }),
        (err) =>
            err instanceof AvatarConfigurationError &&
            err.reason === "avatar_not_configured" &&
            !err.message.includes("secret")
    )
})

test("caps a configured session at Runway’s five-minute maximum", () => {
    const config = getLiveAvatarConfig({
        ...COMPLETE_ENV,
        TOMO_RUNWAY_MAX_DURATION_SECONDS: "999",
    })

    assert.equal(config.maxDurationSeconds, RUNWAY_MAX_DURATION_SECONDS)
})

test("creates a short-lived room token without returning provider secrets", async () => {
    const calls = []

    class FakeAccessToken {
        constructor(key, secret, options) {
            calls.push({ key, secret, options })
        }

        addGrant(grant) {
            calls[0].grant = grant
        }

        async toJwt() {
            return "signed-browser-token"
        }
    }

    const result = await createLiveAvatarSession({
        env: COMPLETE_ENV,
        createId: () => "session-123",
        AccessTokenClass: FakeAccessToken,
    })

    assert.deepEqual(result, {
        enabled: true,
        livekit_url: "wss://tomo.livekit.cloud",
        token: "signed-browser-token",
        room_name: "tomo-avatar-session-123",
        max_duration_seconds: 120,
    })
    assert.equal(calls[0].options.identity, "tomo-user-session-123")
    assert.equal(calls[0].grant.canPublish, false)
    assert.equal(calls[0].grant.canPublishData, true)
    assert.equal(JSON.stringify(result).includes("secret"), false)
})
