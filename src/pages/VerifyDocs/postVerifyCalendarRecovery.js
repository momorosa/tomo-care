export function buildSavedOnlyCalendarStatus({
    reminderId,
    error = null,
    blockedMessage = null,
    calendarSyncAttempted = true,
} = {}) {
    if (blockedMessage) {
        return {
            phase: "saved_only",
            message: blockedMessage,
            calendarUrl: null,
            reminderId,
            calendarRetryAllowed: false,
            calendarSyncAttempted,
            recovery: null,
        }
    }

    const reauthorizationRequired =
        error?.recovery === "reauthorize_google_calendar"

    return {
        phase: "saved_only",
        message: reauthorizationRequired
            ? "Reminder saved in TomoCare. Reconnect Google Calendar, then try Calendar again."
            : error?.message ||
              "Reminder saved in TomoCare, but Google Calendar was not updated.",
        calendarUrl: null,
        reminderId,
        calendarRetryAllowed: Boolean(reminderId),
        calendarSyncAttempted,
        recovery: reauthorizationRequired
            ? "reauthorize_google_calendar"
            : "retry",
    }
}

export function getSavedOnlyCalendarButton(status = null) {
    if (
        status?.phase !== "saved_only" ||
        !status?.calendarRetryAllowed ||
        !status?.reminderId
    ) {
        return null
    }

    return {
        label: status.calendarSyncAttempted
            ? "Try Calendar again"
            : "Add to Google Calendar",
        recovery: status.recovery || null,
    }
}
