import { useEffect, useRef, useState } from "react"
import {
    getMotionPhaseForVoiceTransition,
    getNextMotionPhase,
    getReactionPhase,
    isReactionPhase,
    canShowReaction,
    TOMO_MOTION_CLIPS,
    TOMO_MOTION_PHASES,
} from "./tomoMotionSequence.js"

export default function TomoMotionMedia({
    voiceState, reaction, deferReaction = false, hidden, disabled, onDisplayReady, onReadyChange,
}) {
    const [targetPhase, setTargetPhase] = useState(TOMO_MOTION_PHASES.IDLE)
    const [displayPhase, setDisplayPhase] = useState(TOMO_MOTION_PHASES.IDLE)
    const [readySources, setReadySources] = useState({})
    const [sourceFallbacks, setSourceFallbacks] = useState({})
    const consumedReactionRef = useRef(null)
    const videosRef = useRef(new Map())
    const reactionPhase = getReactionPhase(reaction)
    const reactionId = reaction?.id

    useEffect(() => {
        if (disabled || !canShowReaction(voiceState)) {
            consumedReactionRef.current = reactionId
        }
        setTargetPhase((currentPhase) => {
            if (!disabled && canShowReaction(voiceState) && !deferReaction && reactionPhase) {
                // Let a visible one-shot finish even if its audio has just ended.
                if (isReactionPhase(currentPhase) || consumedReactionRef.current !== reactionId) {
                    return reactionPhase
                }
            }
            return getMotionPhaseForVoiceTransition({ nextVoiceState: voiceState, currentPhase })
        })
    }, [deferReaction, disabled, reactionId, reactionPhase, voiceState])

    // A missing expression must not wait indefinitely or appear in a later turn.
    useEffect(() => {
        if (!isReactionPhase(targetPhase) || targetPhase === displayPhase) return undefined
        const timeout = setTimeout(() => {
            consumedReactionRef.current = reactionId
            setTargetPhase(TOMO_MOTION_PHASES.IDLE)
        }, 1500)
        return () => clearTimeout(timeout)
    }, [displayPhase, reactionId, targetPhase])

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

    useEffect(() => {
        const video = videosRef.current.get(displayPhase)
        if (!video || disabled || !readySources[displayedSource]) return
        if (hidden) {
            video.pause()
            return
        }
        if (video.ended) return
        if (isReactionPhase(displayPhase)) consumedReactionRef.current = reactionId
        video.play().catch(() => null)
    }, [disabled, displayPhase, displayedSource, hidden, reactionId, readySources])

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
                        key={isReactionPhase(phase) ? `${phaseSrc}:${reactionId}` : phaseSrc}
                        ref={(video) => {
                            if (video) videosRef.current.set(phase, video)
                            else videosRef.current.delete(phase)
                        }}
                        data-motion-phase={phase}
                        className={`tomo-avatar-media__motion ${
                            visible
                                ? "tomo-avatar-media__motion--visible"
                                : ""
                        }`}
                        src={phaseSrc}
                        autoPlay={displayed && !hidden}
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
                                if (!hidden) video.play().catch(() => null)
                                setDisplayPhase(phase)
                                return
                            }

                            if (displayed) {
                                onDisplayReady?.(video)
                                if (!hidden) video.play().catch(() => null)
                            }
                        }}
                        onError={() => {
                            if (isReactionPhase(phase)) {
                                consumedReactionRef.current = reactionId
                                setTargetPhase(TOMO_MOTION_PHASES.IDLE)
                                setDisplayPhase(TOMO_MOTION_PHASES.IDLE)
                                return
                            }
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
                            if (isReactionPhase(phase)) {
                                consumedReactionRef.current = reactionId
                                setTargetPhase(TOMO_MOTION_PHASES.IDLE)
                                return
                            }
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
