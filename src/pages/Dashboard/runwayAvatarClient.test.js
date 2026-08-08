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

function createSdkHarness() {
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

        on(event, handler) {
            this.events.set(event, handler)
        }

        async connect(url, token) {
            this.connection = { url, token }
        }

        disconnect() {
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
    })
    const room = harness.rooms[0]
    const speech = client.sendSpeech("data:audio/mpeg;base64,c2FmZS1tcDM=")
    await new Promise((resolve) => setImmediate(resolve))

    await room.emitStatus(
        createAvatarStatus({
            requestId: "speech-123",
            status: AVATAR_STATUS.COMPLETED,
        })
    )

    assert.deepEqual(await speech, { status: AVATAR_STATUS.COMPLETED })
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
    assert.deepEqual(await speech, { status: AVATAR_STATUS.INTERRUPTED })
})
