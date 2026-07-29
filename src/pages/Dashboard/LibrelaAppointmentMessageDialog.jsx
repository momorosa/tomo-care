import { useState } from "react"

const BUSY_PHASES = new Set([
    "preparing",
    "cancelling",
    "approving",
    "executing",
    "recovering",
])

export default function LibrelaAppointmentMessageDialog({
    draft,
    phase = "drafting",
    action = null,
    error = null,
    execution = null,
    onApproveAndSend,
    onApprove,
    onExecute,
    onEditMessage,
    onRetryRecovery,
    onDismiss,
}) {
    const [messageBody, setMessageBody] = useState(draft.message_body)
    const [copyState, setCopyState] = useState("idle")
    const [copyError, setCopyError] = useState("")

    const busy = BUSY_PHASES.has(phase)
    const frozen = Boolean(action)
    const terminal = ["succeeded", "failed", "outcome_unknown"].includes(
        phase
    )

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

    function handlePrimaryAction() {
        if (phase === "drafting") {
            onApproveAndSend?.(messageBody)
            return
        }

        if (phase === "reviewing") {
            onApprove?.()
            return
        }

        if (phase === "approved") {
            onExecute?.()
            return
        }

        if (phase === "recovery_error") {
            onRetryRecovery?.()
            return
        }

        if (terminal) {
            onDismiss?.()
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
                                Governed appointment request
                            </p>
                            <h2
                                id="librela-message-title"
                                className="mt-2 text-2xl font-semibold tracking-tight text-tomo-text-h"
                            >
                                {getDialogTitle(phase)}
                            </h2>
                        </div>

                        {!busy &&
                            !["approved", "recovery_error"].includes(phase) && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="tomo-btn tomo-btn-tertiary h-9 w-9 shrink-0 px-0"
                                aria-label="Close appointment request"
                            >
                                <span className="material-symbols-outlined text-xl">
                                    close
                                </span>
                            </button>
                            )}
                    </div>
                </div>

                <div className="px-6 py-6 md:px-7">
                    <DeliveryState
                        phase={phase}
                        recipientName={draft.recipient_name}
                        error={error}
                        execution={execution}
                    />

                    <div className="mt-5 rounded-2xl border border-tomo-border bg-white/[0.025] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="tomo-section-label">Recipient</p>
                                <p className="mt-2 text-base font-semibold text-tomo-text-h">
                                    {draft.recipient_name}
                                </p>
                            </div>
                            <span
                                className={`tomo-badge ${
                                    frozen
                                        ? "tomo-badge--success"
                                        : "tomo-badge--brand"
                                }`}
                            >
                                {frozen
                                    ? "Verified SMS recipient"
                                    : "Trusted clinic"}
                            </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-tomo-text">
                            {frozen
                                ? "TomoCare verified the clinic’s active SMS contact before freezing this request. The private number stays server-side."
                                : "TomoCare will verify the clinic’s active SMS contact before approval. The private number will stay server-side."}
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
                            {frozen
                                ? "This exact version is frozen for the current approval. Choose Edit message to cancel the proposal and create a new one."
                                : "You can edit this message until you approve it."}
                        </span>
                        <textarea
                            value={messageBody}
                            onChange={(event) => {
                                setMessageBody(event.target.value)
                                setCopyState("idle")
                                setCopyError("")
                            }}
                            readOnly={frozen || busy}
                            rows={9}
                            className="mt-2 w-full resize-y rounded-xl border border-tomo-border bg-white/[0.035] px-4 py-3 text-sm leading-6 text-tomo-text-h focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tomo-accent read-only:cursor-default read-only:opacity-80"
                        />
                    </label>

                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-tomo-border bg-white/[0.025] px-4 py-3">
                        <span
                            className="material-symbols-outlined mt-0.5 shrink-0 text-xl leading-none text-tomo-text"
                            aria-hidden="true"
                        >
                            info
                        </span>
                        <div>
                            <p className="text-sm font-medium text-tomo-text-h">
                                Test mode: no message will be sent
                            </p>
                            <p className="mt-1 text-xs leading-5 text-tomo-text">
                                Approve &amp; send lets you try the full flow and
                                saves the result. SoMa Animal Hospital will not
                                receive a text, and no appointment will be booked.
                            </p>
                        </div>
                    </div>

                    {(copyError || (error && phase === "drafting")) && (
                        <div className="mt-5 rounded-xl border border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] px-4 py-3">
                            <p className="text-sm font-medium text-tomo-danger">
                                {copyError || getErrorMessage(error)}
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

                    <DialogActions
                        phase={phase}
                        busy={busy}
                        frozen={frozen}
                        terminal={terminal}
                        messageBody={messageBody}
                        copyState={copyState}
                        onCopy={copyMessage}
                        onEditMessage={onEditMessage}
                        onPrimary={handlePrimaryAction}
                    />
                </div>
            </section>
        </div>
    )
}

function DeliveryState({ phase, recipientName, error, execution }) {
    const state = getDeliveryState({ phase, recipientName, error, execution })

    if (!state) return null

    return (
        <div
            className={`rounded-2xl border p-5 ${state.className}`}
            role={state.role}
        >
            <div className="flex items-start gap-3">
                {state.showSpinner ? (
                    <span className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                    <span
                        className="material-symbols-outlined mt-0.5 shrink-0 text-xl"
                        aria-hidden="true"
                    >
                        {state.icon}
                    </span>
                )}
                <div>
                    <p className="text-sm font-semibold">{state.title}</p>
                    <p className="mt-1 text-sm leading-6 text-tomo-text-h">
                        {state.body}
                    </p>
                </div>
            </div>
        </div>
    )
}

function getDeliveryState({ phase, recipientName, error, execution }) {
    if (phase === "preparing") {
        return progressState(
            "Preparing the exact request",
            "TomoCare is verifying the recipient and freezing the message you reviewed."
        )
    }

    if (phase === "approving") {
        return progressState(
            "Recording your approval",
            "The exact message and verified recipient are locked. Nothing has been sent yet."
        )
    }

    if (phase === "executing") {
        return progressState(
            "Completing the test",
            "TomoCare is recording the approved request and its test result. No real message will be sent."
        )
    }

    if (phase === "recovering") {
        return progressState(
            "Checking delivery status",
            "TomoCare is recovering the server-owned action before showing the next step."
        )
    }

    if (phase === "reviewing") {
        return {
            className:
                "border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] text-tomo-warning",
            icon: "lock",
            title: "Approval still needed",
            body:
                error?.message ||
                `The exact request to ${recipientName} is frozen but has not been approved or sent.`,
        }
    }

    if (phase === "approved") {
        return {
            className:
                "border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] text-tomo-warning",
            icon: "verified_user",
            title: "Approved, but not sent",
            body:
                error?.message ||
                "Your approval is saved. Continue to complete the test. No real message will be sent.",
        }
    }

    if (phase === "succeeded") {
        const providerMode =
            execution?.result?.provider_mode || execution?.provider_mode

        return {
            className:
                "border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)] text-tomo-success",
            icon: "check_circle",
            title: "Test complete",
            body:
                providerMode === "mock"
                    ? `TomoCare saved your approval and completed the test. ${recipientName} was not contacted, and no appointment was booked.`
                    : `The approved request to ${recipientName} completed successfully.`,
            role: "status",
        }
    }

    if (phase === "failed") {
        return {
            className:
                "border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] text-tomo-danger",
            icon: "error",
            title: "Message not sent",
            body:
                error?.message ||
                "The provider rejected this delivery. The attempt is locked and will not retry automatically.",
            role: "alert",
        }
    }

    if (phase === "outcome_unknown") {
        return {
            className:
                "border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] text-tomo-warning",
            icon: "help",
            title: "Delivery outcome unknown",
            body:
                error?.message ||
                "TomoCare cannot confirm whether the provider accepted this request. It is locked to prevent a duplicate message.",
            role: "alert",
        }
    }

    if (phase === "recovery_error") {
        return {
            className:
                "border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] text-tomo-warning",
            icon: "sync_problem",
            title: "Status could not be confirmed",
            body:
                error?.message ||
                "Check the server-owned action again before taking another step.",
            role: "alert",
        }
    }

    return null
}

function progressState(title, body) {
    return {
        className:
            "border-tomo-accent/30 bg-tomo-accent/10 text-tomo-accent",
        title,
        body,
        showSpinner: true,
        role: "status",
    }
}

function DialogActions({
    phase,
    busy,
    frozen,
    terminal,
    messageBody,
    copyState,
    onCopy,
    onEditMessage,
    onPrimary,
}) {
    const canCopy = !busy && !terminal
    const canEdit = frozen && phase === "reviewing"
    const showPrimary =
        ["drafting", "reviewing", "approved", "recovery_error"].includes(
            phase
        ) || terminal

    return (
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {canEdit && (
                <button
                    type="button"
                    className="tomo-btn tomo-btn-secondary px-5 py-2"
                    onClick={onEditMessage}
                >
                    Edit message
                </button>
            )}

            {canCopy && !canEdit && (
                <button
                    type="button"
                    className="tomo-btn tomo-btn-secondary px-5 py-2"
                    onClick={onCopy}
                    disabled={copyState === "copying" || !messageBody.trim()}
                >
                    {copyState === "copying"
                        ? "Copying…"
                        : copyState === "copied"
                          ? "Copied"
                          : "Copy message"}
                </button>
            )}

            {showPrimary && (
                <button
                    type="button"
                    className="tomo-btn tomo-btn-primary gap-2 px-5 py-2"
                    onClick={onPrimary}
                    disabled={busy || (!messageBody.trim() && !terminal)}
                >
                    {getPrimaryLabel(phase)}
                </button>
            )}
        </div>
    )
}

function getDialogTitle(phase) {
    if (phase === "succeeded") return "Librela request complete"
    if (phase === "failed") return "Librela request failed"
    if (phase === "outcome_unknown") return "Review delivery status"
    if (phase === "recovery_error") return "Check Librela request"

    return "Review Librela message"
}

function getPrimaryLabel(phase) {
    if (phase === "drafting" || phase === "reviewing") {
        return "Approve & send"
    }
    if (phase === "approved") return "Complete test"
    if (phase === "recovery_error") return "Check status"
    if (phase === "succeeded") return "Done"
    if (phase === "failed" || phase === "outcome_unknown") return "Close"

    return "Continue"
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

function getErrorMessage(error) {
    if (typeof error === "string") return error
    return error?.message || "TomoCare could not complete this request."
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
