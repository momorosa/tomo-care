const BUSY_PHASES = new Set([
    "recovering",
    "preparing",
    "cancelling",
    "dismissing",
    "approving",
    "executing",
])
const MARK_INSURANCE_CLAIM_FILED = "mark_insurance_claim_filed"

export default function CareActionDialog({
    phase,
    reminder,
    action,
    actionType,
    selectedDate,
    minDate,
    maxDate,
    error,
    execution,
    onDateChange,
    onPrepare,
    onDismiss,
    onChangeDate,
    onApproveAndExecute,
    onExecute,
    onRetryRecovery,
    onDone,
}) {
    if (phase === "idle") return null

    const busy = BUSY_PHASES.has(phase)
    const actionKind = getActionKind(action?.action_type || actionType)
    const subject = getActionSubject({ actionKind, action, reminder })

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
                                {getDialogEyebrow(phase, actionKind)}
                            </p>
                            <h2
                                id="care-action-title"
                                className="mt-2 text-2xl font-semibold tracking-tight text-tomo-text-h"
                            >
                                {getDialogTitle(phase, subject, actionKind)}
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
                            actionKind={actionKind}
                            subject={subject}
                            selectedDate={selectedDate}
                            minDate={minDate}
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
                            title="Checking your update"
                            body="I’m confirming the latest status before you continue."
                        />
                    )}

                    {([
                        "reviewing",
                        "cancelling",
                        "dismissing",
                        "approving",
                        "executing",
                    ].includes(phase)) && (
                        <ReviewStep
                            phase={phase}
                            action={action}
                            actionKind={actionKind}
                            error={error}
                            onChangeDate={onChangeDate}
                            onApproveAndExecute={onApproveAndExecute}
                        />
                    )}

                    {phase === "approved" && (
                        <ApprovedStep
                            action={action}
                            actionKind={actionKind}
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
                            actionKind={actionKind}
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
    actionKind,
    subject,
    selectedDate,
    minDate,
    maxDate,
    preparing,
    error,
    onDateChange,
    onPrepare,
    onDismiss,
}) {
    const isInsuranceClaim = actionKind === "insurance_claim"

    return (
        <form onSubmit={onPrepare}>
            <p className="text-sm leading-6 text-tomo-text">
                {isInsuranceClaim
                    ? `Choose the date you filed the ${subject} claim. You’ll review the details before anything changes in TomoCare.`
                    : `Choose the date you gave ${subject}. You’ll review the details before anything changes in TomoCare.`}
            </p>

            <label className="mt-6 block text-sm font-medium text-tomo-text-h">
                {isInsuranceClaim ? "Filing date" : "Administration date"}
                <input
                    type="date"
                    required
                    min={minDate}
                    max={maxDate}
                    value={selectedDate}
                    onChange={(event) => onDateChange(event.target.value)}
                    disabled={preparing}
                    className="tomo-date-input mt-2 min-h-14 w-full rounded-xl border border-tomo-border bg-white/[0.035] px-4 py-3 text-base text-tomo-text-h scheme-dark"
                />
            </label>

            <GuardrailNote>
                {isInsuranceClaim
                    ? `This updates TomoCare only. It will not submit anything to ${subject}.`
                    : "Nothing changes until you review and approve."}
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
                    disabled={preparing || !selectedDate}
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
    actionKind,
    error,
    onChangeDate,
    onApproveAndExecute,
}) {
    const preview = action?.preview_json || {}
    const evidence = action?.evidence_json || []
    const busy = phase !== "reviewing"
    const isInsuranceClaim = actionKind === "insurance_claim"
    const subject = isInsuranceClaim
        ? preview.insurance_provider || "insurance"
        : preview.care_item || "medication"
    const sourceDocument = evidence.find((item) => item.type === "document")

    return (
        <div>
            <div className="rounded-2xl border border-tomo-border bg-white/[0.025] p-5">
                <p className="text-sm leading-6 text-tomo-text-h">
                    {isInsuranceClaim
                        ? `Confirm that you filed this ${subject} claim on ${formatDate(preview.filed_date)}.`
                        : `Confirm that you gave ${subject} on ${formatDate(preview.administered_date)}.`}
                </p>

                {isInsuranceClaim ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <DateSummary label="Filed" value={preview.filed_date} />
                        <DateSummary
                            label="Treatment"
                            value={preview.treatment_date}
                        />
                        <DateSummary
                            label="Claim deadline"
                            value={action?.payload_json?.claim_deadline_date}
                        />
                    </div>
                ) : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <DateSummary
                            label="Given"
                            value={preview.administered_date}
                        />
                        <DateSummary
                            label="Next target"
                            value={preview.next_target_admin_date}
                        />
                        <DateSummary
                            label="Next reminder"
                            value={preview.next_reminder_date}
                        />
                    </div>
                )}
            </div>

            {isInsuranceClaim && sourceDocument && (
                <div className="mt-6">
                    <p className="tomo-section-label">Related receipt</p>
                    <div className="mt-3 flex items-start gap-3 rounded-xl border border-tomo-border bg-white/[0.02] px-4 py-3">
                        <span
                            className="material-symbols-outlined mt-0.5 shrink-0 text-xl text-tomo-accent"
                            aria-hidden="true"
                        >
                            receipt
                        </span>
                        <div>
                            <p className="text-sm font-medium text-tomo-text-h">
                                {action?.payload_json?.source_org ||
                                    "Veterinary receipt"}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-tomo-text">
                                Dated{" "}
                                {formatDate(
                                    action?.payload_json?.source_document_date ||
                                        sourceDocument.document_date
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-5 rounded-xl border border-tomo-accent/30 bg-tomo-accent/10 px-4 py-3">
                <p className="text-sm font-medium text-tomo-text-h">
                    What this does
                </p>
                <p className="mt-1 text-xs leading-5 text-tomo-text">
                    {isInsuranceClaim
                        ? `TomoCare will remember the filing date and remove this reminder. It will not submit anything to ${subject}.`
                        : "TomoCare will record the date, complete this reminder, and prepare the next one."}
                </p>
            </div>

            {error && <ActionError error={error} />}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
                        ? "Changing date…"
                        : phase === "dismissing"
                          ? "Closing…"
                        : phase === "approving"
                          ? "Confirming…"
                          : phase === "executing"
                            ? "Recording…"
                            : isInsuranceClaim
                              ? "Mark as filed"
                              : "Record as given"}
                </button>
            </div>
        </div>
    )
}

function ApprovedStep({ action, actionKind, error, onExecute }) {
    const isInsuranceClaim = actionKind === "insurance_claim"
    const preview = action?.preview_json || {}

    return (
        <div>
            <div className="rounded-2xl border border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] p-5">
                <p className="text-sm font-semibold text-tomo-warning">
                    Your update still needs to finish
                </p>
                <p className="mt-2 text-sm leading-6 text-tomo-text-h">
                    {isInsuranceClaim
                        ? "Your confirmation was saved, but TomoCare has not finished marking the claim as filed. Try again to complete the update."
                        : "Your confirmation was saved, but TomoCare has not finished recording the medication. Try again to complete the update."}
                </p>
            </div>

            {isInsuranceClaim ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DateSummary label="Filed" value={preview.filed_date} />
                    <DateSummary
                        label="Treatment"
                        value={preview.treatment_date}
                    />
                </div>
            ) : (
                action?.preview_json && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <DateSummary
                            label="Given"
                            value={preview.administered_date}
                        />
                        <DateSummary
                            label="Next target"
                            value={preview.next_target_admin_date}
                        />
                        <DateSummary
                            label="Next reminder"
                            value={preview.next_reminder_date}
                        />
                    </div>
                )
            )}

            {error && <ActionError error={error} />}

            <div className="mt-7 flex justify-end">
                <button
                    type="button"
                    className="tomo-btn tomo-btn-primary px-5 py-2"
                    onClick={onExecute}
                >
                    Try again
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
                TomoCare couldn’t confirm whether the update finished. Check its
                status before trying again.
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
                    Check status
                </button>
            </div>
        </div>
    )
}

function SuccessStep({ action, actionKind, execution, onDone }) {
    const result = execution?.result || action?.result_json || {}
    const preview = action?.preview_json || {}
    const isInsuranceClaim = actionKind === "insurance_claim"
    const subject = isInsuranceClaim
        ? result.insurance_provider ||
          preview.insurance_provider ||
          "Insurance"
        : preview.care_item || "Medication"

    return (
        <div>
            <div className="flex items-start gap-4 rounded-2xl border border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)] p-5">
                <span className="material-symbols-outlined text-3xl text-tomo-success">
                    check_circle
                </span>
                <div>
                    <p className="text-lg font-semibold text-tomo-text-h">
                        All set
                    </p>
                    <p className="mt-2 text-sm leading-6 text-tomo-text">
                        {isInsuranceClaim
                            ? "The reminder is complete and has been removed from your dashboard."
                            : "The current reminder is complete and the next reminder is ready."}
                    </p>
                </div>
            </div>

            {isInsuranceClaim ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DateSummary label="Filed" value={result.filed_date} />
                    <DateSummary
                        label="Treatment"
                        value={preview.treatment_date}
                    />
                </div>
            ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <DateSummary
                        label="Recorded"
                        value={result.administration_date}
                    />
                    <DateSummary
                        label="Next target"
                        value={result.next_target_admin_date}
                    />
                    <DateSummary
                        label="Next reminder"
                        value={result.next_reminder_date}
                    />
                </div>
            )}

            {isInsuranceClaim && (
                <p className="mt-4 text-xs leading-5 text-tomo-text">
                    This updated TomoCare only. No claim was submitted to{" "}
                    {subject}.
                </p>
            )}

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
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-tomo-accent/30 bg-tomo-accent/10 px-4 py-3">
            <span
                className="material-symbols-outlined mt-0.5 shrink-0 text-xl leading-none text-tomo-accent"
                aria-hidden="true"
            >
                verified_user
            </span>
            <div>
                <p className="text-sm font-medium text-tomo-text-h">
                    You’re in control
                </p>
                <p className="mt-1 text-xs leading-5 text-tomo-text">
                    {children}
                </p>
            </div>
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

function getDialogEyebrow(phase, actionKind) {
    if (phase === "succeeded") return "Update complete"
    if (["recovering", "approved", "recovery_error"].includes(phase)) {
        return "Update status"
    }

    return actionKind === "insurance_claim"
        ? "Insurance claim"
        : "Medication reminder"
}

function getDialogTitle(phase, subject, actionKind) {
    if (phase === "choosing" || phase === "preparing") {
        return actionKind === "insurance_claim"
            ? `Mark ${subject} claim as filed`
            : `Record ${subject}`
    }
    if (phase === "recovering") return "Checking your update"
    if (phase === "approved") return "Finish your update"
    if (phase === "recovery_error") return "Let’s confirm what happened"
    if (phase === "succeeded") {
        return actionKind === "insurance_claim"
            ? `${subject} claim marked as filed`
            : `${subject} recorded`
    }

    return actionKind === "insurance_claim"
        ? `Review ${subject} claim`
        : `Review ${subject}`
}

function getActionKind(actionType) {
    return actionType === MARK_INSURANCE_CLAIM_FILED
        ? "insurance_claim"
        : "home_medication"
}

function getActionSubject({ actionKind, action, reminder }) {
    if (actionKind === "insurance_claim") {
        return (
            action?.preview_json?.insurance_provider ||
            reminder?.details_json?.insurance_provider ||
            "insurance"
        )
    }

    return (
        action?.preview_json?.care_item ||
        reminder?.details_json?.care_item ||
        reminder?.title ||
        "home medication"
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
