import test from "node:test"
import assert from "node:assert/strict"
import {
    GOOGLE_CALENDAR_HOME_URL,
    canSyncReminderToGoogleCalendar,
    getCalendarStatusMessage,
    getReminderCalendarControl,
    isSupportedCalendarReminder,
} from "./calendarRecovery.js"

function buildReminder(overrides = {}) {
    return {
        id: "36fc213e-fec2-4135-acd7-6bfe8454afad",
        timing_state: "upcoming",
        calendar_sync_status: "not_synced",
        google_calendar_url: null,
        details_json: {
            subtype: "Librela",
        },
        ...overrides,
    }
}

test("supports Librela, insurance, Simparica, and Adequan reminder shapes", () => {
    assert.equal(isSupportedCalendarReminder(buildReminder()), true)
    assert.equal(
        isSupportedCalendarReminder(
            buildReminder({ details_json: { subtype: "Insurance claim" } })
        ),
        true
    )
    assert.equal(
        isSupportedCalendarReminder(
            buildReminder({
                details_json: {
                    reminder_type: "home_medication",
                    care_item: "Simparica Trio",
                },
            })
        ),
        true
    )
    assert.equal(
        isSupportedCalendarReminder(
            buildReminder({
                details_json: {
                    reminder_type: "home_medication",
                    care_item: "Adequan",
                },
            })
        ),
        true
    )
})

test("offers Calendar sync for eligible Librela and insurance reminders", () => {
    assert.equal(canSyncReminderToGoogleCalendar(buildReminder()), true)
    assert.equal(
        canSyncReminderToGoogleCalendar(
            buildReminder({
                timing_state: "due_now",
                details_json: { subtype: "Insurance claim" },
            })
        ),
        true
    )
})

test("does not offer sync for overdue or unknown reminders", () => {
    assert.equal(
        canSyncReminderToGoogleCalendar(
            buildReminder({ timing_state: "overdue" })
        ),
        false
    )
    assert.equal(
        canSyncReminderToGoogleCalendar(
            buildReminder({ details_json: { subtype: "Other" } })
        ),
        false
    )
})

test("repairs a synced marker that is missing its event URL", () => {
    assert.equal(
        canSyncReminderToGoogleCalendar(
            buildReminder({ calendar_sync_status: "synced" })
        ),
        true
    )
})

test("opens a stored event-specific URL instead of creating another event", () => {
    const control = getReminderCalendarControl(
        buildReminder({
            calendar_sync_status: "synced",
            google_calendar_url:
                "https://calendar.google.com/calendar/event?eid=trusted",
        })
    )

    assert.deepEqual(control, {
        kind: "event_link",
        label: "Open Google Calendar event",
        href: "https://calendar.google.com/calendar/event?eid=trusted",
        disabled: false,
    })
})

test("labels generic Calendar navigation honestly", () => {
    const control = getReminderCalendarControl(
        buildReminder({ timing_state: "overdue" })
    )

    assert.deepEqual(control, {
        kind: "calendar_home",
        label: "Open Google Calendar",
        href: GOOGLE_CALENDAR_HOME_URL,
        disabled: false,
    })
})

test("shows progress and retry labels from the shared phase contract", () => {
    assert.deepEqual(
        getReminderCalendarControl(buildReminder(), { phase: "syncing" }),
        { kind: "sync", label: "Adding…", disabled: true }
    )
    assert.deepEqual(
        getReminderCalendarControl(buildReminder(), { phase: "error" }),
        { kind: "sync", label: "Try Calendar again", disabled: false }
    )
    assert.deepEqual(
        getReminderCalendarControl(buildReminder(), {
            phase: "reauthorization_required",
        }),
        { kind: "sync", label: "Try Calendar again", disabled: false }
    )
})

test("keeps Calendar failure and reauthorization messages explicit", () => {
    assert.deepEqual(getCalendarStatusMessage({ phase: "error" }), {
        tone: "danger",
        text:
            "Couldn’t add this reminder to Google Calendar. The TomoCare reminder is unchanged.",
    })
    assert.deepEqual(
        getCalendarStatusMessage({ phase: "reauthorization_required" }),
        {
            tone: "warning",
            text:
                "Google Calendar needs to be reconnected. The TomoCare reminder is unchanged.",
        }
    )
})
