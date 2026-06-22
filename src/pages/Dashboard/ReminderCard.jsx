export default function ReminderCard({ reminder }) {
    const hasCalendarLink = Boolean(reminder.google_calendar_url)

    return (
        <div className={getCardClassName(reminder)}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-tomo-text">
                        {reminder.eyebrow}
                    </p>

                    <h3 className="mt-3 text-lg font-semibold text-tomo-text-h">
                        {reminder.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-tomo-text">
                        {reminder.body}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <ReminderPill>
                            reminds {reminder.event_date}
                        </ReminderPill>

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

                {hasCalendarLink && (
                    <a
                        href={reminder.google_calendar_url}
                        target="_blank"
                        rel="noreferrer"
                        className={getReminderActionClassName(reminder)}
                    >
                        Open
                    </a>
                )}
            </div>
        </div>
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

function getCardClassName(reminder) {
    const base =
        "rounded-2xl border bg-white/[0.025] p-5 shadow-sm transition-colors hover:bg-white/[0.035]"

    if (reminder.timing_state === "overdue") {
        return `${base} border-[color:var(--tomo-warning-border)]`
    }

    if (reminder.timing_state === "due_now") {
        return `${base} border-[color:var(--tomo-accent-border)]`
    }

    return `${base} border-tomo-border`
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