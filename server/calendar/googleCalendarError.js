const REAUTHORIZATION_REASON = "google_calendar_reauthorization_required"
const REAUTHORIZATION_RECOVERY = "reauthorize_google_calendar"

export function isGoogleCalendarReauthorizationError(error) {
    const signals = [
        error?.message,
        error?.cause?.message,
        error?.response?.data?.error,
        error?.response?.data?.error_description,
    ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())

    return signals.some((value) => value.includes("invalid_grant"))
}

export function toGoogleCalendarErrorResponse(error) {
    if (isGoogleCalendarReauthorizationError(error)) {
        return {
            status: 401,
            body: {
                ok: false,
                reason: REAUTHORIZATION_REASON,
                error: "Google Calendar needs to be reconnected.",
                recovery: REAUTHORIZATION_RECOVERY,
                retryable: false,
            },
        }
    }

    return {
        status: 500,
        body: {
            ok: false,
            reason: "google_calendar_sync_failed",
            error:
                error?.message ||
                "Failed to sync reminder to Google Calendar.",
            recovery: "retry",
            retryable: true,
            code: error?.code || null,
        },
    }
}

export function toSafeGoogleCalendarErrorLog(error) {
    return {
        name: error?.name || "Error",
        message: error?.message || "Unknown Google Calendar error",
        code: error?.code || null,
        google_error: error?.response?.data?.error || null,
    }
}