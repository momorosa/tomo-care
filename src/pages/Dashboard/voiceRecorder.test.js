import test from "node:test"
import assert from "node:assert/strict"
import {
    calculateAudioLevel,
    createSpeechEndDetector,
    DEFAULT_SILENCE_MS,
    isVoiceCaptureSupported,
    requestMicrophone,
    selectSupportedAudioType,
    startSilenceDetection,
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

test("measures silence and audible samples without storing audio", () => {
    assert.equal(calculateAudioLevel(new Uint8Array([128, 128, 128])), 0)
    assert.ok(calculateAudioLevel(new Uint8Array([64, 192])) > 0.4)
})

test("does not auto-stop before speech is detected", () => {
    const detector = createSpeechEndDetector()

    assert.deepEqual(detector.observe(0, 0), {
        heardSpeech: false,
        shouldStop: false,
    })
    assert.deepEqual(detector.observe(0, DEFAULT_SILENCE_MS * 2), {
        heardSpeech: false,
        shouldStop: false,
    })
})

test("auto-stops after speech followed by a short pause", () => {
    const detector = createSpeechEndDetector()

    detector.observe(0.05, 0)
    detector.observe(0.05, 16)
    const speechState = detector.observe(0.05, 32)
    const pauseState = detector.observe(
        0,
        32 + DEFAULT_SILENCE_MS
    )

    assert.equal(speechState.heardSpeech, true)
    assert.equal(speechState.shouldStop, false)
    assert.deepEqual(pauseState, {
        heardSpeech: true,
        shouldStop: true,
    })
})

test("ignores a brief noise spike before real speech", () => {
    const detector = createSpeechEndDetector()

    detector.observe(0.08, 0)
    detector.observe(0, 16)
    detector.observe(0, DEFAULT_SILENCE_MS * 2)

    assert.deepEqual(detector.observe(0, DEFAULT_SILENCE_MS * 3), {
        heardSpeech: false,
        shouldStop: false,
    })
})

test("connects browser audio analysis to the silence callback", () => {
    const stream = { id: "stream-1" }
    let frameCallback
    let silenceCalls = 0
    let sourceDisconnected = false
    let analyserDisconnected = false
    let contextClosed = false

    const source = {
        connect() {},
        disconnect() {
            sourceDisconnected = true
        },
    }
    const analyser = {
        fftSize: 0,
        getByteTimeDomainData(samples) {
            samples.fill(128)
        },
        disconnect() {
            analyserDisconnected = true
        },
    }

    class AudioContextClass {
        createMediaStreamSource(nextStream) {
            assert.equal(nextStream, stream)
            return source
        }

        createAnalyser() {
            return analyser
        }

        resume() {
            return Promise.resolve()
        }

        close() {
            contextClosed = true
            return Promise.resolve()
        }
    }

    const cleanup = startSilenceDetection(stream, {
        onSilence() {
            silenceCalls += 1
        },
        AudioContextClass,
        requestFrame(callback) {
            frameCallback = callback
            return 7
        },
        cancelFrame() {},
        detector: {
            observe() {
                return {
                    heardSpeech: true,
                    shouldStop: true,
                }
            },
        },
    })

    frameCallback(100)
    cleanup()

    assert.equal(silenceCalls, 1)
    assert.equal(sourceDisconnected, true)
    assert.equal(analyserDisconnected, true)
    assert.equal(contextClosed, true)
})
