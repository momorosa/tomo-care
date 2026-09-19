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
const DEFAULT_SPEECH_START_TIMEOUT_MS = 15_000
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
    speechStartTimeoutMs = Math.min(speechTimeoutMs, DEFAULT_SPEECH_START_TIMEOUT_MS),
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
    const mediaParticipants = new Set()
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
        room.off?.(sdk.RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
        signal?.removeEventListener?.("abort", handleAbort)

        // Let the view retain its last decoded frame before detaching the tracks.
        // This synchronous notification must never postpone resource release.
        try {
            if (notify) onDisconnected({ reason })
        } finally {
            for (const track of subscribedTracks) track.detach?.()
            subscribedTracks.clear()
        }
    }

    function handleTrackSubscribed(track, _publication, participant) {
        if (disconnected) return
        if (participant?.identity) mediaParticipants.add(participant.identity)
        subscribedTracks.add(track)
        if (track.kind === sdk.Track.Kind.Video) onVideoTrack(track)
        if (track.kind === sdk.Track.Kind.Audio) onAudioTrack(track)
    }

    function handleParticipantDisconnected(participant) {
        if (!mediaParticipants.has(participant?.identity)) return
        finalizeDisconnect("avatar_disconnected")
        room.disconnect()
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
            if (pending.playingAt !== null) return
            pending.playingAt = now()
            clearTimeout(pending.timer)
            pending.timer = setTimeout(pending.timeout, speechTimeoutMs)
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
    room.on(sdk.RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
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
            const requestId = createId()
            currentRequestId = requestId
            // Register before preparing or transferring audio. Either operation can stall;
            // disconnect, expiry, Stop and timeout must settle the caller independently.
            const completion = new Promise((resolve, reject) => {
                const timeout = () => {
                    finalizeDisconnect("avatar_playback_timeout")
                    room.disconnect()
                }
                pendingSpeech.set(requestId, {
                    resolve, reject, timeout,
                    timer: setTimeout(timeout, speechStartTimeoutMs),
                    startedAt,
                    audioReadyAt: startedAt,
                    sentAt: startedAt,
                    acceptedAt: null,
                    playingAt: null,
                    onPlaybackStarted,
                })
            })

            const fail = (error) => {
                const pending = pendingSpeech.get(requestId)
                if (!pending) return
                clearTimeout(pending.timer)
                pendingSpeech.delete(requestId)
                if (currentRequestId === requestId) currentRequestId = null
                pending.reject(error)
            }
            // Observe errors immediately without awaiting the transport before completion.
            // A late transport resolution may not resurrect a cancelled request.
            void (async () => {
                let bytes
                try {
                    const response = await fetchImpl(audioUrl)
                    if (!pendingSpeech.has(requestId)) return
                    if (!response.ok) throw new Error("audio unavailable")
                    bytes = new Uint8Array(await response.arrayBuffer())
                } catch {
                    fail(new RunwayAvatarClientError(
                        "Tomo’s spoken response could not be prepared for animation.",
                        "avatar_audio_unavailable"
                    ))
                    return
                }
                const pending = pendingSpeech.get(requestId)
                if (!pending || disconnected) return
                pending.audioReadyAt = now()
                pending.sentAt = pending.audioReadyAt
                if (bytes.length === 0 || bytes.length > MAX_AVATAR_SPEECH_BYTES) {
                    fail(statusError(bytes.length === 0 ? "empty_audio" : "audio_too_large"))
                    return
                }
                try {
                    await room.localParticipant.sendBytes(bytes, {
                        topic: AVATAR_SPEECH_TOPIC,
                        name: `tomo-speech-${requestId}.mp3`,
                        mimeType: "audio/mpeg",
                        compress: false,
                        attributes: { requestId },
                    })
                    const current = pendingSpeech.get(requestId)
                    if (current) current.sentAt = now()
                } catch {
                    fail(statusError("avatar_playback_failed"))
                }
            })()
            return completion
        },

        async stopSpeech() {
            if (!currentRequestId || disconnected) return false
            const requestId = currentRequestId
            const playbackStarted = pendingSpeech.get(requestId)?.playingAt !== null
            // The user's Stop takes effect even if the worker cannot acknowledge it.
            settleSpeech({ request_id: requestId, status: AVATAR_STATUS.INTERRUPTED })
            if (!playbackStarted) {
                // A Stop message can arrive before the worker knows this upload exists.
                // Closing that transport prevents a late upload from starting orphan audio.
                finalizeDisconnect("user_ended")
                room.disconnect()
                return true
            }
            let stopTimer
            try {
                await Promise.race([room.localParticipant.sendText(
                    JSON.stringify(createAvatarControl({
                        requestId,
                        action: AVATAR_CONTROL.STOP,
                    })),
                    { topic: AVATAR_CONTROL_TOPIC }
                ), new Promise((_, reject) => {
                    stopTimer = setTimeout(() => reject(new Error("stop timeout")), 1000)
                })])
            } catch {
                finalizeDisconnect("avatar_disconnected")
                room.disconnect()
            } finally {
                clearTimeout(stopTimer)
            }
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
