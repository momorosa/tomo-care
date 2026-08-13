import { useState } from "react"
import { formatDisplayDate } from "../../lib/displayDate.js"

const BUSY_PHASES = new Set([
    "preparing",
    "cancelling",
    "approving",
    "executing",
    "handoff_preparing",
    "resolving_handoff",
    "recovering",
])

export default function LibrelaAppointmentMessageDialog({
    draft,
    phase = "drafting",
    action = null,
    error = null,
    execution = null,
    handoff = null,
    onApproveMessage,
    onApprove,
    onOpenInMessages,
    onResolveHandoff,
    onEditMessage,
    onRetryRecovery,
    onDismiss,
}) {
    const [messageBody, setMessageBody] = useState(draft.message_body)
    const [copyState, setCopyState] = useState("idle")
    const [copyError, setCopyError] = useState("")
    const [resolutionChoice, setResolutionChoice] = useState(null)

    const busy = BUSY_PHASES.has(phase)
    const frozen = Boolean(action)
    const terminal = [
        "succeeded",
        "failed",
        "outcome_unknown",
        "user_reported_sent",
        "user_confirmed_not_sent",
    ].includes(phase)

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
            onApproveMessage?.(messageBody)
            return
        }

        if (phase === "reviewing") {
            onApprove?.()
            return
        }

        if (
            phase === "approved" ||
            phase === "messages_handoff_requested"
        ) {
            onOpenInMessages?.()
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

                        {!busy && phase !== "recovery_error" && (
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
                        handoff={handoff}
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
                                ? `TomoCare verified the clinic’s active SMS contact before freezing this request.${handoff?.recipient_display ? ` ${handoff.recipient_display}.` : " The private number stays server-side until the native handoff is prepared."}`
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
                                ? phase === "reviewing"
                                    ? "This exact version is frozen for the current approval. Choose Edit message to cancel the proposal and create a new one."
                                    : "This is the exact message you approved. It cannot be changed within this action."
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
                                You make the final sending decision
                            </p>
                            <p className="mt-1 text-xs leading-5 text-tomo-text">
                                After approval, Open in Messages creates an
                                editable draft to the verified clinic. TomoCare
                                cannot tell whether you send or cancel it, and it
                                does not book an appointment.
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

                    {resolutionChoice &&
                        phase === "messages_handoff_requested" && (
                            <div className="mt-5 rounded-xl border border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] px-4 py-4 text-tomo-warning">
                                <p className="text-sm font-semibold">
                                    {resolutionChoice === "sent"
                                        ? "Confirm that you pressed Send"
                                        : "Confirm that you did not send it"}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-tomo-text-h">
                                    {resolutionChoice === "sent"
                                        ? "TomoCare will save this only as your report. It cannot verify delivery, a clinic response, or an appointment booking."
                                        : "TomoCare will close this request as not sent. You can prepare a fresh request later."}
                                </p>
                            </div>
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
                        onOpenInMessages={onOpenInMessages}
                        onResolveHandoff={onResolveHandoff}
                        resolutionChoice={resolutionChoice}
                        onResolutionChoice={setResolutionChoice}
                    />
                </div>
            </section>
        </div>
    )
}

function DeliveryState({ phase, recipientName, error, execution, handoff }) {
    const state = getDeliveryState({
        phase,
        recipientName,
        error,
        execution,
        handoff,
    })

    if (!state) return null

    return (
        <div
            className={`rounded-2xl border p-5 ${state.className}`}
            role={state.role}
        >
            <div className="flex items-start gap-3">
                {state.showSpinner ? (
                    <span className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : state.icon === "native_handoff" ? (
                    <svg
                        className="mt-0.5 h-5 w-5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M14 5h5v5" />
                        <path d="M10 14 19 5" />
                        <path d="M19 13v6H5V5h6" />
                    </svg>
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

function getDeliveryState({ phase, recipientName, error, execution, handoff }) {
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

    if (phase === "handoff_preparing") {
        return progressState(
            "Checking the approved request",
            "TomoCare is revalidating the trusted clinic and care information before preparing the native draft."
        )
    }

    if (phase === "resolving_handoff") {
        return progressState(
            "Saving your Messages outcome",
            "TomoCare is recording only the choice you confirmed."
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
                "Your approval is saved. Open the reviewed request in Messages when you are ready. Nothing has been sent.",
        }
    }

    if (phase === "messages_handoff_requested") {
        return {
            className:
                error
                    ? "border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] text-tomo-danger"
                    : "border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)] text-tomo-success",
            icon: "native_handoff",
            title: error
                ? "Messages outcome was not saved"
                : "Messages handoff requested",
            body:
                error?.message ||
                `TomoCare asked Chrome to open an editable draft for ${recipientName}${handoff?.recipient_display ? ` at the ${handoff.recipient_display.toLowerCase()}` : ""}. Send or cancel it in Messages. TomoCare has not recorded a send, delivery, or appointment booking.`,
            role: error ? "alert" : "status",
        }
    }

    if (phase === "user_reported_sent") {
        return {
            className:
                "border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)] text-tomo-success",
            icon: "check_circle",
            title: "Recorded from your report",
            body: `You reported that you pressed Send for the request to ${recipientName}. TomoCare has not verified delivery, a clinic response, or an appointment booking.`,
            role: "status",
        }
    }

    if (phase === "user_confirmed_not_sent") {
        return {
            className:
                "border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)] text-tomo-success",
            icon: "cancel",
            title: "Closed as not sent",
            body:
                "You confirmed that you did not send the Messages draft. This request is no longer pending, and you can prepare a fresh one later.",
            role: "status",
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
    onOpenInMessages,
    onResolveHandoff,
    resolutionChoice,
    onResolutionChoice,
}) {
    const canCopy = !busy && !terminal
    const canEdit = frozen && phase === "reviewing"
    const showPrimary =
        [
            "drafting",
            "reviewing",
            "approved",
            "messages_handoff_requested",
            "recovery_error",
        ].includes(phase) || terminal

    if (phase === "messages_handoff_requested") {
        if (resolutionChoice) {
            return (
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-secondary px-5 py-2"
                        onClick={() => onResolutionChoice(null)}
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-primary px-5 py-2"
                        onClick={() => onResolveHandoff?.(resolutionChoice)}
                    >
                        {resolutionChoice === "sent"
                            ? "Yes, I sent it"
                            : "Close as not sent"}
                    </button>
                </div>
            )
        }

        return (
            <div className="mt-7 flex flex-wrap justify-end gap-3">
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
                <button
                    type="button"
                    className="tomo-btn tomo-btn-secondary px-5 py-2"
                    onClick={() => onResolutionChoice("not_sent")}
                >
                    I didn’t send it
                </button>
                <button
                    type="button"
                    className="tomo-btn tomo-btn-secondary px-5 py-2"
                    onClick={onOpenInMessages}
                >
                    Open in Messages again
                </button>
                <button
                    type="button"
                    className="tomo-btn tomo-btn-primary px-5 py-2"
                    onClick={() => onResolutionChoice("sent")}
                >
                    I sent it
                </button>
            </div>
        )
    }

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

            {canCopy && (
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
    if (phase === "messages_handoff_requested") return "Messages handoff ready"
    if (phase === "user_reported_sent") return "Messages outcome recorded"
    if (phase === "user_confirmed_not_sent") return "Request closed"
    if (phase === "succeeded") return "Librela request complete"
    if (phase === "failed") return "Librela request failed"
    if (phase === "outcome_unknown") return "Review delivery status"
    if (phase === "recovery_error") return "Check Librela request"

    return "Review Librela message"
}

function getPrimaryLabel(phase) {
    if (phase === "drafting" || phase === "reviewing") {
        return "Approve message"
    }
    if (phase === "approved") return "Open in Messages"
    if (phase === "messages_handoff_requested") {
        return "Open in Messages again"
    }
    if (phase === "recovery_error") return "Check status"
    if (phase === "succeeded") return "Done"
    if (
        phase === "user_reported_sent" ||
        phase === "user_confirmed_not_sent"
    ) {
        return "Done"
    }
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
    return formatDisplayDate(value)
}
