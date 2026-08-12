import test from "node:test"
import assert from "node:assert/strict"
import {
    buildSavedOnlyCalendarStatus,
    getSavedOnlyCalendarButton,
} from "./postVerifyCalendarRecovery.js"

test("preserves reminder success when ordinary Calendar sync fails", () => {
    const status = buildSavedOnlyCalendarStatus({
        reminderId: "reminder-1",
        error: new Error("Calendar API is temporarily unavailable"),
    })

    assert.equal(status.phase, "saved_only")
    assert.equal(status.reminderId, "reminder-1")
    assert.equal(status.calendarRetryAllowed, true)
    assert.equal(status.recovery, "retry")
    assert.deepEqual(getSavedOnlyCalendarButton(status), {
        label: "Try Calendar again",
        recovery: "retry",
    })
})

test("shows reauthorization as recovery without losing the reminder", () => {
    const error = new Error("Google Calendar needs to be reconnected.")
    error.recovery = "reauthorize_google_calendar"

    const status = buildSavedOnlyCalendarStatus({
        reminderId: "reminder-2",
        error,
    })

    assert.equal(status.phase, "saved_only")
    assert.equal(status.calendarRetryAllowed, true)
    assert.equal(status.recovery, "reauthorize_google_calendar")
    assert.match(status.message, /Reminder saved in TomoCare/)
})

test("does not offer a futile retry when fresh timing blocks Calendar", () => {
    const status = buildSavedOnlyCalendarStatus({
        reminderId: "reminder-3",
        blockedMessage: "This reminder is overdue.",
    })

    assert.equal(status.phase, "saved_only")
    assert.equal(status.calendarRetryAllowed, false)
    assert.equal(getSavedOnlyCalendarButton(status), null)
})

test("offers first-time Calendar sync after reconciliation", () => {
    const status = buildSavedOnlyCalendarStatus({
        reminderId: "reminder-4",
        calendarSyncAttempted: false,
    })

    assert.deepEqual(getSavedOnlyCalendarButton(status), {
        label: "Add to Google Calendar",
        recovery: "retry",
    })
})
