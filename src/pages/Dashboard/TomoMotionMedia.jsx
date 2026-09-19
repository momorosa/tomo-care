import { useEffect, useRef, useState } from "react"
import {
    getMotionPhaseForVoiceTransition,
    getNextMotionPhase,
    TOMO_MOTION_CLIPS,
    TOMO_MOTION_PHASES,
} from "./tomoMotionSequence.js"

export default function TomoMotionMedia({
    voiceState, hidden, disabled, onDisplayReady, onReadyChange,
}) {
    const [targetPhase, setTargetPhase] = useState(TOMO_MOTION_PHASES.IDLE)
    const [displayPhase, setDisplayPhase] = useState(TOMO_MOTION_PHASES.IDLE)
    const [readySources, setReadySources] = useState({})
    const [sourceFallbacks, setSourceFallbacks] = useState({})
    const previousVoiceStateRef = useRef(voiceState)

    useEffect(() => {
        const previousVoiceState = previousVoiceStateRef.current
        previousVoiceStateRef.current = voiceState
        setTargetPhase((currentPhase) =>
            getMotionPhaseForVoiceTransition({
                previousVoiceState,
                nextVoiceState: voiceState,
                currentPhase,
            })
        )
    }, [voiceState])

    useEffect(() => {
        if (disabled || typeof document === "undefined") return undefined

        const preloaders = Object.values(TOMO_MOTION_CLIPS)
            .map(({ src }) => {
                const video = document.createElement("video")
                video.preload = "auto"
                video.muted = true
                video.src = src
                video.load()
                return video
            })

        return () => {
            for (const video of preloaders) {
                video.pause()
                video.removeAttribute("src")
            }
        }
    }, [disabled])

    const displayedSource = sourceFallbacks[displayPhase] || TOMO_MOTION_CLIPS[displayPhase].src
    useEffect(() => {
        onReadyChange?.(!disabled && targetPhase === displayPhase && !!readySources[displayedSource])
    }, [disabled, displayPhase, displayedSource, onReadyChange, readySources, targetPhase])

    if (disabled) return null

    const renderedPhases =
        targetPhase === displayPhase
            ? [displayPhase]
            : [displayPhase, targetPhase]

    return (
        <>
            {renderedPhases.map((phase) => {
                const phaseClip = TOMO_MOTION_CLIPS[phase]
                const phaseSrc = sourceFallbacks[phase] || phaseClip.src
                const displayed = phase === displayPhase
                const visible = displayed && readySources[phaseSrc] && !hidden

                return (
                    <video
                        key={phaseSrc}
                        className={`tomo-avatar-media__motion ${
                            visible
                                ? "tomo-avatar-media__motion--visible"
                                : ""
                        }`}
                        src={phaseSrc}
                        autoPlay={displayed}
                        playsInline
                        muted
                        loop={false}
                        preload="auto"
                        aria-hidden="true"
                        onCanPlay={(event) => {
                            const video = event.currentTarget
                            setReadySources((sources) => ({
                                ...sources,
                                [phaseSrc]: true,
                            }))

                            if (!displayed && phase === targetPhase) {
                                onDisplayReady?.(video)
                                video.currentTime = 0
                                video.play().catch(() => null)
                                setDisplayPhase(phase)
                                return
                            }

                            if (displayed) {
                                onDisplayReady?.(video)
                                video.play().catch(() => null)
                            }
                        }}
                        onError={() => {
                            if (
                                phaseClip.fallbackSrc &&
                                phaseSrc !== phaseClip.fallbackSrc
                            ) {
                                setSourceFallbacks((fallbacks) => ({
                                    ...fallbacks,
                                    [phase]: phaseClip.fallbackSrc,
                                }))
                            }
                        }}
                        onEnded={() => {
                            if (phase !== displayPhase) return
                            setTargetPhase((currentPhase) =>
                                getNextMotionPhase({
                                    currentPhase,
                                    voiceState,
                                })
                            )
                        }}
                    />
                )
            })}
        </>
    )
}
