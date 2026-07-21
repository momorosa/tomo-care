const BUSY_PHASES = new Set(["recovering", "preparing", "cancelling", "approving", "executing"])

export default function CareActionDialog({
    phase,
    reminder,
    action,
    administeredDate,
    maxDate,
    error,
    execution,
    onDateChange,
    onPrepare,
    onDismiss,
    onChangeDate,
    onCancelProposal,
    onApproveAndExecute,
    onExecute,
    onRetryRecovery,
    onDone,
}) {
    if (phase === "idle") return null

    const busy = BUSY_PHASES.has(phase)
    const careItem =
        action?.preview_json?.care_item ||
        reminder?.details_json?.care_item ||
        reminder?.title ||
        "home medication"

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6"
            role="presentation"
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="care-action-title"
                className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-tomo-border bg-[#1b1c23] shadow-2xl md:rounded-3xl"
            >
                <div className="border-b border-tomo-border px-6 py-5 md:px-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="tomo-section-label text-tomo-accent">
                                Governed care action
                            </p>
                            <h2
                                id="care-action-title"
                                className="mt-2 text-2xl font-semibold tracking-tight text-tomo-text-h"
                            >
                                {getDialogTitle(phase, careItem)}
                            </h2>
                        </div>

                        {!busy && phase !== "succeeded" && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="tomo-btn tomo-btn-tertiary h-9 w-9 shrink-0 px-0"
                                aria-label="Close"
                            >
                                <span className="material-symbols-outlined text-xl">
                                    close
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="px-6 py-6 md:px-7">
                    {(phase === "choosing" || phase === "preparing") && (
                        <ChooseDateStep
                            careItem={careItem}
                            administeredDate={administeredDate}
                            maxDate={maxDate}
                            preparing={phase === "preparing"}
                            error={error}
                            onDateChange={onDateChange}
                            onPrepare={onPrepare}
                            onDismiss={onDismiss}
                        />
                    )}

                    {phase === "recovering" && (
                        <ProgressStep
                            title="Recovering your action"
                            body="I’m checking the action ledger so you can continue safely from its last confirmed state."
                        />
                    )}

                    {(["reviewing", "cancelling", "approving", "executing"].includes(phase)) && (
                        <ReviewStep
                            phase={phase}
                            action={action}
                            error={error}
                            onDismiss={onDismiss}
                            onChangeDate={onChangeDate}
                            onCancelProposal={onCancelProposal}
                            onApproveAndExecute={onApproveAndExecute}
                        />
                    )}

                    {phase === "approved" && (
                        <ApprovedStep
                            action={action}
                            error={error}
                            onExecute={onExecute}
                        />
                    )}

                    {phase === "recovery_error" && (
                        <RecoveryErrorStep
                            error={error}
                            onRetry={onRetryRecovery}
                            onDismiss={onDismiss}
                        />
                    )}

                    {phase === "succeeded" && (
                        <SuccessStep
                            action={action}
                            execution={execution}
                            onDone={onDone}
                        />
                    )}
                </div>
            </section>
        </div>
    )
}

function ChooseDateStep({
    careItem,
    administeredDate,
    maxDate,
    preparing,
    error,
    onDateChange,
    onPrepare,
    onDismiss,
}) {
    return (
        <form onSubmit={onPrepare}>
            <p className="text-sm leading-6 text-tomo-text">
                Choose the date you actually gave {careItem}. TomoCare will prepare
                the care-record update and next reminder for you to review.
            </p>

            <label className="mt-6 block text-sm font-medium text-tomo-text-h">
                Administration date
                <input
                    type="date"
                    required
                    max={maxDate}
                    value={administeredDate}
                    onChange={(event) => onDateChange(event.target.value)}
                    disabled={preparing}
                    className="mt-2 min-h-11 w-full rounded-xl border border-tomo-border bg-white/[0.035] px-4 py-2 text-sm text-tomo-text-h scheme-dark"
                />
            </label>

            <GuardrailNote>
                Preparing this action will not change Momo’s trusted record.
            </GuardrailNote>

            {error && <ActionError error={error} />}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    className="tomo-btn tomo-btn-secondary px-5 py-2"
                    onClick={onDismiss}
                    disabled={preparing}
                >
                    Not now
                </button>
                <button
                    type="submit"
                    className="tomo-btn tomo-btn-primary gap-2 px-5 py-2"
                    disabled={preparing || !administeredDate}
                >
                    {preparing && <Spinner />}
                    {preparing ? "Preparing…" : "Review update"}
                </button>
            </div>
        </form>
    )
}

function ReviewStep({
    phase,
    action,
    error,
    onDismiss,
    onChangeDate,
    onCancelProposal,
    onApproveAndExecute,
}) {
    const preview = action?.preview_json || {}
    const evidence = action?.evidence_json || []
    const busy = phase !== "reviewing"

    return (
        <div>
            <div className="rounded-2xl border border-tomo-border bg-white/[0.025] p-5">
                <p className="text-sm leading-6 text-tomo-text-h">
                    {preview.confirmation_message}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <DateSummary label="Given" value={preview.administered_date} />
                    <DateSummary label="Next target" value={preview.next_target_admin_date} />
                    <DateSummary label="Next reminder" value={preview.next_reminder_date} />
                </div>
            </div>

            <div className="mt-6">
                <p className="tomo-section-label">What will change</p>
                <div className="mt-3 space-y-2">
                    {(preview.changes || []).map((change, index) => (
                        <ChangeRow key={`${change.operation}-${change.record_type}-${index}`} change={change} />
                    ))}
                </div>
            </div>

            {evidence.length > 0 && (
                <div className="mt-6">
                    <p className="tomo-section-label">Trusted evidence</p>
                    <div className="mt-3 rounded-xl border border-tomo-border bg-white/[0.02] px-4 py-3">
                        {evidence.map((item) => (
                            <div key={item.id} className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-tomo-text-h">
                                        {item.label}
                                    </p>
                                    <p className="mt-1 text-xs text-tomo-text">
                                        Reminder date {formatDate(item.event_date)}
                                    </p>
                                </div>
                                <span className="tomo-badge tomo-badge--success shrink-0">
                                    Trusted
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <GuardrailNote>
                Nothing has changed yet. Approval applies to this complete plan—all
                three updates succeed together or none of them do.
            </GuardrailNote>

            {error && <ActionError error={error} />}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    className="tomo-btn tomo-btn-tertiary justify-start px-2 py-2 text-xs"
                    onClick={onCancelProposal}
                    disabled={busy}
                >
                    Cancel proposal
                </button>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-secondary px-5 py-2"
                        onClick={onDismiss}
                        disabled={busy}
                    >
                        Not now
                    </button>
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-secondary px-5 py-2"
                        onClick={onChangeDate}
                        disabled={busy}
                    >
                        Change date
                    </button>
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-primary gap-2 px-5 py-2"
                        onClick={onApproveAndExecute}
                        disabled={busy}
                    >
                        {busy && <Spinner />}
                        {phase === "cancelling"
                            ? "Cancelling…"
                            : phase === "approving"
                              ? "Approving…"
                              : phase === "executing"
                                ? "Recording…"
                                : "Approve & record"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ApprovedStep({ action, error, onExecute }) {
    return (
        <div>
            <div className="rounded-2xl border border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] p-5">
                <p className="text-sm font-semibold text-tomo-warning">
                    Approved, but not yet recorded
                </p>
                <p className="mt-2 text-sm leading-6 text-tomo-text-h">
                    Your approval is safely stored. Complete the final atomic update
                    to add the administration and prepare the next reminder.
                </p>
            </div>

            {action?.preview_json && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <DateSummary label="Given" value={action.preview_json.administered_date} />
                    <DateSummary label="Next target" value={action.preview_json.next_target_admin_date} />
                    <DateSummary label="Next reminder" value={action.preview_json.next_reminder_date} />
                </div>
            )}

            {error && <ActionError error={error} />}

            <div className="mt-7 flex justify-end">
                <button
                    type="button"
                    className="tomo-btn tomo-btn-primary px-5 py-2"
                    onClick={onExecute}
                >
                    Complete update
                </button>
            </div>
        </div>
    )
}

function RecoveryErrorStep({ error, onRetry, onDismiss }) {
    return (
        <div>
            <ActionError error={error} />
            <p className="mt-4 text-sm leading-6 text-tomo-text">
                TomoCare has not assumed the outcome. Reload the action ledger to
                confirm what happened before continuing.
            </p>
            <div className="mt-7 flex justify-end gap-3">
                <button
                    type="button"
                    className="tomo-btn tomo-btn-secondary px-5 py-2"
                    onClick={onDismiss}
                >
                    Close
                </button>
                <button
                    type="button"
                    className="tomo-btn tomo-btn-primary px-5 py-2"
                    onClick={onRetry}
                >
                    Check action status
                </button>
            </div>
        </div>
    )
}

function SuccessStep({ action, execution, onDone }) {
    const result = execution?.result || action?.result_json || {}
    const careItem = action?.preview_json?.care_item || "Medication"

    return (
        <div>
            <div className="flex items-start gap-4 rounded-2xl border border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)] p-5">
                <span className="material-symbols-outlined text-3xl text-tomo-success">
                    check_circle
                </span>
                <div>
                    <p className="text-lg font-semibold text-tomo-text-h">
                        {careItem} is recorded
                    </p>
                    <p className="mt-2 text-sm leading-6 text-tomo-text">
                        The administration is verified, the previous reminder is
                        complete, and the next reminder is ready.
                    </p>
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <DateSummary label="Recorded" value={result.administration_date} />
                <DateSummary label="Next target" value={result.next_target_admin_date} />
                <DateSummary label="Next reminder" value={result.next_reminder_date} />
            </div>

            <div className="mt-7 flex justify-end">
                <button
                    type="button"
                    className="tomo-btn tomo-btn-primary px-6 py-2"
                    onClick={onDone}
                >
                    Done
                </button>
            </div>
        </div>
    )
}

function ProgressStep({ title, body }) {
    return (
        <div className="flex items-start gap-4 rounded-2xl border border-tomo-border bg-white/[0.025] p-5">
            <Spinner />
            <div>
                <p className="font-semibold text-tomo-text-h">{title}</p>
                <p className="mt-2 text-sm leading-6 text-tomo-text">{body}</p>
            </div>
        </div>
    )
}

function GuardrailNote({ children }) {
    return (
        <div className="mt-5 flex gap-3 rounded-xl border border-tomo-accent/30 bg-tomo-accent/10 px-4 py-3">
            <span className="material-symbols-outlined text-xl text-tomo-accent">
                verified_user
            </span>
            <p className="text-xs leading-5 text-tomo-text">{children}</p>
        </div>
    )
}

function ActionError({ error }) {
    return (
        <div className="mt-5 rounded-xl border border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] px-4 py-3">
            <p className="text-sm font-medium text-tomo-danger">
                {error?.message || "TomoCare could not complete this step."}
            </p>
        </div>
    )
}

function ChangeRow({ change }) {
    const copy = getChangeCopy(change)

    return (
        <div className="flex items-start gap-3 rounded-xl border border-tomo-border bg-white/[0.02] px-4 py-3">
            <span className="material-symbols-outlined mt-0.5 text-lg text-tomo-accent">
                {copy.icon}
            </span>
            <div>
                <p className="text-sm font-medium text-tomo-text-h">{copy.title}</p>
                <p className="mt-1 text-xs leading-5 text-tomo-text">{copy.body}</p>
            </div>
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

function Spinner() {
    return (
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
    )
}

function getDialogTitle(phase, careItem) {
    if (phase === "choosing" || phase === "preparing") {
        return `Record ${careItem}`
    }
    if (phase === "recovering") return "Checking the action ledger"
    if (phase === "approved") return "Finish the approved update"
    if (phase === "recovery_error") return "The outcome needs confirmation"
    if (phase === "succeeded") return "Care update complete"

    return `Review ${careItem} update`
}

function getChangeCopy(change) {
    if (change.record_type === "medication_administration") {
        return {
            icon: "add_circle",
            title: "Add a verified administration",
            body: `Record the medication as given on ${formatDate(change.event_date)}.`,
        }
    }

    if (change.operation === "update" && change.record_type === "reminder") {
        return {
            icon: "task_alt",
            title: "Complete the current reminder",
            body: "Retire the reminder that prompted this confirmation.",
        }
    }

    return {
        icon: "event_upcoming",
        title: "Prepare the next reminder",
        body: `Create the next planned reminder for ${formatDate(change.event_date)}.`,
    }
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
