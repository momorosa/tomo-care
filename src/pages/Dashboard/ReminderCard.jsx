export default function ReminderCard({ reminder }) {
    const hasCalendarLink = Boolean(reminder.google_calendar_url)

    return (
        <div className={getCardClassName(reminder.tone)}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-tomo-text">
                        {reminder.eyebrow}
                    </p>

                    <h3 className="mt-2 text-sm font-semibold text-tomo-text-h">
                        {reminder.title}
                    </h3>

                    <p className="mt-2 text-xs leading-5 text-tomo-text">
                        {reminder.body}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ReminderPill>{reminder.event_date}</ReminderPill>

                        {reminder.calendar_sync_status === "synced" && (
                            <ReminderPill tone="success">
                                Calendar synced
                            </ReminderPill>
                        )}

                        {reminder.calendar_sync_status !== "synced" && (
                            <ReminderPill>Not synced</ReminderPill>
                        )}

                        {reminder.timing_state === "overdue" && (
                            <ReminderPill tone="warning">Overdue</ReminderPill>
                        )}

                        {reminder.timing_state === "due_now" && (
                            <ReminderPill tone="attention">
                                Due now
                            </ReminderPill>
                        )}
                    </div>
                </div>

                {hasCalendarLink && (
                    <a
                        href={reminder.google_calendar_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-full border border-tomo-border px-3 py-1 text-xs text-purple-200 hover:border-purple-300/50 hover:text-purple-100"
                    >
                        Open
                    </a>
                )}
            </div>
        </div>
    )
}

function ReminderPill({ tone = "default", children }) {
    const className =
        tone === "success"
            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
            : tone === "warning"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
              : tone === "attention"
                ? "border-purple-300/30 bg-purple-300/10 text-purple-200"
                : "border-tomo-border text-tomo-text"

    return (
        <span className={`rounded-full border px-2 py-1 text-[11px] ${className}`}>
            {children}
        </span>
    )
}

function getCardClassName(tone) {
    const base = "rounded-2xl border p-4"

    if (tone === "warning") {
        return `${base} border-amber-300/30 bg-amber-300/10`
    }

    if (tone === "attention") {
        return `${base} border-purple-300/30 bg-purple-300/10`
    }

    return `${base} border-tomo-border bg-white/[0.03]`
}