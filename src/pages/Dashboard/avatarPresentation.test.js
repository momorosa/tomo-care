import test from "node:test"
import assert from "node:assert/strict"
import {
    AVATAR_PRESENTATION_REASONS,
    AVATAR_PRESENTATION_STATES,
    getAvatarPresentation,
    normalizeAvatarPresentationReason,
} from "./avatarPresentation.js"

test("maps startup, disconnect, expiry, and playback outcomes to bounded recovery", () => {
    const startup = getAvatarPresentation({
        state: AVATAR_PRESENTATION_STATES.FAILED,
        reason: AVATAR_PRESENTATION_REASONS.AVATAR_STARTUP_TIMEOUT,
    })
    const disconnected = getAvatarPresentation({
        state: AVATAR_PRESENTATION_STATES.FAILED,
        reason: AVATAR_PRESENTATION_REASONS.AVATAR_DISCONNECTED,
    })
    const expired = getAvatarPresentation({
        state: AVATAR_PRESENTATION_STATES.ENDED,
        reason: AVATAR_PRESENTATION_REASONS.SESSION_EXPIRED,
    })
    const playback = getAvatarPresentation({
        state: AVATAR_PRESENTATION_STATES.FAILED,
        reason: AVATAR_PRESENTATION_REASONS.AVATAR_PLAYBACK_FAILED,
    })

    assert.deepEqual(
        [startup, disconnected, playback].map((value) => ({
            retryable: value.retryable,
            label: value.action.label,
        })),
        [
            { retryable: true, label: "Try animation again" },
            { retryable: true, label: "Try animation again" },
            { retryable: true, label: "Try animation again" },
        ]
    )
    assert.equal(expired.retryable, true)
    assert.equal(expired.action.label, "Start animation again")
    assert.match(expired.description, /local Voice/)
})

test("maps every supported startup and playback reason deterministically", () => {
    const startupReasons = [
        AVATAR_PRESENTATION_REASONS.AVATAR_SESSION_FAILED,
        AVATAR_PRESENTATION_REASONS.INVALID_AVATAR_SESSION,
        AVATAR_PRESENTATION_REASONS.AVATAR_STARTUP_TIMEOUT,
    ]
    const playbackReasons = [
        AVATAR_PRESENTATION_REASONS.AVATAR_AUDIO_UNAVAILABLE,
        AVATAR_PRESENTATION_REASONS.EMPTY_AUDIO,
        AVATAR_PRESENTATION_REASONS.AUDIO_TOO_LARGE,
        AVATAR_PRESENTATION_REASONS.UNSUPPORTED_AUDIO,
        AVATAR_PRESENTATION_REASONS.AVATAR_PLAYBACK_FAILED,
        AVATAR_PRESENTATION_REASONS.AVATAR_PLAYBACK_TIMEOUT,
    ]

    for (const reason of startupReasons) {
        const result = getAvatarPresentation({
            state: AVATAR_PRESENTATION_STATES.FAILED,
            reason,
        })
        assert.equal(result.reason, reason)
        assert.equal(result.title, "Live animation couldn’t start")
        assert.equal(result.retryable, true)
    }

    for (const reason of playbackReasons) {
        const result = getAvatarPresentation({
            state: AVATAR_PRESENTATION_STATES.FAILED,
            reason,
        })
        assert.equal(result.reason, reason)
        assert.match(result.title, /answer/)
        assert.equal(result.retryable, true)
    }
})

test("keeps intentional ending separate from failure", () => {
    const result = getAvatarPresentation({
        state: AVATAR_PRESENTATION_STATES.ENDED,
        reason: AVATAR_PRESENTATION_REASONS.USER_ENDED,
    })

    assert.equal(result.reason, AVATAR_PRESENTATION_REASONS.USER_ENDED)
    assert.equal(result.retryable, false)
    assert.equal(result.tone, "neutral")
    assert.equal(result.action.label, "Animate Tomo")
})

test("treats configuration and Reduce Motion as non-retryable local states", () => {
    for (const reason of [
        AVATAR_PRESENTATION_REASONS.AVATAR_DISABLED,
        AVATAR_PRESENTATION_REASONS.AVATAR_NOT_CONFIGURED,
        AVATAR_PRESENTATION_REASONS.REDUCED_MOTION,
    ]) {
        const result = getAvatarPresentation({
            state: AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
            reason,
        })

        assert.equal(result.state, AVATAR_PRESENTATION_STATES.LOCAL_ONLY)
        assert.equal(result.retryable, false)
        assert.match(result.description, /local Voice/)
        assert.notEqual(result.action?.kind, "retry")
    }
})

test("replaces unknown provider content with one generic safe reason", () => {
    const rawProviderMessage = "credential=private patient=Momo provider stack trace"
    const normalized = normalizeAvatarPresentationReason(rawProviderMessage)
    const result = getAvatarPresentation({
        state: AVATAR_PRESENTATION_STATES.FAILED,
        reason: rawProviderMessage,
    })

    assert.equal(
        normalized,
        AVATAR_PRESENTATION_REASONS.UNKNOWN_FAILURE
    )
    assert.equal(result.reason, AVATAR_PRESENTATION_REASONS.UNKNOWN_FAILURE)
    assert.equal(JSON.stringify(result).includes(rawProviderMessage), false)
})
