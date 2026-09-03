import test from "node:test"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { setImmediate } from "node:timers"
import {
    AVATAR_CONTROL_TOPIC,
    AVATAR_SPEECH_TOPIC,
    AVATAR_STATUS,
    AVATAR_STATUS_TOPIC,
    createAvatarStatus,
} from "../../../shared/avatarProtocol.js"
import { connectRunwayAvatar } from "./runwayAvatarClient.js"

function createSdkHarness({ connectError = null } = {}) {
    const rooms = []

    class FakeRoom {
        constructor(options) {
            this.options = options
            this.events = new Map()
            this.textHandlers = new Map()
            this.sentBytes = []
            this.sentText = []
            this.localParticipant = {
                sendBytes: async (bytes, options) => {
                    this.sentBytes.push({ bytes, options })
                },
                sendText: async (value, options) => {
                    this.sentText.push({ value, options })
                },
            }
            rooms.push(this)
        }

        registerTextStreamHandler(topic, handler) {
            this.textHandlers.set(topic, handler)
        }

        unregisterTextStreamHandler(topic) {
            this.textHandlers.delete(topic)
        }

        on(event, handler) {
            this.events.set(event, handler)
        }

        off(event, handler) {
            if (this.events.get(event) === handler) this.events.delete(event)
        }

        async connect(url, token) {
            this.connection = { url, token }
            if (connectError) throw connectError
        }

        disconnect() {
            this.disconnectCalls = (this.disconnectCalls || 0) + 1
            this.events.get("disconnected")?.()
        }

        emitDisconnected() {
            this.events.get("disconnected")?.()
        }

        emitTrack(track) {
            this.events.get("trackSubscribed")?.(track)
        }

        async emitStatus(message) {
            await this.textHandlers.get(AVATAR_STATUS_TOPIC)?.({
                async readAll() {
                    return JSON.stringify(message)
                },
            })
        }
    }

    return {
        rooms,
        sdk: {
            Room: FakeRoom,
            RoomEvent: {
                TrackSubscribed: "trackSubscribed",
                Disconnected: "disconnected",
            },
            Track: {
                Kind: { Video: "video", Audio: "audio" },
            },
        },
    }
}

const SESSION = {
    livekit_url: "wss://tomo.livekit.cloud",
    token: "browser-token",
    max_duration_seconds: 120,
}

test("connects with a short-lived token and reports avatar media tracks", async () => {
    const harness = createSdkHarness()
    const tracks = []
    let disconnected = false
    const client = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => harness.sdk,
        onVideoTrack: (track) => tracks.push(`video:${track.id}`),
        onAudioTrack: (track) => tracks.push(`audio:${track.id}`),
        onDisconnected: () => {
            disconnected = true
        },
    })
    const room = harness.rooms[0]

    room.emitTrack({ id: "v1", kind: "video" })
    room.emitTrack({ id: "a1", kind: "audio" })
    client.disconnect()

    assert.deepEqual(room.connection, {
        url: SESSION.livekit_url,
        token: SESSION.token,
    })
    assert.deepEqual(tracks, ["video:v1", "audio:a1"])
    assert.equal(disconnected, true)
})

test("sends only the finished MP3 and resolves after Runway playback", async () => {
    const harness = createSdkHarness()
    const client = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => harness.sdk,
        createId: () => "speech-123",
        fetchImpl: async () =>
            new Response(Buffer.from("safe-mp3"), {
                headers: { "Content-Type": "audio/mpeg" },
            }),
        now: (() => {
            const values = [100, 112, 120, 128, 138, 202]
            return () => values.shift()
        })(),
    })
    const room = harness.rooms[0]
    let playbackStarted = false
    const speech = client.sendSpeech(
        "data:audio/mpeg;base64,c2FmZS1tcDM=",
        {
            onPlaybackStarted: () => {
                playbackStarted = true
            },
        }
    )
    await new Promise((resolve) => setImmediate(resolve))

    await room.emitStatus(
        createAvatarStatus({
            requestId: "speech-123",
            status: AVATAR_STATUS.ACCEPTED,
        })
    )
    await room.emitStatus(
        createAvatarStatus({
            requestId: "speech-123",
            status: AVATAR_STATUS.PLAYING,
        })
    )
    assert.equal(playbackStarted, true)
    await room.emitStatus(
        createAvatarStatus({
            requestId: "speech-123",
            status: AVATAR_STATUS.COMPLETED,
        })
    )

    assert.deepEqual(await speech, {
        status: AVATAR_STATUS.COMPLETED,
        timings: {
            audio_prepare_ms: 12,
            speech_transfer_ms: 8,
            avatar_startup_ms: 18,
            avatar_playback_ms: 64,
            avatar_total_ms: 102,
        },
    })
    assert.equal(room.sentBytes.length, 1)
    assert.equal(room.sentBytes[0].options.topic, AVATAR_SPEECH_TOPIC)
    assert.equal(room.sentBytes[0].options.mimeType, "audio/mpeg")
    assert.equal(
        Buffer.from(room.sentBytes[0].bytes).toString(),
        "safe-mp3"
    )
})

test("sends a bounded stop control without replaying audio locally", async () => {
    const harness = createSdkHarness()
    const client = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => harness.sdk,
        createId: () => "speech-stop",
        fetchImpl: async () => new Response(Buffer.from("safe-mp3")),
    })
    const room = harness.rooms[0]
    const speech = client.sendSpeech("data:audio/mpeg;base64,c2FmZS1tcDM=")
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(await client.stopSpeech(), true)
    assert.equal(room.sentText[0].options.topic, AVATAR_CONTROL_TOPIC)
    await room.emitStatus(
        createAvatarStatus({
            requestId: "speech-stop",
            status: AVATAR_STATUS.INTERRUPTED,
        })
    )
    assert.equal((await speech).status, AVATAR_STATUS.INTERRUPTED)
})

test("reports an unexpected disconnect and completely releases client resources", async () => {
    const harness = createSdkHarness()
    const disconnects = []
    const detached = []
    const client = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => harness.sdk,
        createId: () => "speech-disconnect",
        fetchImpl: async () => new Response(Buffer.from("safe-mp3")),
        onDisconnected: (outcome) => disconnects.push(outcome),
    })
    const room = harness.rooms[0]
    room.emitTrack({
        id: "v1",
        kind: "video",
        detach: () => detached.push("video"),
    })
    room.emitTrack({
        id: "a1",
        kind: "audio",
        detach: () => detached.push("audio"),
    })
    const speech = client.sendSpeech("data:audio/mpeg;base64,c2FmZS1tcDM=")
    await new Promise((resolve) => setImmediate(resolve))

    room.emitDisconnected()

    await assert.rejects(
        speech,
        (error) => error.reason === "avatar_disconnected"
    )
    assert.deepEqual(disconnects, [{ reason: "avatar_disconnected" }])
    assert.deepEqual(detached, ["video", "audio"])
    assert.equal(room.textHandlers.has(AVATAR_STATUS_TOPIC), false)
    assert.equal(room.events.size, 0)
})

test("keeps intentional ending typed and separate from an unexpected disconnect", async () => {
    const harness = createSdkHarness()
    const disconnects = []
    const client = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => harness.sdk,
        onDisconnected: (outcome) => disconnects.push(outcome),
    })
    const room = harness.rooms[0]

    client.disconnect({ reason: "user_ended" })
    client.disconnect({ reason: "avatar_disconnected" })

    assert.deepEqual(disconnects, [{ reason: "user_ended" }])
    assert.equal(room.disconnectCalls, 1)
})

test("maps unknown status and transfer failures to safe typed playback errors", async () => {
    const statusHarness = createSdkHarness()
    const statusClient = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => statusHarness.sdk,
        createId: () => "speech-unknown",
        fetchImpl: async () => new Response(Buffer.from("safe-mp3")),
    })
    const statusSpeech = statusClient.sendSpeech(
        "data:audio/mpeg;base64,c2FmZS1tcDM="
    )
    await new Promise((resolve) => setImmediate(resolve))
    await statusHarness.rooms[0].emitStatus(
        createAvatarStatus({
            requestId: "speech-unknown",
            status: AVATAR_STATUS.FAILED,
            reason: "private provider stack trace",
        })
    )

    await assert.rejects(
        statusSpeech,
        (error) =>
            error.reason === "avatar_playback_failed" &&
            !error.message.includes("private provider")
    )

    const transferHarness = createSdkHarness()
    const transferClient = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => transferHarness.sdk,
        createId: () => "speech-transfer",
        fetchImpl: async () => new Response(Buffer.from("safe-mp3")),
    })
    transferHarness.rooms[0].localParticipant.sendBytes = async () => {
        throw new Error("private LiveKit failure")
    }

    await assert.rejects(
        transferClient.sendSpeech("data:audio/mpeg;base64,c2FmZS1tcDM="),
        (error) =>
            error.reason === "avatar_playback_failed" &&
            !error.message.includes("LiveKit")
    )
})

test("bounds live playback with a typed timeout", async () => {
    const harness = createSdkHarness()
    const client = await connectRunwayAvatar({
        session: SESSION,
        loadSdk: async () => harness.sdk,
        createId: () => "speech-timeout",
        fetchImpl: async () => new Response(Buffer.from("safe-mp3")),
        speechTimeoutMs: 5,
    })

    await assert.rejects(
        client.sendSpeech("data:audio/mpeg;base64,c2FmZS1tcDM="),
        (error) => error.reason === "avatar_playback_timeout"
    )
})

test("cleans a partial connection and hides raw SDK failures", async () => {
    const harness = createSdkHarness({
        connectError: new Error("private SDK connection details"),
    })

    await assert.rejects(
        connectRunwayAvatar({
            session: SESSION,
            loadSdk: async () => harness.sdk,
        }),
        (error) =>
            error.reason === "avatar_session_failed" &&
            !error.message.includes("private SDK")
    )
    assert.equal(harness.rooms[0].disconnectCalls, 1)
    assert.equal(harness.rooms[0].events.size, 0)
    assert.equal(
        harness.rooms[0].textHandlers.has(AVATAR_STATUS_TOPIC),
        false
    )
})
