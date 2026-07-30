export class VoiceCaptureError extends Error {
    constructor(message, reason) {
        super(message)
        this.name = "VoiceCaptureError"
        this.reason = reason
    }
}

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