import test from "node:test"
import assert from "node:assert/strict"
import {
    AVATAR_VOICE_PLAYBACK,
    playVoiceWithAvatarFallback,
} from "./avatarVoiceFallback.js"

test("uses the live avatar without duplicating audio locally", async () => {
    let localCalls = 0
    const avatarResult = { status: "completed" }
    const result = await playVoiceWithAvatarFallback({
        avatarReady: true,
        playAvatar: async () => avatarResult,
        playLocal: async () => {
            localCalls += 1
        },
    })

    assert.equal(result.mode, AVATAR_VOICE_PLAYBACK.AVATAR)
    assert.equal(result.result, avatarResult)
    assert.equal(localCalls, 0)
})

test("plays the existing local audio exactly once after avatar failure", async () => {
    let localCalls = 0
    const result = await playVoiceWithAvatarFallback({
        avatarReady: true,
        playAvatar: async () => {
            throw new Error("raw provider failure")
        },
        playLocal: async () => {
            localCalls += 1
        },
    })

    assert.equal(result.mode, AVATAR_VOICE_PLAYBACK.LOCAL)
    assert.equal(localCalls, 1)
})

test("does not revive stale playback after Stop, Replay, Clear, or a newer answer", async () => {
    let current = true
    let releaseAvatar
    let localCalls = 0
    const avatarPlayback = new Promise((_, reject) => {
        releaseAvatar = reject
    })
    const task = playVoiceWithAvatarFallback({
        avatarReady: true,
        playAvatar: () => avatarPlayback,
        playLocal: async () => {
            localCalls += 1
        },
        isCurrent: () => current,
    })

    current = false
    releaseAvatar(new Error("late disconnect"))

    assert.equal((await task).mode, AVATAR_VOICE_PLAYBACK.CANCELLED)
    assert.equal(localCalls, 0)
})
