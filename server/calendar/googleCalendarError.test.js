import test from "node:test"
import assert from "node:assert/strict"
import {
    isGoogleCalendarReauthorizationError,
    toGoogleCalendarErrorResponse,
    toSafeGoogleCalendarErrorLog,
} from "./googleCalendarError.js"

test("recognizes Google's invalid_grant response as expired authorization", () => {
    const error = new Error("invalid_grant")
    error.response = {
        data: {
            error: "invalid_grant",
            error_description: "Bad Request",
        },
    }

    assert.equal(isGoogleCalendarReauthorizationError(error), true)
    assert.deepEqual(toGoogleCalendarErrorResponse(error), {
        status: 401,
        body: {
            ok: false,
            reason: "google_calendar_reauthorization_required",
            error: "Google Calendar needs to be reconnected.",
            recovery: "reauthorize_google_calendar",
            retryable: false,
        },
    })
})

test("does not misclassify an ordinary Calendar API failure", () => {
    const error = new Error("Calendar API is temporarily unavailable")
    error.code = 503

    assert.equal(isGoogleCalendarReauthorizationError(error), false)
    assert.deepEqual(toGoogleCalendarErrorResponse(error), {
        status: 500,
        body: {
            ok: false,
            reason: "google_calendar_sync_failed",
            error: "Calendar API is temporarily unavailable",
            recovery: "retry",
            retryable: true,
            code: 503,
        },
    })
})

test("safe Calendar logs exclude OAuth request data and refresh tokens", () => {
    const error = new Error("invalid_grant")
    error.name = "GaxiosError"
    error.code = 400
    error.response = {
        data: {
            error: "invalid_grant",
        },
    }
    error.config = {
        data: {
            refresh_token: "secret-refresh-token",
        },
    }

    const safeLog = toSafeGoogleCalendarErrorLog(error)

    assert.deepEqual(safeLog, {
        name: "GaxiosError",
        message: "invalid_grant",
        code: 400,
        google_error: "invalid_grant",
    })
    assert.doesNotMatch(JSON.stringify(safeLog), /secret-refresh-token/)
})