export class VoiceCaptureError extends Error {
    constructor(message, reason) {
        super(message)
        this.name = "VoiceCaptureError"
        this.reason = reason
    }
}

export const DEFAULT_SILENCE_MS = 1_200
export const DEFAULT_SPEECH_THRESHOLD = 0.02
export const DEFAULT_SPEECH_FRAMES = 3

export function isVoiceCaptureSupported({
    mediaDevices = globalThis.navigator?.mediaDevices,
    MediaRecorderClass = globalThis.MediaRecorder,
} = {}) {
    return Boolean(mediaDevices?.getUserMedia && MediaRecorderClass)
}

export function selectSupportedAudioType(
    MediaRecorderClass = globalThis.MediaRecorder
) {
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
    ]

    return (
        candidates.find((type) =>
            MediaRecorderClass?.isTypeSupported?.(type)
        ) || ""
    )
}

export async function requestMicrophone(
    mediaDevices = globalThis.navigator?.mediaDevices
) {
    if (!mediaDevices?.getUserMedia) {
        throw new VoiceCaptureError(
            "Voice recording is not supported in this browser. You can still type to Tomo.",
            "microphone_unsupported"
        )
    }

    try {
        return await mediaDevices.getUserMedia({
            audio: true,
            video: false,
        })
    } catch (err) {
        if (
            err?.name === "NotAllowedError" ||
            err?.name === "SecurityError"
        ) {
            throw new VoiceCaptureError(
                "Microphone access is blocked. Allow it in your browser settings, or keep typing to Tomo.",
                "microphone_denied"
            )
        }

        throw new VoiceCaptureError(
            "TomoCare could not open the microphone. You can still type your question.",
            "microphone_unavailable"
        )
    }
}

export function calculateAudioLevel(samples) {
    if (!samples?.length) return 0

    let squareSum = 0

    for (const sample of samples) {
        const centeredSample = (sample - 128) / 128
        squareSum += centeredSample * centeredSample
    }

    return Math.sqrt(squareSum / samples.length)
}

export function createSpeechEndDetector({
    speechThreshold = DEFAULT_SPEECH_THRESHOLD,
    speechFrames = DEFAULT_SPEECH_FRAMES,
    silenceMs = DEFAULT_SILENCE_MS,
} = {}) {
    let consecutiveSpeechFrames = 0
    let heardSpeech = false
    let lastSpeechAt = null
    let stopped = false

    return {
        observe(level, now) {
            if (stopped) {
                return { heardSpeech, shouldStop: true }
            }

            if (level >= speechThreshold) {
                consecutiveSpeechFrames += 1
                lastSpeechAt = now

                if (consecutiveSpeechFrames >= speechFrames) {
                    heardSpeech = true
                }
            } else if (!heardSpeech) {
                consecutiveSpeechFrames = 0
            }

            const shouldStop =
                heardSpeech &&
                lastSpeechAt !== null &&
                now - lastSpeechAt >= silenceMs

            if (shouldStop) stopped = true

            return { heardSpeech, shouldStop }
        },
    }
}

export function startSilenceDetection(
    stream,
    {
        onSilence,
        AudioContextClass =
            globalThis.AudioContext || globalThis.webkitAudioContext,
        requestFrame = globalThis.requestAnimationFrame,
        cancelFrame = globalThis.cancelAnimationFrame,
        detector = createSpeechEndDetector(),
    } = {}
) {
    if (
        !stream ||
        typeof onSilence !== "function" ||
        !AudioContextClass ||
        typeof requestFrame !== "function"
    ) {
        return () => {}
    }

    const audioContext = new AudioContextClass()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2_048
    source.connect(analyser)

    const samples = new Uint8Array(analyser.fftSize)
    let frameId = null
    let active = true

    function inspectFrame(now) {
        if (!active) return

        analyser.getByteTimeDomainData(samples)
        const state = detector.observe(calculateAudioLevel(samples), now)

        if (state.shouldStop) {
            active = false
            onSilence()
            return
        }

        frameId = requestFrame(inspectFrame)
    }

    const resumeResult = audioContext.resume?.()
    resumeResult?.catch?.(() => null)
    frameId = requestFrame(inspectFrame)

    return () => {
        if (!active && frameId === null) return

        active = false
        if (frameId !== null && typeof cancelFrame === "function") {
            cancelFrame(frameId)
        }
        frameId = null
        source.disconnect?.()
        analyser.disconnect?.()
        const closeResult = audioContext.close?.()
        closeResult?.catch?.(() => null)
    }
}
