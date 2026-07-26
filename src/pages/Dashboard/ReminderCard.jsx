export default function ReminderCard({
    reminder,
    onRecordGiven,
    onMarkFiled,
}) {
    const hasCalendarLink = Boolean(reminder.google_calendar_url)
    const meta = getReminderMeta(reminder)
    const canRecordGiven = isRecordableHomeMedication(reminder)
    const canMarkFiled = isFileableInsuranceClaim(reminder)

    return (
        <div className={getCardClassName(reminder, meta)}>
            <div className="flex items-start gap-4">
                <div className={getIconClassName(reminder, meta)}>
                    <span className="material-symbols-outlined text-[22px] leading-none">
                        {meta.icon}
                    </span>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-tomo-text">
                                {meta.eyebrow}
                            </p>

                            <h3 className="mt-2 text-lg font-semibold text-tomo-text-h">
                                {meta.title}
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-tomo-text">
                                {meta.body}
                            </p>

                            {meta.scheduleLine && (
                                <p className="mt-2 text-xs leading-5 text-tomo-text">
                                    {meta.scheduleLine}
                                </p>
                            )}
                        </div>

                        {(hasCalendarLink || canRecordGiven || canMarkFiled) && (
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {hasCalendarLink && (
                                    <a
                                        href={reminder.google_calendar_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={getReminderActionClassName(reminder)}
                                    >
                                        Open calendar
                                    </a>
                                )}

                                {canRecordGiven && (
                                    <button
                                        type="button"
                                        className="tomo-btn tomo-btn-primary shrink-0 px-4 py-1.5 text-xs font-semibold"
                                        onClick={() => onRecordGiven?.(reminder)}
                                    >
                                        Mark as given
                                    </button>
                                )}

                                {canMarkFiled && (
                                    <button
                                        type="button"
                                        className="tomo-btn tomo-btn-primary shrink-0 px-4 py-1.5 text-xs font-semibold"
                                        onClick={() => onMarkFiled?.(reminder)}
                                    >
                                        Mark as filed
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <ReminderPill tone={meta.tone}>
                            {meta.typeLabel}
                        </ReminderPill>

                        <ReminderPill>
                            Reminds {formatDate(reminder.event_date)}
                        </ReminderPill>

                        {meta.targetDate && (
                            <ReminderPill>
                                Target {formatDate(meta.targetDate)}
                            </ReminderPill>
                        )}

                        {meta.dueDate && meta.dueDate !== meta.targetDate && (
                            <ReminderPill>
                                Due {formatDate(meta.dueDate)}
                            </ReminderPill>
                        )}

                        {reminder.calendar_sync_status === "synced" ? (
                            <ReminderPill tone="success">
                                Calendar synced
                            </ReminderPill>
                        ) : (
                            <ReminderPill>Not synced</ReminderPill>
                        )}

                        {reminder.timing_state === "overdue" && (
                            <ReminderPill tone="warning">Overdue</ReminderPill>
                        )}

                        {reminder.timing_state === "due_now" && (
                            <ReminderPill tone="brand">Due now</ReminderPill>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function isRecordableHomeMedication(reminder) {
    const details = reminder.details_json || {}

    return (
        details.reminder_type === "home_medication" &&
        details.requires_appointment === false &&
        ["due_now", "overdue"].includes(reminder.timing_state)
    )
}

function isFileableInsuranceClaim(reminder) {
    return (
        reminder.details_json?.subtype === "Insurance claim" &&
        reminder.status !== "completed"
    )
}

function ReminderPill({ tone = "neutral", children }) {
    const className =
        tone === "success"
            ? "tomo-badge--success"
            : tone === "warning"
              ? "tomo-badge--warning"
              : tone === "brand"
                ? "tomo-badge--brand"
                : "tomo-badge--neutral"

    return <span className={`tomo-badge ${className}`}>{children}</span>
}

function getReminderMeta(reminder) {
    const details = reminder.details_json || {}
    const haystack = [
        details.care_item,
        details.care_category,
        details.reminder_type,
        details.medication,
        details.medication_name,
        details.title,
        details.label,
        details.description,
        reminder.title,
        reminder.body,
        reminder.eyebrow,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    if (haystack.includes("simparica")) {
        return {
            kind: "simparica",
            icon: "pill",
            tone: "success",
            eyebrow: "At-home medication",
            title: details.care_item || "Simparica Trio",
            typeLabel: "Oral med",
            targetDate: details.target_admin_date,
            dueDate: details.due_date,
            body:
                reminder.body ||
                "Monthly flea, tick, and heartworm prevention. Tracked as an at-home medication.",
            scheduleLine: getHomeMedicationScheduleLine(details),
        }
    }

    if (haystack.includes("adequan")) {
        return {
            kind: "adequan",
            icon: "syringe",
            tone: "brand",
            eyebrow: "At-home injection",
            title: details.care_item || "Adequan",
            typeLabel: "Home injection",
            targetDate: details.target_admin_date,
            dueDate: details.due_date,
            body:
                reminder.body ||
                "Joint support injection administered at home. Tracked as an at-home care task.",
            scheduleLine: getHomeMedicationScheduleLine(details),
        }
    }

    if (haystack.includes("librela")) {
        return {
            kind: "librela",
            icon: "medical_services",
            tone: "brand",
            eyebrow: "Clinic care",
            title: details.care_item || details.medication || "Librela",
            typeLabel: "Vet-administered",
            targetDate: details.target_admin_date,
            dueDate: details.due_date,
            body:
                reminder.body ||
                "Librela care reminder based on verified injection history.",
            scheduleLine: getLibrelaScheduleLine(details),
        }
    }

    if (
        haystack.includes("insurance") ||
        haystack.includes("claim") ||
        haystack.includes("receipt")
    ) {
        return {
            kind: "insurance",
            icon: "receipt",
            tone: "neutral",
            eyebrow: "Insurance",
            title: details.care_item || reminder.title || "Insurance claim",
            typeLabel: "Claim",
            targetDate: details.target_admin_date,
            dueDate: details.due_date,
            body:
                reminder.body ||
                "Reminder to submit or follow up on an insurance claim.",
            scheduleLine: null,
        }
    }

    return {
        kind: "generic",
        icon: "notifications",
        tone: "neutral",
        eyebrow: reminder.eyebrow || "Reminder",
        title: details.care_item || reminder.title || "Reminder",
        typeLabel: "Reminder",
        targetDate: details.target_admin_date,
        dueDate: details.due_date,
        body: reminder.body || "Planned TomoCare reminder.",
        scheduleLine: null,
    }
}

function getHomeMedicationScheduleLine(details) {
    const parts = []

    if (details.preferred_admin_day) {
        parts.push(`Preferred day: ${details.preferred_admin_day}`)
    }

    if (details.cadence_days) {
        parts.push(`Cadence: every ${details.cadence_days} days`)
    }

    if (details.requires_appointment === false) {
        parts.push("No appointment needed")
    }

    return parts.length ? parts.join(" · ") : null
}

function getLibrelaScheduleLine(details) {
    const parts = []

    if (details.cadence_days) {
        parts.push(`Cadence: every ${details.cadence_days} days`)
    }

    if (details.requires_appointment === true) {
        parts.push("Appointment needed")
    }

    return parts.length ? parts.join(" · ") : null
}

function getCardClassName(reminder, meta) {
    const base =
        "rounded-2xl border bg-white/[0.025] p-5 shadow-sm transition-colors hover:bg-white/[0.035]"

    if (reminder.timing_state === "overdue") {
        return `${base} border-[color:var(--tomo-warning-border)]`
    }

    if (reminder.timing_state === "due_now") {
        return `${base} border-[color:var(--tomo-accent-border)]`
    }

    if (meta.kind === "simparica") {
        return `${base} border-emerald-400/25`
    }

    if (meta.kind === "adequan") {
        return `${base} border-violet-400/30`
    }

    if (meta.kind === "librela") {
        return `${base} border-purple-400/30`
    }

    if (meta.kind === "insurance") {
        return `${base} border-amber-400/25`
    }

    return `${base} border-tomo-border`
}

function getIconClassName(reminder, meta) {
    const base =
        "mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"

    if (reminder.timing_state === "overdue") {
        return `${base} border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] text-tomo-warning`
    }

    if (reminder.timing_state === "due_now") {
        return `${base} border-[color:var(--tomo-accent-border)] bg-[var(--tomo-accent-bg)] text-tomo-accent`
    }

    if (meta.kind === "simparica") {
        return `${base} border-emerald-400/25 bg-emerald-400/10 text-emerald-200`
    }

    if (meta.kind === "adequan") {
        return `${base} border-violet-400/30 bg-violet-400/10 text-violet-200`
    }

    if (meta.kind === "librela") {
        return `${base} border-purple-400/30 bg-purple-400/10 text-purple-200`
    }

    if (meta.kind === "insurance") {
        return `${base} border-amber-400/25 bg-amber-400/10 text-amber-200`
    }

    return `${base} border-tomo-border bg-white/[0.03] text-tomo-text`
}

function getReminderActionClassName(reminder) {
    const base =
        "tomo-btn shrink-0 px-4 py-1.5 text-xs font-semibold shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9)]"

    if (reminder.timing_state === "due_now") {
        return `${base} border border-[color:var(--tomo-accent-border)] bg-[var(--tomo-accent-bg)] text-tomo-accent hover:border-[color:var(--color-tomo-accent)] hover:text-purple-200`
    }

    if (reminder.timing_state === "overdue") {
        return `${base} border border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] text-tomo-warning hover:border-[color:var(--color-tomo-warning)]`
    }

    return `${base} tomo-btn-secondary`
}

function formatDate(value) {
    if (!value) return "unknown date"

    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date)
}