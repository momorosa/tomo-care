import test from "node:test"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { setImmediate } from "node:timers"
import {
    AVATAR_CONTROL,
    AVATAR_STATUS,
} from "../../shared/avatarProtocol.js"
import { createAvatarSpeechReceiver } from "./runwayAvatarAgent.js"

function createHarness({ maxSpeechBytes } = {}) {
    const sent = []
    const session = {
        sayCalls: [],
        say(text, options) {
            const handle = {
                interrupted: false,
                interrupt() {
                    this.interrupted = true
                },
                async waitForPlayout() {},
            }
            this.sayCalls.push({ text, options, handle })
            return handle
        },
    }
    const room = {
        localParticipant: {
            async sendText(value, options) {
                sent.push({ message: JSON.parse(value), options })
            },
        },
    }
    const cleaned = []
    const receiver = createAvatarSpeechReceiver({
        session,
        room,
        decodeAudio: (filePath, options) => ({ filePath, options }),
        createTemporaryFile: async (bytes) => ({
            filePath: "/tmp/tomo-test.mp3",
            async cleanup() {
                cleaned.push(bytes.length)
            },
        }),
        maxSpeechBytes,
    })

    return { receiver, session, sent, cleaned }
}

function speechReader({ bytes = Buffer.from("mp3"), mimeType = "audio/mpeg" } = {}) {
    return {
        info: {
            mimeType,
            attributes: { requestId: "speech-1" },
        },
        async readAll() {
            return [bytes]
        },
    }
}

test("forwards only synthesized audio through the Runway session", async () => {
    const { receiver, session, sent, cleaned } = createHarness()

    await receiver.handleSpeech(speechReader(), { identity: "tomo-user" })

    assert.equal(session.sayCalls.length, 1)
    assert.equal(session.sayCalls[0].text, "")
    assert.equal(session.sayCalls[0].options.addToChatCtx, false)
    assert.deepEqual(
        sent.map((entry) => entry.message.status),
        [AVATAR_STATUS.ACCEPTED, AVATAR_STATUS.COMPLETED]
    )
    assert.deepEqual(cleaned, [3])
})

test("rejects unsupported or oversized speech before avatar playback", async () => {
    const { receiver, session, sent } = createHarness({ maxSpeechBytes: 3 })

    await receiver.handleSpeech(
        speechReader({ mimeType: "application/json" }),
        { identity: "tomo-user" }
    )
    await receiver.handleSpeech(
        speechReader({ bytes: Buffer.alloc(4) }),
        { identity: "tomo-user" }
    )

    assert.equal(session.sayCalls.length, 0)
    assert.equal(sent[0].message.status, AVATAR_STATUS.FAILED)
    assert.equal(sent[0].message.reason, "unsupported_audio")
    assert.equal(sent[1].message.reason, "audio_too_large")
})

test("lets the same browser participant interrupt its active speech", async () => {
    const { receiver, session, sent } = createHarness()
    let releasePlayback
    const playback = new Promise((resolve) => {
        releasePlayback = resolve
    })
    session.say = function say(text, options) {
        const handle = {
            interrupted: false,
            interrupt() {
                this.interrupted = true
                releasePlayback()
            },
            waitForPlayout() {
                return playback
            },
        }
        this.sayCalls.push({ text, options, handle })
        return handle
    }

    const speechTask = receiver.handleSpeech(speechReader(), {
        identity: "tomo-user",
    })
    await new Promise((resolve) => setImmediate(resolve))
    await receiver.handleControl(
        {
            async readAll() {
                return JSON.stringify({
                    request_id: "speech-1",
                    action: AVATAR_CONTROL.STOP,
                })
            },
        },
        { identity: "tomo-user" }
    )
    await speechTask

    assert.equal(session.sayCalls[0].handle.interrupted, true)
    assert.equal(sent.at(-1).message.status, AVATAR_STATUS.INTERRUPTED)
})
