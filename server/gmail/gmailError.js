const REAUTHORIZATION_REASON = "gmail_reauthorization_required"
const CONFIGURATION_REASON = "gmail_configuration_required"

function getErrorSignals(error) {
    return [
        error?.message,
        error?.cause?.message,
        error?.response?.data?.error,
        error?.response?.data?.error_description,
    ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
}

export function isGmailReauthorizationError(error) {
    return getErrorSignals(error).some((value) =>
        value.includes("invalid_grant")
    )
}

export function isGmailConfigurationError(error) {
    return getErrorSignals(error).some((value) =>
        value.includes("missing gmail oauth env vars")
    )
}

export function toGmailErrorResponse(error) {
    if (isGmailReauthorizationError(error)) {
        return {
            status: 401,
            body: {
                ok: false,
                reason: REAUTHORIZATION_REASON,
                error: "Gmail authorization needs to be renewed.",
                recovery: "reauthorize_gmail",
                retryable: false,
            },
        }
    }

    if (isGmailConfigurationError(error)) {
        return {
            status: 503,
            body: {
                ok: false,
                reason: CONFIGURATION_REASON,
                error: "Gmail has not been connected.",
                recovery: "configure_gmail",
                retryable: false,
            },
        }
    }

    return {
        status: 502,
        body: {
            ok: false,
            reason: "gmail_inbox_check_failed",
            error: "Inbox check is temporarily unavailable.",
            recovery: "retry",
            retryable: true,
        },
    }
}

export function toSafeGmailErrorLog(error) {
    return {
        name: error?.name || "Error",
        message: error?.message || "Unknown Gmail error",
        code: error?.code || null,
        google_error: error?.response?.data?.error || null,
    }
}
