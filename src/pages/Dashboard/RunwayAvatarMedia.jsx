import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react"
import { createRunwayAvatarSession } from "./api.js"
import {
    AVATAR_PRESENTATION_REASONS,
    AVATAR_PRESENTATION_STATES,
    getAvatarPresentation,
    normalizeAvatarPresentationReason,
} from "./avatarPresentation.js"
import TomoMotionMedia from "./TomoMotionMedia.jsx"
import {
    AVATAR_HANDOFF_MS,
    captureAvatarFrame,
    createAvatarVisualHandoff,
} from "./avatarVisualHandoff.js"

async function connectLiveAvatar(options) {
    const { connectRunwayAvatar } = await import("./runwayAvatarClient.js")
    return connectRunwayAvatar(options)
}

const AVATAR_STARTUP_TIMEOUT_MS = 35_000
const AVATAR_CANCELLED_REASON = "avatar_cancelled"

function prefersReducedMotion() {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false
}

const RunwayAvatarMedia = forwardRef(function RunwayAvatarMedia(
    {
        fallbackSrc,
        fallbackAlt,
        voiceState,
        reaction,
        muted = false,
        createSession = createRunwayAvatarSession,
        connectAvatar = connectLiveAvatar,
    },
    ref
) {
    const [initialReducedMotion] = useState(prefersReducedMotion)
    const [presentationState, setPresentationState] = useState(
        AVATAR_PRESENTATION_STATES.LOCAL_ONLY
    )
    const [presentationReason, setPresentationReason] = useState(
        initialReducedMotion
            ? AVATAR_PRESENTATION_REASONS.REDUCED_MOTION
            : null
    )
    const [reducedMotion, setReducedMotion] = useState(initialReducedMotion)
    const [videoReady, setVideoReady] = useState(false)
    const [liveSpeech, setLiveSpeech] = useState(false)
    const [cancelledReactionId, setCancelledReactionId] = useState(null)
    const [handoff, setHandoff] = useState({ displayLive: false, phase: "steady" })
    const { displayLive } = handoff
    const clientRef = useRef(null)
    const presentationRef = useRef({
        state: AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
        reason: initialReducedMotion
            ? AVATAR_PRESENTATION_REASONS.REDUCED_MOTION
            : null,
    })
    const attemptRef = useRef(0)
    const startupControllerRef = useRef(null)
    const startupTimerRef = useRef(null)
    const durationTimerRef = useRef(null)
    const videoAttemptRef = useRef(null)
    const videoReadyRef = useRef(false)
    const videoRef = useRef(null)
    const audioRef = useRef(null)
    const stillRef = useRef(null)
    const bridgeRef = useRef(null)
    const localVideoRef = useRef(null)
    const localReadyRef = useRef(false)
    const reducedMotionRef = useRef(initialReducedMotion)
    const speechAttemptRef = useRef(0)
    const handoffRef = useRef(null)

    useEffect(() => {
        handoffRef.current = createAvatarVisualHandoff({
            captureOutgoing: (fromLive) => captureAvatarFrame(
                bridgeRef.current,
                fromLive ? videoRef.current : localVideoRef.current || stillRef.current
            ),
            isReady: (toLive) => toLive ? videoReadyRef.current : localReadyRef.current,
            onChange: setHandoff,
        })
        return () => {
            handoffRef.current?.dispose()
            handoffRef.current = null
        }
    }, [])

    const handleLocalFrame = useCallback((video) => { localVideoRef.current = video }, [])
    const handleLocalReady = useCallback((ready) => { localReadyRef.current = ready }, [])

    const updatePresentation = useCallback(function updatePresentation(
        nextState,
        nextReason = null
    ) {
        const safeReason = nextReason
            ? normalizeAvatarPresentationReason(nextReason)
            : null
        presentationRef.current = { state: nextState, reason: safeReason }
        setPresentationState(nextState)
        setPresentationReason(safeReason)
    }, [])

    const clearAvatarTimers = useCallback(function clearAvatarTimers() {
        clearTimeout(startupTimerRef.current)
        clearTimeout(durationTimerRef.current)
        startupTimerRef.current = null
        durationTimerRef.current = null
    }, [])

    const clearAttachedMedia = useCallback(function clearAttachedMedia() {
        for (const element of [videoRef.current, audioRef.current]) {
            element?.pause?.()
            if (element) element.srcObject = null
        }
    }, [])

    const cleanupAvatarResources = useCallback(
        function cleanupAvatarResources({
            disconnectReason = AVATAR_CANCELLED_REASON,
            nextState = AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
            nextReason = null,
            updateUi = true,
        } = {}) {
            // Preserve the visible frame before track detach; disconnect/audio cleanup stays immediate.
            if (updateUi) {
                handoffRef.current?.request(false, {
                    urgent: true,
                    immediate: reducedMotionRef.current,
                })
            }
            speechAttemptRef.current += 1
            attemptRef.current += 1
            const nextAttempt = attemptRef.current
            const controller = startupControllerRef.current
            const client = clientRef.current

            startupControllerRef.current = null
            clientRef.current = null
            clearAvatarTimers()
            controller?.abort()
            client?.disconnect({ reason: disconnectReason })
            clearAttachedMedia()
            videoAttemptRef.current = null
            videoReadyRef.current = false

            if (updateUi) {
                setVideoReady(false)
                setLiveSpeech(false)
                updatePresentation(nextState, nextReason)
            }

            return nextAttempt
        },
        [clearAttachedMedia, clearAvatarTimers, updatePresentation]
    )

    const markReadyWhenMediaLoads = useCallback(
        function markReadyWhenMediaLoads(attemptId) {
            if (
                attemptId !== attemptRef.current ||
                presentationRef.current.state !==
                    AVATAR_PRESENTATION_STATES.STARTING ||
                !clientRef.current ||
                !videoReadyRef.current
            ) {
                return
            }

            clearTimeout(startupTimerRef.current)
            startupTimerRef.current = null
            updatePresentation(AVATAR_PRESENTATION_STATES.READY)
        },
        [updatePresentation]
    )

    useEffect(() => {
        const query = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
        if (!query) return undefined

        const handleChange = (event) => {
            reducedMotionRef.current = event.matches
            setReducedMotion(event.matches)

            if (event.matches) {
                cleanupAvatarResources({
                    nextState: AVATAR_PRESENTATION_STATES.LOCAL_ONLY,
                    nextReason: AVATAR_PRESENTATION_REASONS.REDUCED_MOTION,
                })
                return
            }

            if (
                presentationRef.current.reason ===
                AVATAR_PRESENTATION_REASONS.REDUCED_MOTION
            ) {
                updatePresentation(AVATAR_PRESENTATION_STATES.LOCAL_ONLY)
            }
        }
        query.addEventListener?.("change", handleChange)
        return () => query.removeEventListener?.("change", handleChange)
    }, [cleanupAvatarResources, updatePresentation])

    useEffect(() => {
        return () => {
            cleanupAvatarResources({ updateUi: false })
        }
    }, [cleanupAvatarResources])

    const live = presentationState === AVATAR_PRESENTATION_STATES.READY
    const wantsLiveSpeech = live && videoReady && liveSpeech

    useEffect(() => {
        handoffRef.current?.request(wantsLiveSpeech, {
            settleMs: !wantsLiveSpeech && live ? AVATAR_HANDOFF_MS.SETTLE : 0,
            immediate: reducedMotion,
        })
    }, [live, reducedMotion, wantsLiveSpeech])

    useImperativeHandle(ref, () => ({
        isReady() {
            return (
                presentationRef.current.state ===
                    AVATAR_PRESENTATION_STATES.READY &&
                videoReadyRef.current &&
                Boolean(clientRef.current)
            )
        },
        async speak(audioUrl) {
            const client = clientRef.current
            const attemptId = attemptRef.current
            const speechAttempt = ++speechAttemptRef.current
            const isCurrentSpeech = () =>
                attemptId === attemptRef.current &&
                speechAttempt === speechAttemptRef.current

            if (
                presentationRef.current.state !==
                    AVATAR_PRESENTATION_STATES.READY ||
                !client
            ) {
                return null
            }

            try {
                const result = await client.sendSpeech(audioUrl, {
                    onPlaybackStarted() {
                        if (isCurrentSpeech()) {
                            setLiveSpeech(true)
                        }
                    },
                })
                if (isCurrentSpeech()) setLiveSpeech(false)
                return result
            } catch (error) {
                if (isCurrentSpeech()) {
                    cleanupAvatarResources({
                        disconnectReason:
                            AVATAR_PRESENTATION_REASONS.AVATAR_PLAYBACK_FAILED,
                        nextState: AVATAR_PRESENTATION_STATES.FAILED,
                        nextReason: normalizeAvatarPresentationReason(
                            error?.reason,
                            AVATAR_PRESENTATION_REASONS.AVATAR_PLAYBACK_FAILED
                        ),
                    })
                }
                throw error
            }
        },
        stopSpeech() {
            setCancelledReactionId(reaction?.id)
            speechAttemptRef.current += 1
            setLiveSpeech(false)
            handoffRef.current?.request(false, {
                urgent: true,
                immediate: reducedMotionRef.current,
            })
            return clientRef.current?.stopSpeech()
        },
        end() {
            cleanupAvatarResources()
        },
    }))

    async function startLiveAnimation() {
        if (
            reducedMotion ||
            presentationRef.current.state ===
                AVATAR_PRESENTATION_STATES.STARTING ||
            presentationRef.current.state === AVATAR_PRESENTATION_STATES.READY
        ) {
            return
        }

        const attemptId = cleanupAvatarResources({
            nextState: AVATAR_PRESENTATION_STATES.STARTING,
        })
        const controller = new AbortController()
        startupControllerRef.current = controller

        startupTimerRef.current = setTimeout(() => {
            if (attemptId !== attemptRef.current) return

            cleanupAvatarResources({
                disconnectReason:
                    AVATAR_PRESENTATION_REASONS.AVATAR_STARTUP_TIMEOUT,
                nextState: AVATAR_PRESENTATION_STATES.FAILED,
                nextReason:
                    AVATAR_PRESENTATION_REASONS.AVATAR_STARTUP_TIMEOUT,
            })
        }, AVATAR_STARTUP_TIMEOUT_MS)

        try {
            const session = await createSession({
                signal: controller.signal,
            })
            if (attemptId !== attemptRef.current) return

            const maxDurationSeconds = Number(session.max_duration_seconds)
            if (Number.isFinite(maxDurationSeconds) && maxDurationSeconds > 0) {
                durationTimerRef.current = setTimeout(() => {
                    if (attemptId !== attemptRef.current) return

                    cleanupAvatarResources({
                        disconnectReason:
                            AVATAR_PRESENTATION_REASONS.SESSION_EXPIRED,
                        nextState: AVATAR_PRESENTATION_STATES.ENDED,
                        nextReason:
                            AVATAR_PRESENTATION_REASONS.SESSION_EXPIRED,
                    })
                }, maxDurationSeconds * 1000)
            }

            const client = await connectAvatar({
                session,
                signal: controller.signal,
                onVideoTrack(track) {
                    if (attemptId !== attemptRef.current) return
                    videoAttemptRef.current = attemptId
                    if (videoRef.current) track.attach(videoRef.current)
                },
                onAudioTrack(track) {
                    if (
                        attemptId === attemptRef.current &&
                        audioRef.current
                    ) {
                        track.attach(audioRef.current)
                    }
                },
                onDisconnected() {
                    if (attemptId !== attemptRef.current) return

                    cleanupAvatarResources({
                        disconnectReason:
                            AVATAR_PRESENTATION_REASONS.AVATAR_DISCONNECTED,
                        nextState: AVATAR_PRESENTATION_STATES.FAILED,
                        nextReason:
                            AVATAR_PRESENTATION_REASONS.AVATAR_DISCONNECTED,
                    })
                },
            })

            if (attemptId !== attemptRef.current) {
                client.disconnect({ reason: AVATAR_CANCELLED_REASON })
                return
            }

            clientRef.current = client
            markReadyWhenMediaLoads(attemptId)
        } catch (error) {
            if (attemptId !== attemptRef.current) return

            const reason = normalizeAvatarPresentationReason(
                error?.reason,
                AVATAR_PRESENTATION_REASONS.AVATAR_SESSION_FAILED
            )
            const unavailable =
                reason === AVATAR_PRESENTATION_REASONS.AVATAR_DISABLED ||
                reason ===
                    AVATAR_PRESENTATION_REASONS.AVATAR_NOT_CONFIGURED

            cleanupAvatarResources({
                disconnectReason: reason,
                nextState: unavailable
                    ? AVATAR_PRESENTATION_STATES.LOCAL_ONLY
                    : AVATAR_PRESENTATION_STATES.FAILED,
                nextReason: reason,
            })
        }
    }

    function endLiveAnimation() {
        setCancelledReactionId(reaction?.id)
        cleanupAvatarResources({
            disconnectReason: AVATAR_PRESENTATION_REASONS.USER_ENDED,
            nextState: AVATAR_PRESENTATION_STATES.ENDED,
            nextReason: AVATAR_PRESENTATION_REASONS.USER_ENDED,
        })
    }

    const presentation = getAvatarPresentation({
        state: presentationState,
        reason: presentationReason,
    })
    const action = presentation.action

    return (
        <div
            className={`tomo-avatar-media tomo-avatar-media--${presentationState} ${
                displayLive ? "tomo-avatar-media--speaking" : ""
            }`}
            data-avatar-media={displayLive ? "runway-live" : "placeholder"}
            data-avatar-transition={handoff.phase}
            data-avatar-state={presentation.state}
            data-avatar-reason={presentation.reason || undefined}
            aria-busy={
                presentationState === AVATAR_PRESENTATION_STATES.STARTING
            }
        >
            <img
                ref={stillRef}
                src={fallbackSrc}
                alt={fallbackAlt}
                className="tomo-voice-stage__avatar tomo-avatar-media__fallback"
            />
            <TomoMotionMedia
                voiceState={voiceState}
                reaction={reaction?.id === cancelledReactionId ? null : reaction}
                deferReaction={live && voiceState === "speaking"}
                hidden={displayLive}
                disabled={reducedMotion}
                onDisplayReady={handleLocalFrame}
                onReadyChange={handleLocalReady}
            />
            <video
                ref={videoRef}
                className="tomo-avatar-media__video"
                autoPlay
                playsInline
                muted
                aria-hidden={!displayLive}
                onLoadedData={() => {
                    if (videoAttemptRef.current !== attemptRef.current) return
                    videoReadyRef.current = true
                    setVideoReady(true)
                    markReadyWhenMediaLoads(attemptRef.current)
                }}
            />
            <audio ref={audioRef} autoPlay muted={muted} />

            <canvas
                ref={bridgeRef}
                className="tomo-avatar-media__bridge"
                aria-hidden="true"
            />

            {action && (
                <div className="tomo-avatar-media__controls">
                    <button
                        type="button"
                        className="tomo-avatar-live-control"
                        onClick={
                            action.kind === "end"
                                ? endLiveAnimation
                                : startLiveAnimation
                        }
                        disabled={reducedMotion}
                        title={
                            reducedMotion
                                ? "Live animation is off while Reduce Motion is enabled"
                                : undefined
                        }
                    >
                        <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                        >
                            {action.kind === "end" ? "stop_circle" : "animation"}
                        </span>
                        <span>{action.label}</span>
                    </button>
                </div>
            )}

            {presentation.title && (
                <div
                    className={`tomo-avatar-media__notice tomo-avatar-media__notice--${presentation.tone}`}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <strong>{presentation.title}</strong>
                    <span>{presentation.description}</span>
                </div>
            )}
        </div>
    )
})

export default RunwayAvatarMedia
