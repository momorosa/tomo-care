import { useState } from "react"
import { askAssistant } from "./api.js"

const SUGGESTED_QUESTIONS = [
    "When was Momo last given Librela?",
    "When is Momo next due for Librela?",
    "What reminders are active?",
    "How much have I spent on Librela?",
]

export default function AssistantPanel({ petId }) {
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleAsk(nextQuestion) {
        const trimmedQuestion = (nextQuestion || question).trim()

        if (!trimmedQuestion) return

        setLoading(true)
        setError("")

        try {
            const result = await askAssistant(petId, trimmedQuestion)
            setAnswer({
                question: trimmedQuestion,
                ...result,
            })
            setQuestion("")
        } catch (err) {
            setError(err?.message || "TomoCare could not answer right now.")
        } finally {
            setLoading(false)
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
                        Phase 3A is read-only. TomoCare can answer from verified records,
                        cite what it used, and route action requests back to approval.
                    </p>
                </div>

                <span className="tomo-badge tomo-badge--brand shrink-0">
                    Verified data only
                </span>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 md:flex-row">
                <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask about Librela, reminders, spend, or verified records..."
                    className="
                        min-h-11 flex-1 rounded-xl border border-tomo-border
                        bg-white/[0.025] px-4 py-2 text-sm text-tomo-text-h
                        placeholder:text-tomo-text/70
                        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tomo-accent
                    "
                />

                <button
                    type="submit"
                    disabled={loading || !question.trim()}
                    className="tomo-btn tomo-btn-primary min-h-11 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? "Asking..." : "Ask"}
                </button>
            </form>

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

            {error && (
                <div className="mt-5 rounded-xl border border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] px-4 py-3 text-sm text-tomo-danger">
                    {error}
                </div>
            )}

            {answer && (
                <AssistantAnswer answer={answer} />
            )}
        </section>
    )
}

function AssistantAnswer({ answer }) {
    const isActionRequest = answer.answer_type === "action_request"

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
                </div>

                <span
                    className={`tomo-badge ${
                        isActionRequest ? "tomo-badge--warning" : "tomo-badge--success"
                    }`}
                >
                    {isActionRequest ? "Approval required" : "Grounded answer"}
                </span>
            </div>

            <div className="mt-5 rounded-xl border border-tomo-border bg-[#111219]/60 px-4 py-4">
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
                            <CitationRow
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

            {answer.proposed_action && (
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

function CitationRow({ citation }) {
    return (
        <div className="rounded-xl border border-tomo-border bg-white/[0.02] px-3 py-2">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <p className="text-sm font-medium text-tomo-text-h">
                    {citation.label || "Trusted record"}
                </p>
                {citation.date && (
                    <p className="text-xs text-tomo-text">
                        {citation.date}
                    </p>
                )}
            </div>

            <p className="mt-1 text-xs text-tomo-text">
                {citation.table}
                {citation.doc_id ? ` · doc ${shortId(citation.doc_id)}` : ""}
            </p>
        </div>
    )
}

function shortId(value) {
    if (!value) return ""
    return value.slice(0, 8)
}