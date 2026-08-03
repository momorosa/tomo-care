import test from "node:test"
import assert from "node:assert/strict"
import { getInboxErrorPresentation } from "./inboxErrorPresentation.js"

test("explains when Gmail must be reconnected before retrying", () => {
    assert.deepEqual(
        getInboxErrorPresentation({
            reason: "gmail_reauthorization_required",
            retryable: false,
        }),
        {
            title: "Tomo’s inbox key stopped working.",
            message: "Reconnect Gmail, then try the inbox again.",
        }
    )
})

test("uses light retry guidance for a temporary inbox failure", () => {
    assert.deepEqual(
        getInboxErrorPresentation({
            reason: "gmail_inbox_check_failed",
            retryable: true,
        }),
        {
            title: "The inbox is playing hard to fetch.",
            message: "Give it a moment, then try again.",
        }
    )
})

test("does not display an unknown provider error to the user", () => {
    assert.deepEqual(getInboxErrorPresentation(new Error("invalid_grant")), {
        title: "The inbox is playing hard to fetch.",
        message: "Give it a moment, then try again.",
    })
})
