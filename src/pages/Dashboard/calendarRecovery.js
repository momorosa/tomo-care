export const GOOGLE_CALENDAR_HOME_URL =
    "https://calendar.google.com/calendar/u/0/r"

const ELIGIBLE_TIMING_STATES = new Set(["upcoming", "due_now"])

export function isSupportedCalendarReminder(reminder) {
    const details = reminder?.details_json || {}

    return (
        details.reminder_type === "home_medication" ||
        details.subtype === "Librela" ||
        details.subtype === "Insurance claim"
    )
}

export function canSyncReminderToGoogleCalendar(reminder) {
    return (
        Boolean(reminder?.id) &&
        isSupportedCalendarReminder(reminder) &&
        ELIGIBLE_TIMING_STATES.has(reminder?.timing_state) &&
        !reminder?.google_calendar_url
    )
}

export function getReminderCalendarControl(reminder, transientState = null) {
    const phase = transientState?.phase || "idle"

    if (reminder?.google_calendar_url) {
        return {
            kind: "event_link",
            label: "Open Google Calendar event",
            href: reminder.google_calendar_url,
            disabled: false,
        }
    }

    if (canSyncReminderToGoogleCalendar(reminder)) {
        if (phase === "syncing") {
            return {
                kind: "sync",
                label: "Adding…",
                disabled: true,
            }
        }

        if (phase === "reauthorization_required") {
            return {
                kind: "sync",
                label: "Try Calendar again",
                disabled: false,
            }
        }

        if (phase === "error") {
            return {
                kind: "sync",
                label: "Try Calendar again",
                disabled: false,
            }
        }

        return {
            kind: "sync",
            label: "Add to Google Calendar",
            disabled: false,
        }
    }

    return {
        kind: "calendar_home",
        label: "Open Google Calendar",
        href: GOOGLE_CALENDAR_HOME_URL,
        disabled: false,
    }
}

export function getCalendarStatusMessage(transientState = null) {
    if (transientState?.phase === "synced") {
        return {
            tone: "success",
            text: "Added to Google Calendar.",
        }
    }

    if (transientState?.phase === "error") {
        return {
            tone: "danger",
            text:
                transientState.message ||
                "Couldn’t add this reminder to Google Calendar. The TomoCare reminder is unchanged.",
        }
    }

    if (transientState?.phase === "reauthorization_required") {
        return {
            tone: "warning",
            text:
                "Google Calendar needs to be reconnected. The TomoCare reminder is unchanged.",
        }
    }

    return null
}
