import test from "node:test"
import assert from "node:assert/strict"
import {
    isGmailConfigurationError,
    isGmailReauthorizationError,
    toGmailErrorResponse,
    toSafeGmailErrorLog,
} from "./gmailError.js"

test("maps Google's nested invalid_grant to Gmail reconnection guidance", () => {
    const error = new Error("Bad Request")
    error.code = 400
    error.cause = {
        message: "invalid_grant",
    }

    assert.equal(isGmailReauthorizationError(error), true)
    assert.deepEqual(toGmailErrorResponse(error), {
        status: 401,
        body: {
            ok: false,
            reason: "gmail_reauthorization_required",
            error: "Gmail authorization needs to be renewed.",
            recovery: "reauthorize_gmail",
            retryable: false,
        },
    })
})

test("distinguishes missing Gmail configuration from expired authorization", () => {
    const error = new Error(
        "Missing Gmail OAuth env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN."
    )

    assert.equal(isGmailConfigurationError(error), true)
    assert.equal(isGmailReauthorizationError(error), false)
    assert.deepEqual(toGmailErrorResponse(error), {
        status: 503,
        body: {
            ok: false,
            reason: "gmail_configuration_required",
            error: "Gmail has not been connected.",
            recovery: "configure_gmail",
            retryable: false,
        },
    })
})

test("makes ordinary Gmail failures retryable without exposing provider details", () => {
    const error = new Error("socket hang up")
    error.code = "ECONNRESET"

    assert.deepEqual(toGmailErrorResponse(error), {
        status: 502,
        body: {
            ok: false,
            reason: "gmail_inbox_check_failed",
            error: "Inbox check is temporarily unavailable.",
            recovery: "retry",
            retryable: true,
        },
    })
})

test("safe Gmail logs exclude OAuth request data and refresh tokens", () => {
    const privateValue = ["sensitive", "oauth", "value"].join("-")
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
            refresh_token: privateValue,
        },
    }

    const safeLog = toSafeGmailErrorLog(error)

    assert.deepEqual(safeLog, {
        name: "GaxiosError",
        message: "invalid_grant",
        code: 400,
        google_error: "invalid_grant",
    })
    assert.equal(JSON.stringify(safeLog).includes(privateValue), false)
})
