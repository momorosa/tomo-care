import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react"
import { createRunwayAvatarSession } from "./api.js"

const LIVE_STATES = Object.freeze({
    FALLBACK: "fallback",
    STARTING: "starting",
    READY: "ready",
})

function prefersReducedMotion() {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false
}

const RunwayAvatarMedia = forwardRef(function RunwayAvatarMedia(
    { fallbackSrc, fallbackAlt, muted = false },
    ref
) {
    const [liveState, setLiveState] = useState(LIVE_STATES.FALLBACK)
    const [error, setError] = useState("")
    const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
    const clientRef = useRef(null)
    const stateRef = useRef(LIVE_STATES.FALLBACK)
    const videoRef = useRef(null)
    const audioRef = useRef(null)
    const durationTimerRef = useRef(null)

    const updateState = useCallback(function updateState(nextState) {
        stateRef.current = nextState
        setLiveState(nextState)
    }, [])

    const disconnect = useCallback(function disconnect({ updateUi = true } = {}) {
        clearTimeout(durationTimerRef.current)
        durationTimerRef.current = null
        clientRef.current?.disconnect()
        clientRef.current = null

        if (updateUi) updateState(LIVE_STATES.FALLBACK)
    }, [updateState])

    useEffect(() => {
        const query = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
        if (!query) return undefined

        const handleChange = (event) => {
            setReducedMotion(event.matches)
            if (event.matches) disconnect()
        }
        query.addEventListener?.("change", handleChange)
        return () => query.removeEventListener?.("change", handleChange)
    }, [disconnect])

    useEffect(() => {
        return () => {
            clearTimeout(durationTimerRef.current)
            clientRef.current?.disconnect()
        }
    }, [])

    useImperativeHandle(ref, () => ({
        isReady() {
            return stateRef.current === LIVE_STATES.READY && clientRef.current
        },
        async speak(audioUrl) {
            if (
                stateRef.current !== LIVE_STATES.READY ||
                !clientRef.current
            ) {
                return null
            }

            try {
                return await clientRef.current.sendSpeech(audioUrl)
            } catch (err) {
                setError(
                    err?.message ||
                        "Tomo’s live animation stopped. Audio will continue normally."
                )
                disconnect()
                throw err
            }
        },
        stopSpeech() {
            return clientRef.current?.stopSpeech()
        },
        end() {
            disconnect()
        },
    }))

    async function startLiveAnimation() {
        if (reducedMotion || liveState !== LIVE_STATES.FALLBACK) return

        setError("")
        updateState(LIVE_STATES.STARTING)

        try {
            const session = await createRunwayAvatarSession()
            const { connectRunwayAvatar } = await import(
                "./runwayAvatarClient.js"
            )
            const client = await connectRunwayAvatar({
                session,
                onVideoTrack(track) {
                    if (videoRef.current) track.attach(videoRef.current)
                    updateState(LIVE_STATES.READY)
                },
                onAudioTrack(track) {
                    if (audioRef.current) track.attach(audioRef.current)
                },
                onDisconnected() {
                    clientRef.current = null
                    updateState(LIVE_STATES.FALLBACK)
                },
            })
            clientRef.current = client
            durationTimerRef.current = setTimeout(
                () => disconnect(),
                session.max_duration_seconds * 1000
            )
        } catch (err) {
            clientRef.current = null
            updateState(LIVE_STATES.FALLBACK)
            setError(
                err?.message ||
                    "Tomo’s live animation could not start. Voice still works normally."
            )
        }
    }

    const live = liveState === LIVE_STATES.READY

    return (
        <div
            className={`tomo-avatar-media tomo-avatar-media--${liveState}`}
            data-avatar-media={live ? "runway-live" : "placeholder"}
        >
            <img
                src={fallbackSrc}
                alt={fallbackAlt}
                className="tomo-voice-stage__avatar tomo-avatar-media__fallback"
            />
            <video
                ref={videoRef}
                className="tomo-avatar-media__video"
                autoPlay
                playsInline
                muted
                aria-hidden={!live}
            />
            <audio ref={audioRef} autoPlay muted={muted} />

            <div className="tomo-avatar-media__controls">
                {liveState === LIVE_STATES.FALLBACK ? (
                    <button
                        type="button"
                        className="tomo-avatar-live-control"
                        onClick={startLiveAnimation}
                        disabled={reducedMotion}
                        title={
                            reducedMotion
                                ? "Live animation is off while Reduce Motion is enabled"
                                : "Start Runway live animation"
                        }
                    >
                        <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                        >
                            animation
                        </span>
                        <span>Animate Tomo</span>
                    </button>
                ) : liveState === LIVE_STATES.STARTING ? (
                    <span className="tomo-avatar-live-status" role="status">
                        Starting live animation…
                    </span>
                ) : (
                    <button
                        type="button"
                        className="tomo-avatar-live-control"
                        onClick={() => disconnect()}
                    >
                        <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                        >
                            stop_circle
                        </span>
                        <span>End live animation</span>
                    </button>
                )}
            </div>

            {error && (
                <p className="tomo-avatar-media__error" role="status">
                    {error}
                </p>
            )}
        </div>
    )
})

export default RunwayAvatarMedia
