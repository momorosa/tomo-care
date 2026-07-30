import test from "node:test"
import assert from "node:assert/strict"
import {
    isVoiceCaptureSupported,
    requestMicrophone,
    selectSupportedAudioType,
    VoiceCaptureError,
} from "./voiceRecorder.js"

test("accepts microphone permission and requests audio only", async () => {
    const stream = { id: "stream-1" }
    let constraints
    const result = await requestMicrophone({
        async getUserMedia(nextConstraints) {
            constraints = nextConstraints
            return stream
        },
    })

    assert.equal(result, stream)
    assert.deepEqual(constraints, {
        audio: true,
        video: false,
    })
})

test("maps denied microphone permission to a recoverable typed fallback", async () => {
    await assert.rejects(
        () =>
            requestMicrophone({
                async getUserMedia() {
                    const err = new Error("denied")
                    err.name = "NotAllowedError"
                    throw err
                },
            }),
        (err) =>
            err instanceof VoiceCaptureError &&
            err.reason === "microphone_denied" &&
            /keep typing/i.test(err.message)
    )
})

test("detects unsupported voice capture without touching the microphone", () => {
    assert.equal(
        isVoiceCaptureSupported({
            mediaDevices: {},
            MediaRecorderClass: class {},
        }),
        false
    )
})

test("selects the first recording format supported by the browser", () => {
    const MediaRecorderClass = {
        isTypeSupported(type) {
            return type === "audio/webm"
        },
    }

    assert.equal(
        selectSupportedAudioType(MediaRecorderClass),
        "audio/webm"
    )
})