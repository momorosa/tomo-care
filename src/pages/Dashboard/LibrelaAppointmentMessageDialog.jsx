import { useState } from "react"

export default function LibrelaAppointmentMessageDialog({
    draft,
    onDismiss,
}) {
    const [messageBody, setMessageBody] = useState(draft.message_body)
    const [copyState, setCopyState] = useState("idle")
    const [copyError, setCopyError] = useState("")

    async function copyMessage() {
        setCopyState("copying")
        setCopyError("")

        try {
            await navigator.clipboard.writeText(messageBody)
            setCopyState("copied")
        } catch {
            setCopyState("idle")
            setCopyError(
                "TomoCare couldn’t copy the message. Select the text and copy it manually."
            )
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6"
            role="presentation"
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="librela-message-title"
                className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-tomo-border bg-[#1b1c23] shadow-2xl md:rounded-3xl"
            >
                <div className="border-b border-tomo-border px-6 py-5 md:px-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="tomo-section-label text-tomo-accent">
                                Appointment request draft
                            </p>
                            <h2
                                id="librela-message-title"
                                className="mt-2 text-2xl font-semibold tracking-tight text-tomo-text-h"
                            >
                                Review Librela message
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={onDismiss}
                            className="tomo-btn tomo-btn-tertiary h-9 w-9 shrink-0 px-0"
                            aria-label="Close draft"
                        >
                            <span className="material-symbols-outlined text-xl">
                                close
                            </span>
                        </button>
                    </div>
                </div>

                <div className="px-6 py-6 md:px-7">
                    <div className="rounded-2xl border border-tomo-border bg-white/[0.025] p-5">
                        <p className="tomo-section-label">Proposed recipient</p>
                        <p className="mt-2 text-base font-semibold text-tomo-text-h">
                            {draft.recipient_name}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-tomo-text">
                            Clinic name from Momo’s trusted Librela record. No
                            phone number or email has been selected.
                        </p>

                        <p className="tomo-section-label mt-5">Purpose</p>
                        <p className="mt-2 text-sm font-medium text-tomo-text-h">
                            {draft.purpose}
                        </p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <DateSummary
                            label="Last injection"
                            value={
                                draft.dates?.last_verified_injection_date
                            }
                        />
                        <DateSummary
                            label="Reminder"
                            value={draft.dates?.reminder_date}
                        />
                        <DateSummary
                            label="Due around"
                            value={draft.dates?.due_date}
                        />
                    </div>

                    <label className="mt-6 block text-sm font-medium text-tomo-text-h">
                        Exact message
                        <span className="mt-1 block text-xs font-normal leading-5 text-tomo-text">
                            Edit this message before copying.
                        </span>
                        <textarea
                            value={messageBody}
                            onChange={(event) => {
                                setMessageBody(event.target.value)
                                setCopyState("idle")
                                setCopyError("")
                            }}
                            rows={9}
                            className="mt-2 w-full resize-y rounded-xl border border-tomo-border bg-white/[0.035] px-4 py-3 text-sm leading-6 text-tomo-text-h focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tomo-accent"
                        />
                    </label>

                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-tomo-accent/30 bg-tomo-accent/10 px-4 py-3">
                        <span
                            className="material-symbols-outlined mt-0.5 shrink-0 text-xl leading-none text-tomo-accent"
                            aria-hidden="true"
                        >
                            verified_user
                        </span>
                        <div>
                            <p className="text-sm font-medium text-tomo-text-h">
                                Draft only
                            </p>
                            <p className="mt-1 text-xs leading-5 text-tomo-text">
                                TomoCare cannot send this message or create an
                                appointment in this phase. Copying only places
                                your edited text on the clipboard.
                            </p>
                        </div>
                    </div>

                    {copyError && (
                        <div className="mt-5 rounded-xl border border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] px-4 py-3">
                            <p className="text-sm font-medium text-tomo-danger">
                                {copyError}
                            </p>
                        </div>
                    )}

                    {copyState === "copied" && (
                        <p
                            className="mt-4 text-sm font-medium text-tomo-success"
                            role="status"
                        >
                            Message copied. Nothing was sent.
                        </p>
                    )}

                    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            className="tomo-btn tomo-btn-primary px-5 py-2"
                            onClick={copyMessage}
                            disabled={
                                copyState === "copying" ||
                                !messageBody.trim()
                            }
                        >
                            {copyState === "copying"
                                ? "Copying…"
                                : copyState === "copied"
                                  ? "Copied"
                                  : "Copy message"}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )
}

function DateSummary({ label, value }) {
    return (
        <div className="rounded-xl border border-tomo-border bg-white/[0.025] px-4 py-3">
            <p className="tomo-section-label">{label}</p>
            <p className="mt-2 text-sm font-semibold text-tomo-text-h">
                {formatDate(value)}
            </p>
        </div>
    )
}

function formatDate(value) {
    if (!value) return "—"

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date)
}