import {
    AVATAR_CONTROL,
    AVATAR_CONTROL_TOPIC,
    AVATAR_SPEECH_TOPIC,
    AVATAR_STATUS,
    AVATAR_STATUS_TOPIC,
    createAvatarControl,
    MAX_AVATAR_SPEECH_BYTES,
    parseAvatarMessage,
} from "../../../shared/avatarProtocol.js"

const DEFAULT_SPEECH_TIMEOUT_MS = 90_000

export class RunwayAvatarClientError extends Error {
    constructor(message, reason = "avatar_client_error") {
        super(message)
        this.name = "RunwayAvatarClientError"
        this.reason = reason
    }
}

function statusError(reason) {
    const messages = {
        unsupported_audio: "Tomo’s live animation could not use this audio.",
        empty_audio: "Tomo’s live animation received an empty response.",
        audio_too_large: "Tomo’s spoken response is too long for live animation.",
        avatar_playback_failed: "Tomo’s live animation stopped before playback.",
    }

    return new RunwayAvatarClientError(
        messages[reason] || "Tomo’s live animation could not play this response.",
        reason || "avatar_playback_failed"
    )
}

export async function connectRunwayAvatar({
    session,
    onVideoTrack = () => {},
    onAudioTrack = () => {},
    onDisconnected = () => {},
    loadSdk = () => import("livekit-client"),
    fetchImpl = globalThis.fetch,
    createId = () => globalThis.crypto.randomUUID(),
    speechTimeoutMs = DEFAULT_SPEECH_TIMEOUT_MS,
} = {}) {
    if (!session?.livekit_url || !session?.token) {
        throw new RunwayAvatarClientError(
            "Tomo’s live animation session is incomplete.",
            "invalid_avatar_session"
        )
    }

    const sdk = await loadSdk()
    const room = new sdk.Room({ adaptiveStream: true, dynacast: true })
    const pendingSpeech = new Map()
    let currentRequestId = null
    let disconnected = false

    function settleSpeech(message) {
        const requestId = message?.request_id
        const pending = pendingSpeech.get(requestId)

        if (!pending) return

        if (message.status === AVATAR_STATUS.ACCEPTED) return

        clearTimeout(pending.timer)
        pendingSpeech.delete(requestId)
        if (currentRequestId === requestId) currentRequestId = null

        if (
            message.status === AVATAR_STATUS.COMPLETED ||
            message.status === AVATAR_STATUS.INTERRUPTED
        ) {
            pending.resolve({ status: message.status })
            return
        }

        pending.reject(statusError(message.reason))
    }

    room.registerTextStreamHandler(
        AVATAR_STATUS_TOPIC,
        async (reader) => settleSpeech(parseAvatarMessage(await reader.readAll()))
    )

    room.on(sdk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === sdk.Track.Kind.Video) onVideoTrack(track)
        if (track.kind === sdk.Track.Kind.Audio) onAudioTrack(track)
    })
    room.on(sdk.RoomEvent.Disconnected, () => {
        if (disconnected) return
        disconnected = true

        for (const pending of pendingSpeech.values()) {
            clearTimeout(pending.timer)
            pending.reject(
                new RunwayAvatarClientError(
                    "Tomo’s live animation disconnected.",
                    "avatar_disconnected"
                )
            )
        }
        pendingSpeech.clear()
        currentRequestId = null
        onDisconnected()
    })

    await room.connect(session.livekit_url, session.token)

    return {
        async sendSpeech(audioUrl) {
            if (disconnected) {
                throw new RunwayAvatarClientError(
                    "Tomo’s live animation is not connected.",
                    "avatar_disconnected"
                )
            }

            const response = await fetchImpl(audioUrl)
            if (!response.ok) {
                throw new RunwayAvatarClientError(
                    "Tomo’s spoken response could not be prepared for animation.",
                    "avatar_audio_unavailable"
                )
            }

            const bytes = new Uint8Array(await response.arrayBuffer())
            if (bytes.length === 0 || bytes.length > MAX_AVATAR_SPEECH_BYTES) {
                throw statusError(
                    bytes.length === 0 ? "empty_audio" : "audio_too_large"
                )
            }

            const requestId = createId()
            currentRequestId = requestId
            const completion = new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pendingSpeech.delete(requestId)
                    if (currentRequestId === requestId) currentRequestId = null
                    reject(
                        new RunwayAvatarClientError(
                            "Tomo’s live animation took too long to respond.",
                            "avatar_playback_timeout"
                        )
                    )
                }, speechTimeoutMs)
                pendingSpeech.set(requestId, { resolve, reject, timer })
            })

            try {
                await room.localParticipant.sendBytes(bytes, {
                    topic: AVATAR_SPEECH_TOPIC,
                    name: `tomo-speech-${requestId}.mp3`,
                    mimeType: "audio/mpeg",
                    compress: false,
                    attributes: { requestId },
                })
            } catch (err) {
                const pending = pendingSpeech.get(requestId)
                clearTimeout(pending?.timer)
                pendingSpeech.delete(requestId)
                currentRequestId = null
                throw err
            }

            return completion
        },

        async stopSpeech() {
            if (!currentRequestId || disconnected) return false

            await room.localParticipant.sendText(
                JSON.stringify(
                    createAvatarControl({
                        requestId: currentRequestId,
                        action: AVATAR_CONTROL.STOP,
                    })
                ),
                { topic: AVATAR_CONTROL_TOPIC }
            )
            return true
        },

        disconnect() {
            if (disconnected) return
            room.disconnect()
        },
    }
}
