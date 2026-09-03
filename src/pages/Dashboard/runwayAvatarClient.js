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
const AVATAR_CANCELLED_REASON = "avatar_cancelled"
const AVATAR_STATUS_FAILURE_REASONS = new Set([
    "unsupported_audio",
    "empty_audio",
    "audio_too_large",
    "avatar_playback_failed",
])

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

    const safeReason = AVATAR_STATUS_FAILURE_REASONS.has(reason)
        ? reason
        : "avatar_playback_failed"

    return new RunwayAvatarClientError(
        messages[safeReason] ||
            "Tomo’s live animation could not play this response.",
        safeReason
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
    now = () => globalThis.performance?.now?.() ?? Date.now(),
    signal,
} = {}) {
    if (!session?.livekit_url || !session?.token) {
        throw new RunwayAvatarClientError(
            "Tomo’s live animation session is incomplete.",
            "invalid_avatar_session"
        )
    }

    let sdk
    let room

    try {
        sdk = await loadSdk()
        room = new sdk.Room({ adaptiveStream: true, dynacast: true })
    } catch {
        throw new RunwayAvatarClientError(
            "Tomo’s live animation could not connect.",
            "avatar_session_failed"
        )
    }
    const pendingSpeech = new Map()
    const subscribedTracks = new Set()
    let currentRequestId = null
    let disconnected = false
    let connected = false
    let requestedDisconnectReason = null

    function clientErrorForReason(reason) {
        if (reason === AVATAR_CANCELLED_REASON) {
            return new RunwayAvatarClientError(
                "Tomo’s live animation connection was cancelled.",
                reason
            )
        }

        return new RunwayAvatarClientError(
            "Tomo’s live animation disconnected.",
            reason || "avatar_disconnected"
        )
    }

    function finalizeDisconnect(reason = "avatar_disconnected", { notify = true } = {}) {
        if (disconnected) return
        disconnected = true

        for (const pending of pendingSpeech.values()) {
            clearTimeout(pending.timer)
            pending.reject(clientErrorForReason(reason))
        }
        pendingSpeech.clear()
        currentRequestId = null

        room.unregisterTextStreamHandler?.(AVATAR_STATUS_TOPIC)
        room.off?.(sdk.RoomEvent.TrackSubscribed, handleTrackSubscribed)
        room.off?.(sdk.RoomEvent.Disconnected, handleRoomDisconnected)
        signal?.removeEventListener?.("abort", handleAbort)

        for (const track of subscribedTracks) track.detach?.()
        subscribedTracks.clear()

        if (notify) onDisconnected({ reason })
    }

    function handleTrackSubscribed(track) {
        subscribedTracks.add(track)
        if (track.kind === sdk.Track.Kind.Video) onVideoTrack(track)
        if (track.kind === sdk.Track.Kind.Audio) onAudioTrack(track)
    }

    function handleRoomDisconnected() {
        finalizeDisconnect(requestedDisconnectReason || "avatar_disconnected")
    }

    function handleAbort() {
        requestedDisconnectReason = AVATAR_CANCELLED_REASON
        finalizeDisconnect(AVATAR_CANCELLED_REASON, { notify: connected })
        room.disconnect()
    }

    function settleSpeech(message) {
        const requestId = message?.request_id
        const pending = pendingSpeech.get(requestId)

        if (!pending) return

        if (message.status === AVATAR_STATUS.ACCEPTED) {
            pending.acceptedAt = now()
            return
        }

        if (message.status === AVATAR_STATUS.PLAYING) {
            pending.playingAt = now()
            pending.onPlaybackStarted?.()
            return
        }

        const completedAt = now()
        clearTimeout(pending.timer)
        pendingSpeech.delete(requestId)
        if (currentRequestId === requestId) currentRequestId = null

        if (
            message.status === AVATAR_STATUS.COMPLETED ||
            message.status === AVATAR_STATUS.INTERRUPTED
        ) {
            const playbackStartedAt =
                pending.playingAt ?? pending.acceptedAt ?? pending.sentAt
            pending.resolve({
                status: message.status,
                timings: {
                    audio_prepare_ms: Math.max(
                        0,
                        Math.round(pending.audioReadyAt - pending.startedAt)
                    ),
                    speech_transfer_ms: Math.max(
                        0,
                        Math.round(pending.sentAt - pending.audioReadyAt)
                    ),
                    avatar_startup_ms: Math.max(
                        0,
                        Math.round(playbackStartedAt - pending.sentAt)
                    ),
                    avatar_playback_ms: Math.max(
                        0,
                        Math.round(completedAt - playbackStartedAt)
                    ),
                    avatar_total_ms: Math.max(
                        0,
                        Math.round(completedAt - pending.startedAt)
                    ),
                },
            })
            return
        }

        pending.reject(statusError(message.reason))
    }

    room.registerTextStreamHandler(
        AVATAR_STATUS_TOPIC,
        async (reader) => settleSpeech(parseAvatarMessage(await reader.readAll()))
    )

    room.on(sdk.RoomEvent.TrackSubscribed, handleTrackSubscribed)
    room.on(sdk.RoomEvent.Disconnected, handleRoomDisconnected)
    signal?.addEventListener?.("abort", handleAbort, { once: true })

    if (signal?.aborted) {
        handleAbort()
        throw clientErrorForReason(AVATAR_CANCELLED_REASON)
    }

    try {
        await room.connect(session.livekit_url, session.token)
        connected = true
    } catch {
        const reason = signal?.aborted
            ? AVATAR_CANCELLED_REASON
            : "avatar_session_failed"
        finalizeDisconnect(reason, { notify: false })
        room.disconnect()
        throw new RunwayAvatarClientError(
            reason === AVATAR_CANCELLED_REASON
                ? "Tomo’s live animation connection was cancelled."
                : "Tomo’s live animation could not connect.",
            reason
        )
    }

    return {
        async sendSpeech(audioUrl, { onPlaybackStarted } = {}) {
            if (disconnected) {
                throw new RunwayAvatarClientError(
                    "Tomo’s live animation is not connected.",
                    "avatar_disconnected"
                )
            }

            const startedAt = now()
            let response

            try {
                response = await fetchImpl(audioUrl)
            } catch {
                throw new RunwayAvatarClientError(
                    "Tomo’s spoken response could not be prepared for animation.",
                    "avatar_audio_unavailable"
                )
            }
            if (!response.ok) {
                throw new RunwayAvatarClientError(
                    "Tomo’s spoken response could not be prepared for animation.",
                    "avatar_audio_unavailable"
                )
            }

            let bytes
            try {
                bytes = new Uint8Array(await response.arrayBuffer())
            } catch {
                throw new RunwayAvatarClientError(
                    "Tomo’s spoken response could not be prepared for animation.",
                    "avatar_audio_unavailable"
                )
            }
            const audioReadyAt = now()
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
                pendingSpeech.set(requestId, {
                    resolve,
                    reject,
                    timer,
                    startedAt,
                    audioReadyAt,
                    sentAt: audioReadyAt,
                    acceptedAt: null,
                    playingAt: null,
                    onPlaybackStarted,
                })
            })

            try {
                await room.localParticipant.sendBytes(bytes, {
                    topic: AVATAR_SPEECH_TOPIC,
                    name: `tomo-speech-${requestId}.mp3`,
                    mimeType: "audio/mpeg",
                    compress: false,
                    attributes: { requestId },
                })
                const pending = pendingSpeech.get(requestId)
                if (pending) pending.sentAt = now()
            } catch {
                const pending = pendingSpeech.get(requestId)
                clearTimeout(pending?.timer)
                pendingSpeech.delete(requestId)
                currentRequestId = null
                throw new RunwayAvatarClientError(
                    "Tomo’s live animation could not receive this response.",
                    "avatar_playback_failed"
                )
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

        disconnect({ reason = "user_ended" } = {}) {
            if (disconnected) return
            requestedDisconnectReason = reason
            finalizeDisconnect(reason)
            room.disconnect()
        },
    }
}
