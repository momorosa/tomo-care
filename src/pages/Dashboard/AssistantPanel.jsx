import { useEffect, useMemo, useRef, useState } from "react"
import tomoVoiceAvatar from "../../../assets/tomo-voice-avatar-placeholder.webp"
import tomoLogo from "../../../assets/tomocare-logo.png"
import { askAssistant, askAssistantByVoice } from "./api.js"
import { buildFreshAssistantAnswer } from "./assistantAnswerAttention.js"
import {
    appendConversationExchange,
    CONVERSATION_MODES,
} from "./conversationalHomeState.js"
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
import {
    getRecentVerifiedSources,
    getVerifiedSourcesLabel,
} from "./citationPresentation.js"
import RunwayAvatarMedia from "./RunwayAvatarMedia.jsx"
import {
    createVoiceLatencySummary,
    mergeAvatarLatency,
    reportVoiceLatency,
} from "./voiceLatency.js"

const MAX_RECORDING_MS = 30_000

const SUGGESTED_QUESTIONS = [
    "When was Momo last given Librela?",
    "What reminders are active?",
    "Tell me about Momo’s weight trend.",
]

export default function AssistantPanel({
    petId,
    pendingActionCount = 0,
    pendingActions = [],
    reminders = [],
    contextDrawerOpen,
    onToggleContext,
    onActionPrepared,
    onReviewPendingAction,
    onMessageDraftPrepared,
}) {
    const [mode, setMode] = useState(CONVERSATION_MODES.VOICE)
    const [question, setQuestion] = useState("")
    const [sessionTurns, setSessionTurns] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE)
    const [voiceResponse, setVoiceResponse] = useState(null)
    const [voiceMuted, setVoiceMuted] = useState(false)
    const [voiceTranscriptOpen, setVoiceTranscriptOpen] = useState(false)
    const [pendingMenuOpen, setPendingMenuOpen] = useState(false)
    const [pendingActionLoading, setPendingActionLoading] = useState(null)
    const recorderRef = useRef(null)
    const streamRef = useRef(null)
    const recordingTimerRef = useRef(null)
    const silenceDetectorCleanupRef = useRef(null)
    const chunksRef = useRef([])
    const playbackRef = useRef(null)
    const voiceMutedRef = useRef(false)
    const conversationContextRef = useRef(null)
    const lastAnswerRef = useRef(null)
    const transcriptEndRef = useRef(null)
    const avatarMediaRef = useRef(null)

    useEffect(() => {
        return () => {
            clearTimeout(recordingTimerRef.current)
            silenceDetectorCleanupRef.current?.()
            playbackRef.current?.pause()
            streamRef.current?.getTracks().forEach((track) => track.stop())
        }
    }, [])

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
        })
    }, [sessionTurns.length])

    function requiresVisualReview(result) {
        return (
            result.answer_type === "action_prepared" ||
            result.answer_type === "message_draft_prepared" ||
            Boolean(result.review_action_id)
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

        if (result.review_action_id) {
            void reviewPendingAction(result.review_action_id)
        }
    }

    async function reviewPendingAction(actionId) {
        if (!actionId || pendingActionLoading) return

        setPendingActionLoading(actionId)
        setPendingMenuOpen(false)
        setError("")

        try {
            await onReviewPendingAction?.(actionId)
        } catch (error) {
            setError(
                error?.message ||
                    "TomoCare could not reopen the pending action. Try again."
            )
        } finally {
            setPendingActionLoading(null)
        }
    }

    function handlePendingButton() {
        if (pendingActions.length === 1) {
            void reviewPendingAction(pendingActions[0].id)
            return
        }

        setPendingMenuOpen((open) => !open)
    }

    function showAssistantResult(result, askedQuestion) {
        if ("conversation_context" in result) {
            conversationContextRef.current = result.conversation_context
        }

        const answer = buildFreshAssistantAnswer(
            lastAnswerRef.current,
            askedQuestion,
            result
        )
        lastAnswerRef.current = answer
        setSessionTurns((turns) =>
            appendConversationExchange(turns, askedQuestion, answer)
        )
        routePreparedResult(result)
        return requiresVisualReview(result)
    }

    function stopPlayback({ requiresReview = false } = {}) {
        const avatarStop = avatarMediaRef.current?.stopSpeech()
        avatarStop?.catch?.(() => null)

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
            if (nextVoiceResponse?.latency) {
                reportVoiceLatency(nextVoiceResponse.latency)
            }
            setVoiceState(
                getVoiceStateAfterAnswer({
                    willSpeak: false,
                    requiresReview,
                })
            )
            return
        }

        stopPlayback({ requiresReview })

        if (avatarMediaRef.current?.isReady()) {
            setVoiceState(VOICE_STATES.SPEAKING)

            try {
                const result = await avatarMediaRef.current.speak(
                    nextVoiceResponse.audioUrl
                )

                if (result) {
                    reportVoiceLatency(
                        mergeAvatarLatency(
                            nextVoiceResponse.latency,
                            result.timings
                        )
                    )
                    setVoiceState(
                        getVoiceStateAfterPlayback({ requiresReview })
                    )
                    return
                }
            } catch {
                // Preserve the existing local voice path if live animation fails.
            }
        }

        const playback = new Audio(nextVoiceResponse.audioUrl)
        playbackRef.current = playback

        playback.addEventListener("play", () => {
            if (nextVoiceResponse.latency) {
                reportVoiceLatency(nextVoiceResponse.latency)
            }
            setVoiceState(VOICE_STATES.SPEAKING)
        }, { once: true })
        playback.addEventListener(
            "ended",
            () => {
                playbackRef.current = null
                setVoiceState(getVoiceStateAfterPlayback({ requiresReview }))
            },
            { once: true }
        )

        try {
            await playback.play()
        } catch {
            playbackRef.current = null
            if (nextVoiceResponse.latency) {
                reportVoiceLatency(nextVoiceResponse.latency)
            }
            setVoiceState(getVoiceStateAfterPlayback({ requiresReview }))
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
            const result = await askAssistant(
                petId,
                trimmedQuestion,
                conversationContextRef.current
            )
            const requiresReview = showAssistantResult(result, trimmedQuestion)
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
            const requestStartedAt =
                globalThis.performance?.now?.() ?? Date.now()
            const result = await askAssistantByVoice(
                petId,
                audioBlob,
                conversationContextRef.current
            )
            const responseReceivedAt =
                globalThis.performance?.now?.() ?? Date.now()
            const transcript = result.transcript?.trim()

            if (!transcript) {
                throw new Error("I couldn’t make out any words. Try again.")
            }

            const requiresReview = showAssistantResult(result, transcript)
            const latency = createVoiceLatencySummary({
                serverTimings: result.voice.timings,
                requestStartedAt,
                responseReceivedAt,
            })
            const nextVoiceResponse = {
                audioUrl: result.voice.audio_base64
                    ? `data:${result.voice.content_type};base64,${result.voice.audio_base64}`
                    : null,
                disclosure: result.voice.disclosure,
                requiresReview,
                latency,
            }

            setVoiceResponse(nextVoiceResponse)
            setQuestion("")
            if (result.voice.speech_error) {
                setError(result.voice.speech_error.error)
            }
            await playVoiceAnswer(nextVoiceResponse, { requiresReview })
        } catch (err) {
            setError(err?.message || "TomoCare could not answer by voice right now.")
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
            silenceDetectorCleanupRef.current = startSilenceDetection(stream, {
                onSilence: stopRecording,
            })
            recordingTimerRef.current = setTimeout(stopRecording, MAX_RECORDING_MS)
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
            stopPlayback({ requiresReview: voiceResponse?.requiresReview })
        }
    }

    function handleSubmit(event) {
        event.preventDefault()
        handleAsk()
    }

    function clearSession() {
        stopPlayback()
        avatarMediaRef.current?.end()
        setSessionTurns([])
        setVoiceResponse(null)
        setQuestion("")
        setError("")
        setVoiceState(VOICE_STATES.IDLE)
        setVoiceTranscriptOpen(false)
        conversationContextRef.current = null
        lastAnswerRef.current = null
    }

    const showSuggestions = sessionTurns.length === 0 && !loading
    const reminderById = useMemo(
        () => new Map(reminders.map((reminder) => [reminder.id, reminder])),
        [reminders]
    )

    return (
        <section
            className={`tomo-conversation-panel tomo-conversation-panel--${mode}`}
            aria-label="Talk with Tomo"
        >
            <header className="tomo-conversation-header">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        className={`tomo-presence-dot tomo-presence-dot--${voiceState}`}
                        aria-hidden="true"
                    />
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-tomo-text-h">Tomo</h1>
                        <p className="truncate text-xs text-tomo-text">
                            {getVoiceStateLabel(voiceState)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {pendingActionCount > 0 && (
                        <div className="relative">
                            <button
                                type="button"
                                className="tomo-badge tomo-badge--warning inline-flex cursor-pointer items-center gap-1.5"
                                onClick={handlePendingButton}
                                disabled={Boolean(pendingActionLoading)}
                                aria-expanded={
                                    pendingActions.length > 1
                                        ? pendingMenuOpen
                                        : undefined
                                }
                                aria-haspopup={
                                    pendingActions.length > 1
                                        ? "menu"
                                        : undefined
                                }
                            >
                                {pendingActionLoading
                                    ? "Opening…"
                                    : `Review ${pendingActionCount} pending`}
                            </button>

                            {pendingMenuOpen && pendingActions.length > 1 && (
                                <div
                                    className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-tomo-border bg-[#202129] p-2 shadow-2xl"
                                    role="menu"
                                    aria-label="Pending care actions"
                                >
                                    {pendingActions.map((action) => (
                                        <button
                                            key={action.id}
                                            type="button"
                                            role="menuitem"
                                            className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tomo-accent"
                                            onClick={() =>
                                                void reviewPendingAction(action.id)
                                            }
                                        >
                                            <span>
                                                <span className="block text-sm font-medium text-tomo-text-h">
                                                    {action.preview_json?.title ||
                                                        "Pending care action"}
                                                </span>
                                                <span className="mt-1 block text-xs capitalize text-tomo-text">
                                                    {action.status}
                                                </span>
                                            </span>
                                            <span
                                                className="material-symbols-outlined text-lg text-tomo-text"
                                                aria-hidden="true"
                                            >
                                                chevron_right
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        type="button"
                        className="tomo-icon-button"
                        onClick={onToggleContext}
                        aria-pressed={contextDrawerOpen}
                        aria-label={
                            contextDrawerOpen
                                ? "Hide care details"
                                : "Show care details"
                        }
                        title={
                            contextDrawerOpen
                                ? "Hide care details"
                                : "Show care details"
                        }
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">
                            {contextDrawerOpen ? "menu_open" : "menu"}
                        </span>
                    </button>

                    <div className="tomo-mode-switch" role="group" aria-label="Conversation mode">
                        <ModeButton
                            active={mode === CONVERSATION_MODES.VOICE}
                            icon="graphic_eq"
                            label="Voice"
                            onClick={() => setMode(CONVERSATION_MODES.VOICE)}
                        />
                        <ModeButton
                            active={mode === CONVERSATION_MODES.CHAT}
                            icon="chat"
                            label="Chat"
                            onClick={() => setMode(CONVERSATION_MODES.CHAT)}
                        />
                    </div>
                </div>
            </header>

            {mode === CONVERSATION_MODES.VOICE ? (
                <VoiceStage
                    voiceState={voiceState}
                    sessionTurns={sessionTurns}
                    loading={loading}
                    transcriptOpen={voiceTranscriptOpen}
                    reminderById={reminderById}
                    error={error}
                    response={voiceResponse}
                    muted={voiceMuted}
                    avatarMediaRef={avatarMediaRef}
                    onClear={clearSession}
                    onToggleTranscript={() =>
                        setVoiceTranscriptOpen((open) => !open)
                    }
                    onVoiceButton={handleVoiceButton}
                    onReplay={() =>
                        playVoiceAnswer(voiceResponse, {
                            requiresReview: voiceResponse?.requiresReview,
                        })
                    }
                    onStop={() =>
                        stopPlayback({
                            requiresReview: voiceResponse?.requiresReview,
                        })
                    }
                    onToggleMute={toggleMute}
                    transcriptEndRef={transcriptEndRef}
                />
            ) : (
                <>
                    <div className="tomo-conversation-scroll">
                        <SessionTranscript
                            sessionTurns={sessionTurns}
                            showSuggestions={showSuggestions}
                            reminderById={reminderById}
                            onAsk={handleAsk}
                            onClear={clearSession}
                            transcriptEndRef={transcriptEndRef}
                        />
                    </div>

                    <footer className="tomo-conversation-composer">
                        <form
                            onSubmit={handleSubmit}
                            className="tomo-chat-composer-box"
                        >
                            <label className="sr-only" htmlFor="tomo-chat-input">
                                Message Tomo
                            </label>
                            <textarea
                                id="tomo-chat-input"
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" &&
                                        !event.shiftKey &&
                                        !event.nativeEvent.isComposing
                                    ) {
                                        event.preventDefault()
                                        if (!loading && question.trim()) handleAsk()
                                    }
                                }}
                                placeholder="Ask Tomo about Momo’s care…"
                                className="tomo-chat-input"
                                rows={3}
                            />
                            <button
                                type="submit"
                                disabled={loading || !question.trim()}
                                className="tomo-btn tomo-btn-primary min-h-11 min-w-11 px-3"
                                aria-label="Send message"
                            >
                                <span
                                    className="material-symbols-outlined"
                                    aria-hidden="true"
                                >
                                    arrow_upward
                                </span>
                            </button>
                        </form>

                        {error && <ConversationError message={error} />}
                        <VerifiedCareBoundary />
                    </footer>
                </>
            )}

            <p className="sr-only" aria-live="polite" aria-atomic="true">
                {getVoiceStateLabel(voiceState)}
            </p>
        </section>
    )
}

function ModeButton({ active, icon, label, onClick }) {
    return (
        <button
            type="button"
            className={`tomo-mode-switch__button ${active ? "tomo-mode-switch__button--active" : ""}`}
            onClick={onClick}
            aria-pressed={active}
        >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
                {icon}
            </span>
            <span className="hidden sm:inline">{label}</span>
        </button>
    )
}

function VoiceStage({
    voiceState,
    sessionTurns,
    loading,
    transcriptOpen,
    reminderById,
    error,
    response,
    muted,
    avatarMediaRef,
    onClear,
    onToggleTranscript,
    onVoiceButton,
    onReplay,
    onStop,
    onToggleMute,
    transcriptEndRef,
}) {
    return (
        <section
            className={`tomo-voice-stage tomo-voice-stage--${voiceState} ${
                transcriptOpen ? "tomo-voice-stage--transcript-open" : ""
            }`}
            aria-label="Voice conversation with Tomo"
        >
            <div className="tomo-voice-stage__focus">
                <div className="tomo-voice-stage__media">
                    <RunwayAvatarMedia
                        ref={avatarMediaRef}
                        fallbackSrc={tomoVoiceAvatar}
                        fallbackAlt="Tomo, Momo’s care companion"
                        voiceState={voiceState}
                        muted={muted}
                    />
                </div>
                <div className="tomo-voice-stage__veil" aria-hidden="true" />

                <div className="tomo-voice-stage__status" aria-hidden="true">
                    <VoiceStatusOrb voiceState={voiceState} />
                    <span>{getVoiceStateLabel(voiceState)}</span>
                </div>

                <VoiceControlDock
                    voiceState={voiceState}
                    loading={loading}
                    transcriptOpen={transcriptOpen}
                    response={response}
                    muted={muted}
                    error={error}
                    onToggleTranscript={onToggleTranscript}
                    onVoiceButton={onVoiceButton}
                    onReplay={onReplay}
                    onStop={onStop}
                    onToggleMute={onToggleMute}
                />
            </div>

            {transcriptOpen && (
                <VoiceTranscriptSheet
                    sessionTurns={sessionTurns}
                    reminderById={reminderById}
                    onClear={onClear}
                    onClose={onToggleTranscript}
                    transcriptEndRef={transcriptEndRef}
                />
            )}
        </section>
    )
}

function VoiceControlDock({
    voiceState,
    loading,
    transcriptOpen,
    response,
    muted,
    error,
    onToggleTranscript,
    onVoiceButton,
    onReplay,
    onStop,
    onToggleMute,
}) {
    const listening = voiceState === VOICE_STATES.LISTENING

    return (
        <div className="tomo-voice-stage__controls">
            {error && <ConversationError message={error} compact />}
            <div className={`tomo-voice-dock tomo-voice-dock--${voiceState}`}>
                <button
                    type="button"
                    onClick={onVoiceButton}
                    disabled={loading && !listening}
                    aria-pressed={listening}
                    className={`tomo-voice-dock__primary ${
                        listening ? "tomo-voice-dock__primary--listening" : ""
                    }`}
                >
                    <span className="tomo-voice-dock__icon" aria-hidden="true">
                        <span className="material-symbols-outlined">
                            {listening ? "stop" : "mic"}
                        </span>
                    </span>
                    <span className="tomo-voice-dock__copy">
                        <strong>
                            {listening
                                ? "Listening…"
                                : loading
                                  ? "Tomo is thinking…"
                                  : "Start speaking"}
                        </strong>
                        <small>
                            {listening
                                ? "Pause naturally when you’re done"
                                : getVoiceStateLabel(voiceState)}
                        </small>
                    </span>
                </button>

                {response && (
                    <VoicePlaybackControls
                        response={response}
                        loading={loading}
                        state={voiceState}
                        muted={muted}
                        onReplay={onReplay}
                        onStop={onStop}
                        onToggleMute={onToggleMute}
                    />
                )}
                <button
                    type="button"
                    className="tomo-voice-transcript-control"
                    onClick={onToggleTranscript}
                    aria-expanded={transcriptOpen}
                    aria-controls="tomo-voice-transcript"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">
                        subject
                    </span>
                    <span>Transcript</span>
                </button>
            </div>
            <VerifiedCareBoundary />
        </div>
    )
}

function VoiceTranscriptSheet({
    sessionTurns,
    reminderById,
    onClear,
    onClose,
    transcriptEndRef,
}) {
    return (
        <aside
            id="tomo-voice-transcript"
            className="tomo-voice-transcript-sheet"
            aria-label="Full session transcript"
        >
            <header className="tomo-voice-transcript-sheet__header">
                <div>
                    <p className="tomo-section-label">Today · Session only</p>
                    <h2>Conversation</h2>
                </div>
                <div className="flex items-center gap-1">
                    {sessionTurns.length > 0 && (
                        <button
                            type="button"
                            className="tomo-btn tomo-btn-tertiary px-2 py-1 text-xs"
                            onClick={onClear}
                        >
                            Clear
                        </button>
                    )}
                    <button
                        type="button"
                        className="tomo-icon-button"
                        onClick={onClose}
                        aria-label="Close full transcript"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">
                            close
                        </span>
                    </button>
                </div>
            </header>
            <div className="tomo-voice-transcript-sheet__body">
                {sessionTurns.length === 0 ? (
                    <EmptyConversation />
                ) : (
                    <div className="space-y-6">
                        {sessionTurns.map((turn) =>
                            turn.role === "user" ? (
                                <UserTurn key={turn.id}>{turn.text}</UserTurn>
                            ) : (
                                <AssistantTurn
                                    key={turn.id}
                                    answer={turn.answer}
                                    reminderById={reminderById}
                                />
                            )
                        )}
                    </div>
                )}
                <div ref={transcriptEndRef} />
            </div>
        </aside>
    )
}

function SessionTranscript({
    sessionTurns,
    showSuggestions,
    reminderById,
    onAsk,
    onClear,
    transcriptEndRef,
}) {
    return (
        <section className="tomo-session-transcript" aria-label="Current session transcript">
            <div className="flex items-center justify-between gap-3 border-b border-tomo-border pb-2">
                <p className="text-xs text-tomo-text">Today · Session only</p>
                {sessionTurns.length > 0 && (
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-tertiary px-2 py-1 text-xs"
                        onClick={onClear}
                    >
                        Clear
                    </button>
                )}
            </div>

            {sessionTurns.length === 0 ? (
                <EmptyConversation />
            ) : (
                <div className="mt-5 space-y-6">
                    {sessionTurns.map((turn) =>
                        turn.role === "user" ? (
                            <UserTurn key={turn.id}>{turn.text}</UserTurn>
                        ) : (
                            <AssistantTurn
                                key={turn.id}
                                answer={turn.answer}
                                reminderById={reminderById}
                            />
                        )
                    )}
                </div>
            )}

            {showSuggestions && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {SUGGESTED_QUESTIONS.map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => onAsk(item)}
                            className="tomo-suggestion"
                        >
                            {item}
                        </button>
                    ))}
                </div>
            )}

            <div ref={transcriptEndRef} />
        </section>
    )
}

function VoiceStatusOrb({ voiceState }) {
    return (
        <span className={`tomo-voice-status tomo-voice-status--${voiceState}`}>
            <span className="tomo-voice-status__orb">
                <span />
                <span />
                <span />
            </span>
        </span>
    )
}

function VerifiedCareBoundary() {
    return (
        <p className="tomo-verified-boundary">
            <span
                className="material-symbols-outlined text-sm text-tomo-success"
                aria-hidden="true"
            >
                verified_user
            </span>
            Answers use verified records. Changes still require approval.
        </p>
    )
}

function ConversationError({ message, compact = false }) {
    return (
        <div
            className={`tomo-conversation-error ${
                compact ? "tomo-conversation-error--compact" : ""
            }`}
            role="alert"
        >
            {message}
        </div>
    )
}

function EmptyConversation() {
    return (
        <div className="mx-auto mt-8 max-w-lg text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-tomo-text-h">
                What should we check for Momo?
            </h2>
            <p className="mt-3 text-sm leading-6 text-tomo-text">
                Ask from Momo’s trusted records. The same session continues when you
                switch back to Voice.
            </p>
        </div>
    )
}

function UserTurn({ children }) {
    return (
        <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-3 text-base leading-6 text-tomo-text-h">
            <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-tomo-text">
                You
            </p>
            <p>{children}</p>
        </div>
    )
}

function AssistantTurn({ answer, reminderById }) {
    const isActionRequest = answer.answer_type === "action_request"
    const isPreparedAction = answer.answer_type === "action_prepared"
    const isPreparedMessage = answer.answer_type === "message_draft_prepared"
    const needsClarification = answer.answer_type === "clarification_needed"
    const badgeLabel =
        answer.answer_type === "social_response"
            ? "Tomo"
            : isPreparedMessage
              ? "Draft ready"
              : isPreparedAction
                ? "Ready to review"
                : needsClarification
                  ? "Needs details"
                  : isActionRequest
                    ? "Approval required"
                    : "Grounded answer"
    const visibleCitations = getRecentVerifiedSources(answer.citations)
    const citationLabel = getVerifiedSourcesLabel({
        visibleCount: visibleCitations.length,
        totalCount: answer.citations?.length || 0,
    })

    return (
        <article className="max-w-[92%]">
            <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-tomo-border">
                    <img src={tomoLogo} alt="" className="h-full w-full object-cover" />
                </span>
                <p className="text-xs font-semibold text-tomo-text-h">Tomo</p>
                <span
                    className={`tomo-badge ml-auto ${
                        isActionRequest || needsClarification
                            ? "tomo-badge--warning"
                            : "tomo-badge--success"
                    }`}
                >
                    {badgeLabel}
                </span>
            </div>

            <p
                className="tomo-answer-fresh mt-3 text-base leading-7 text-tomo-text-h"
                aria-live="polite"
            >
                {answer.answer}
            </p>

            {answer.transcript_corrections?.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-tomo-text">
                    {answer.transcript_corrections.map((correction) => (
                        <p key={`${correction.heard}-${correction.interpreted_as}`}>
                            {`Heard “${correction.heard}” · Interpreted as “${correction.interpreted_as}”`}
                        </p>
                    ))}
                </div>
            )}

            {answer.semantic_interpretation?.status === "applied" &&
                answer.semantic_interpretation?.interpretation_label && (
                    <p className="mt-2 text-xs text-tomo-text">
                        {`Understood as “${answer.semantic_interpretation.interpretation_label}”${
                            answer.semantic_interpretation.used_previous_context
                                ? " using the previous care question"
                                : ""
                        }`}
                    </p>
                )}

            {visibleCitations.length > 0 && (
                <details className="mt-4 rounded-xl border border-tomo-border bg-white/[0.02] px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-tomo-text-h">
                        {citationLabel}
                    </summary>
                    <div className="mt-3 space-y-2">
                        {visibleCitations.map((citation, index) => (
                            <EvidenceCard
                                key={`${citation.type}-${citation.id || index}`}
                                citation={citation}
                                reminder={reminderById.get(citation.id) || null}
                            />
                        ))}
                    </div>
                </details>
            )}

            {answer.limitations?.length > 0 && (
                <div className="mt-4 rounded-xl border border-tomo-border bg-white/[0.02] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-tomo-text">
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
                <div className="mt-4 rounded-xl border border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-tomo-warning">
                        Routed to approval gate
                    </p>
                    <p className="mt-2 text-sm leading-6 text-tomo-text-h">
                        {answer.proposed_action.reason}
                    </p>
                </div>
            )}
        </article>
    )
}

function VoicePlaybackControls({
    response,
    loading,
    state,
    muted,
    onReplay,
    onStop,
    onToggleMute,
}) {
    return (
        <div className="tomo-voice-playback-controls">
            <button
                type="button"
                onClick={onReplay}
                disabled={loading || !response.audioUrl || state === VOICE_STATES.LISTENING}
                className="tomo-voice-playback-control"
            >
                <span className="material-symbols-outlined" aria-hidden="true">
                    replay
                </span>
                Replay
            </button>
            <button
                type="button"
                onClick={onStop}
                disabled={state !== VOICE_STATES.SPEAKING}
                className="tomo-voice-playback-control"
            >
                <span className="material-symbols-outlined" aria-hidden="true">
                    stop_circle
                </span>
                Stop audio
            </button>
            <button
                type="button"
                onClick={onToggleMute}
                aria-pressed={muted}
                className="tomo-voice-playback-control"
            >
                <span className="material-symbols-outlined" aria-hidden="true">
                    {muted ? "volume_off" : "volume_up"}
                </span>
                {muted ? "Unmute" : "Mute"}
            </button>
            {response.disclosure && (
                <span className="tomo-voice-playback-controls__disclosure">
                    {response.disclosure}
                </span>
            )}
        </div>
    )
}
