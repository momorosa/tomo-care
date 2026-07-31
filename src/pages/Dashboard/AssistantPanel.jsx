import { useEffect, useRef, useState } from "react"
import { askAssistant, askAssistantByVoice } from "./api.js"
import { buildFreshAssistantAnswer } from "./assistantAnswerAttention.js"
import {
    getVoiceStateAfterAnswer,
    getVoiceStateAfterPlayback,
    getVoiceStateLabel,
    VOICE_STATES,
} from "./voiceInteractionState.js"
import {
    isVoiceCaptureSupported,
    requestMicrophone,
    selectSupportedAudioType,
    startSilenceDetection,
} from "./voiceRecorder.js"
import EvidenceCard from "./EvidenceCard.jsx"

const MAX_RECORDING_MS = 30_000

const SUGGESTED_QUESTIONS = [
    "When was Momo last given Librela?",
    "When is Momo next due for Librela?",
    "Draft a Librela appointment request.",
    "What reminders are active?",
    "How much have I spent on Librela?",
]

export default function AssistantPanel({
    petId,
    onActionPrepared,
    onMessageDraftPrepared,
}) {
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE)
    const [voiceResponse, setVoiceResponse] = useState(null)
    const [voiceMuted, setVoiceMuted] = useState(false)
    const recorderRef = useRef(null)
    const streamRef = useRef(null)
    const recordingTimerRef = useRef(null)
    const silenceDetectorCleanupRef = useRef(null)
    const chunksRef = useRef([])
    const playbackRef = useRef(null)
    const voiceMutedRef = useRef(false)

    useEffect(() => {
        return () => {
            clearTimeout(recordingTimerRef.current)
            silenceDetectorCleanupRef.current?.()
            playbackRef.current?.pause()
            streamRef.current?.getTracks().forEach((track) => track.stop())
        }
    }, [])

    function requiresVisualReview(result) {
        return (
            result.answer_type === "action_prepared" ||
            result.answer_type === "message_draft_prepared"
        )
    }

    function routePreparedResult(result) {
        if (
            result.answer_type === "action_prepared" &&
            result.proposed_action?.id
        ) {
            onActionPrepared?.(result.proposed_action)
        }

        if (
            result.answer_type === "message_draft_prepared" &&
            result.message_draft
        ) {
            onMessageDraftPrepared?.({
                ...result.message_draft,
                workflow_run_id: result.workflow?.run_id || null,
            })
        }
    }

    function showAssistantResult(result, askedQuestion) {
        setAnswer((currentAnswer) =>
            buildFreshAssistantAnswer(
                currentAnswer,
                askedQuestion,
                result
            )
        )
        routePreparedResult(result)
        return requiresVisualReview(result)
    }

    function stopPlayback({ requiresReview = false } = {}) {
        if (playbackRef.current) {
            playbackRef.current.pause()
            playbackRef.current.currentTime = 0
            playbackRef.current = null
        }

        setVoiceState(getVoiceStateAfterPlayback({ requiresReview }))
    }

    async function playVoiceAnswer(
        nextVoiceResponse = voiceResponse,
        { requiresReview = false } = {}
    ) {
        if (!nextVoiceResponse?.audioUrl || voiceMutedRef.current) {
            setVoiceState(
                getVoiceStateAfterAnswer({
                    willSpeak: false,
                    requiresReview,
                })
            )
            return
        }

        stopPlayback({ requiresReview })
        const playback = new Audio(nextVoiceResponse.audioUrl)
        playbackRef.current = playback

        playback.addEventListener("play", () => {
            setVoiceState(VOICE_STATES.SPEAKING)
        })
        playback.addEventListener(
            "ended",
            () => {
                playbackRef.current = null
                setVoiceState(
                    getVoiceStateAfterPlayback({ requiresReview })
                )
            },
            { once: true }
        )

        try {
            await playback.play()
        } catch {
            playbackRef.current = null
            setVoiceState(
                getVoiceStateAfterPlayback({ requiresReview })
            )
        }
    }

    async function handleAsk(nextQuestion) {
        const trimmedQuestion = (nextQuestion || question).trim()

        if (!trimmedQuestion) return

        stopPlayback()
        setLoading(true)
        setError("")
        setVoiceState(VOICE_STATES.THINKING)

        try {
            const result = await askAssistant(petId, trimmedQuestion)
            const requiresReview = showAssistantResult(
                result,
                trimmedQuestion
            )
            setVoiceState(
                getVoiceStateAfterAnswer({
                    willSpeak: false,
                    requiresReview,
                })
            )
            setQuestion("")
        } catch (err) {
            setError(err?.message || "TomoCare could not answer right now.")
            setVoiceState(VOICE_STATES.BLOCKED)
        } finally {
            setLoading(false)
        }
    }

    function stopRecording() {
        clearTimeout(recordingTimerRef.current)
        silenceDetectorCleanupRef.current?.()
        silenceDetectorCleanupRef.current = null

        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop()
        }
    }

    async function finishVoiceRecording(mimeType) {
        clearTimeout(recordingTimerRef.current)
        silenceDetectorCleanupRef.current?.()
        silenceDetectorCleanupRef.current = null
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null

        const audioBlob = new Blob(chunksRef.current, {
            type: mimeType || "audio/webm",
        })
        chunksRef.current = []

        if (audioBlob.size === 0) {
            setError("I didn’t hear anything. Try recording again.")
            setVoiceState(VOICE_STATES.BLOCKED)
            return
        }

        setLoading(true)
        setVoiceState(VOICE_STATES.THINKING)

        try {
            const result = await askAssistantByVoice(petId, audioBlob)
            const transcript = result.transcript?.trim()

            if (!transcript) {
                throw new Error("I couldn’t make out any words. Try again.")
            }

            const requiresReview = showAssistantResult(result, transcript)
            const nextVoiceResponse = {
                audioUrl: result.voice.audio_base64
                    ? `data:${result.voice.content_type};base64,${result.voice.audio_base64}`
                    : null,
                spokenAnswer: result.spoken_answer,
                disclosure: result.voice.disclosure,
                requiresReview,
            }

            setVoiceResponse(nextVoiceResponse)
            setQuestion("")
            if (result.voice.speech_error) {
                setError(result.voice.speech_error.error)
            }
            await playVoiceAnswer(nextVoiceResponse, { requiresReview })
        } catch (err) {
            setError(
                err?.message || "TomoCare could not answer by voice right now."
            )
            setVoiceState(VOICE_STATES.BLOCKED)
        } finally {
            setLoading(false)
        }
    }

    async function startRecording() {
        stopPlayback()
        setError("")
        setVoiceResponse(null)

        if (!isVoiceCaptureSupported()) {
            setError(
                "Voice recording is not supported in this browser. You can still type to Tomo."
            )
            setVoiceState(VOICE_STATES.BLOCKED)
            return
        }

        try {
            const stream = await requestMicrophone()
            streamRef.current = stream
            const mimeType = selectSupportedAudioType()
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream)

            recorderRef.current = recorder
            chunksRef.current = []

            recorder.addEventListener("dataavailable", (event) => {
                if (event.data?.size > 0) chunksRef.current.push(event.data)
            })
            recorder.addEventListener(
                "stop",
                () => finishVoiceRecording(recorder.mimeType || mimeType),
                { once: true }
            )
            recorder.addEventListener(
                "error",
                () => {
                    clearTimeout(recordingTimerRef.current)
                    silenceDetectorCleanupRef.current?.()
                    silenceDetectorCleanupRef.current = null
                    stream.getTracks().forEach((track) => track.stop())
                    streamRef.current = null
                    recorderRef.current = null
                    setError(
                        "TomoCare could not finish the recording. You can still type your question."
                    )
                    setVoiceState(VOICE_STATES.BLOCKED)
                },
                { once: true }
            )

            recorder.start()
            setVoiceState(VOICE_STATES.LISTENING)
            silenceDetectorCleanupRef.current = startSilenceDetection(
                stream,
                {
                    onSilence: stopRecording,
                }
            )
            recordingTimerRef.current = setTimeout(
                stopRecording,
                MAX_RECORDING_MS
            )
        } catch (err) {
            silenceDetectorCleanupRef.current?.()
            silenceDetectorCleanupRef.current = null
            streamRef.current?.getTracks().forEach((track) => track.stop())
            streamRef.current = null
            setError(
                err?.message ||
                    "TomoCare could not open the microphone. You can still type your question."
            )
            setVoiceState(VOICE_STATES.BLOCKED)
        }
    }

    function handleVoiceButton() {
        if (voiceState === VOICE_STATES.LISTENING) {
            stopRecording()
            return
        }

        startRecording()
    }

    function toggleMute() {
        const nextMuted = !voiceMuted
        setVoiceMuted(nextMuted)
        voiceMutedRef.current = nextMuted

        if (nextMuted && voiceState === VOICE_STATES.SPEAKING) {
            stopPlayback({
                requiresReview: voiceResponse?.requiresReview,
            })
        }
    }

    function handleSubmit(event) {
        event.preventDefault()
        handleAsk()
    }

    return (
        <section className="rounded-2xl border border-tomo-border bg-white/[0.035] p-6 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="tomo-section-label">Ask TomoCare</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-tomo-text-h">
                        Ask from Momo’s trusted records
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-tomo-text">
                        TomoCare can answer from verified records and prepare
                        supported updates for your review. Nothing changes without
                        your approval.
                    </p>
                </div>

                <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className="tomo-badge tomo-badge--brand shrink-0">
                        Verified data + approval
                    </span>
                    <TomoVoiceStatus state={voiceState} />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 md:flex-row">
                <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask about Momo’s care, or say “I gave Simparica today.”"
                    className="
                        min-h-11 flex-1 rounded-xl border border-tomo-border
                        bg-white/[0.025] px-4 py-2 text-sm text-tomo-text-h
                        placeholder:text-tomo-text/70
                        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tomo-accent
                    "
                />

                <button
                    type="button"
                    onClick={handleVoiceButton}
                    disabled={
                        loading &&
                        voiceState !== VOICE_STATES.LISTENING
                    }
                    aria-pressed={voiceState === VOICE_STATES.LISTENING}
                    className={`tomo-btn min-h-11 px-5 text-sm ${
                        voiceState === VOICE_STATES.LISTENING
                            ? "tomo-voice-recording"
                            : "tomo-btn-secondary"
                    }`}
                >
                    <span className="material-symbols-outlined mr-2 text-lg" aria-hidden="true">
                        {voiceState === VOICE_STATES.LISTENING
                            ? "stop_circle"
                            : "mic"}
                    </span>
                    {voiceState === VOICE_STATES.LISTENING
                        ? "Stop"
                        : "Speak"}
                </button>

                <button
                    type="submit"
                    disabled={loading || !question.trim()}
                    className="tomo-btn tomo-btn-primary min-h-11 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? "Asking..." : "Ask"}
                </button>
            </form>

            {voiceState === VOICE_STATES.LISTENING && (
                <p
                    role="status"
                    className="mt-2 text-xs leading-5 text-tomo-text"
                >
                    Listening—Tomo will stop automatically after a short
                    pause. Tap Stop if you want to finish sooner.
                </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((item) => (
                    <button
                        key={item}
                        type="button"
                        disabled={loading}
                        onClick={() => handleAsk(item)}
                        className="
                            tomo-quiet-link rounded-full border border-tomo-border
                            bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-tomo-text
                            transition-colors hover:border-tomo-accent/40 hover:bg-white/[0.04] hover:text-tomo-text-h
                            disabled:cursor-not-allowed disabled:opacity-50
                        "
                    >
                        {item}
                    </button>
                ))}
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
                {getVoiceStateLabel(voiceState)}
            </p>

            {voiceResponse && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-tomo-border bg-white/[0.02] px-3 py-2">
                    <button
                        type="button"
                        onClick={() =>
                            playVoiceAnswer(voiceResponse, {
                                requiresReview:
                                    voiceResponse.requiresReview,
                            })
                        }
                        disabled={
                            loading ||
                            !voiceResponse.audioUrl ||
                            voiceState === VOICE_STATES.LISTENING
                        }
                        className="tomo-btn tomo-btn-tertiary min-h-9 px-3 text-xs"
                    >
                        <span className="material-symbols-outlined mr-1.5 text-base" aria-hidden="true">
                            replay
                        </span>
                        Replay
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            stopPlayback({
                                requiresReview:
                                    voiceResponse.requiresReview,
                            })
                        }
                        disabled={voiceState !== VOICE_STATES.SPEAKING}
                        className="tomo-btn tomo-btn-tertiary min-h-9 px-3 text-xs"
                    >
                        <span className="material-symbols-outlined mr-1.5 text-base" aria-hidden="true">
                            stop
                        </span>
                        Stop audio
                    </button>
                    <button
                        type="button"
                        onClick={toggleMute}
                        aria-pressed={voiceMuted}
                        className="tomo-btn tomo-btn-tertiary min-h-9 px-3 text-xs"
                    >
                        <span className="material-symbols-outlined mr-1.5 text-base" aria-hidden="true">
                            {voiceMuted ? "volume_off" : "volume_up"}
                        </span>
                        {voiceMuted ? "Unmute" : "Mute"}
                    </button>
                    <span className="text-xs text-tomo-text">
                        {voiceResponse.disclosure}
                    </span>
                </div>
            )}

            {error && (
                <div className="mt-5 rounded-xl border border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] px-4 py-3 text-sm text-tomo-danger">
                    {error}
                </div>
            )}

            {answer && (
                <AssistantAnswer
                    key={answer.attention_revision}
                    answer={answer}
                />
            )}
        </section>
    )
}

function TomoVoiceStatus({ state }) {
    return (
        <div
            className={`tomo-voice-status tomo-voice-status--${state}`}
            data-state={state}
            aria-hidden="true"
        >
            <span className="tomo-voice-status__orb">
                <span />
                <span />
                <span />
            </span>
            <span>{getVoiceStateLabel(state)}</span>
        </div>
    )
}

function AssistantAnswer({ answer }) {
    const isActionRequest = answer.answer_type === "action_request"
    const isPreparedAction = answer.answer_type === "action_prepared"
    const isPreparedMessage =
        answer.answer_type === "message_draft_prepared"
    const needsClarification = answer.answer_type === "clarification_needed"

    return (
        <div className="mt-6 rounded-2xl border border-tomo-border bg-white/[0.025] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-tomo-text">
                        You asked
                    </p>
                    <p className="mt-1 text-sm font-medium text-tomo-text-h">
                        {answer.question}
                    </p>
                    {answer.transcript_corrections?.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs text-tomo-text">
                            {answer.transcript_corrections.map(
                                (correction) => (
                                    <p
                                        key={`${correction.heard}-${correction.interpreted_as}`}
                                    >
                                        {`Heard “${correction.heard}” · Interpreted as “${correction.interpreted_as}”`}
                                    </p>
                                )
                            )}
                        </div>
                    )}
                </div>

                <span
                    className={`tomo-badge ${
                        isActionRequest || needsClarification
                            ? "tomo-badge--warning"
                            : "tomo-badge--success"
                    }`}
                >
                    {isPreparedMessage
                        ? "Draft ready"
                        : isPreparedAction
                        ? "Ready to review"
                        : needsClarification
                          ? "Needs details"
                          : isActionRequest
                            ? "Approval required"
                            : "Grounded answer"}
                </span>
            </div>

            <div
                className="tomo-answer-fresh mt-5 rounded-xl border border-tomo-border bg-[#111219]/60 px-4 py-4"
                aria-live="polite"
                aria-atomic="true"
            >
                <p className="text-sm leading-6 text-tomo-text-h">
                    {answer.answer}
                </p>
            </div>

            {answer.citations?.length > 0 && (
                <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-tomo-text">
                        Evidence
                    </p>

                    <div className="mt-3 space-y-2">
                        {answer.citations.map((citation, index) => (
                            <EvidenceCard
                                key={`${citation.type}-${citation.id || index}`}
                                citation={citation}
                            />
                        ))}
                    </div>
                </div>
            )}

            {answer.limitations?.length > 0 && (
                <div className="mt-5 rounded-xl border border-tomo-border bg-white/[0.02] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-tomo-text">
                        Limits
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-tomo-text">
                        {answer.limitations.map((item) => (
                            <li key={item}>• {item}</li>
                        ))}
                    </ul>
                </div>
            )}

            {answer.proposed_action && !isPreparedAction && (
                <div className="mt-5 rounded-xl border border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-tomo-warning">
                        Routed to approval gate
                    </p>
                    <p className="mt-2 text-sm leading-6 text-tomo-text-h">
                        {answer.proposed_action.reason}
                    </p>
                </div>
            )}
        </div>
    )
}
