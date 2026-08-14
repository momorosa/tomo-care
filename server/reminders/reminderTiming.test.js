import test from "node:test"
import assert from "node:assert/strict"
import { resolveReminderTimingState } from "./reminderTiming.js"

const CURRENT_CARE_DATE = "2026-08-14"

test("recomputes home-medication timing from the current care date", () => {
    const event = buildReminder({
        eventDate: "2026-08-13",
        details: {
            reminder_type: "home_medication",
            target_admin_date: "2026-08-14",
            timing_state: "upcoming",
        },
    })

    assert.equal(resolve(event), "due_now")
})

test("keeps the Librela reminder window distinct from the overdue due date", () => {
    const event = buildReminder({
        eventDate: "2026-08-10",
        details: {
            subtype: "Librela",
            due_date: "2026-08-20",
        },
    })

    assert.equal(resolve(event), "reminder_window_passed")
    assert.equal(
        resolve({
            ...event,
            details_json: { ...event.details_json, due_date: "2026-08-13" },
        }),
        "overdue"
    )
})

test("identifies insurance filing and expired-claim windows", () => {
    const event = buildReminder({
        details: {
            subtype: "Insurance claim",
            target_submit_date: "2026-08-01",
            claim_deadline_date: "2026-08-30",
        },
    })

    assert.equal(resolve(event), "due_now")
    assert.equal(
        resolve({
            ...event,
            details_json: {
                ...event.details_json,
                claim_deadline_date: "2026-08-13",
            },
        }),
        "claim_window_expired"
    )
})

test("does not invent timing for an unsupported reminder", () => {
    assert.equal(resolve(buildReminder()), "unknown")
})

function resolve(event) {
    return resolveReminderTimingState(event, {
        currentCareDate: CURRENT_CARE_DATE,
    })
}

function buildReminder({
    eventDate = "2026-08-14",
    details = {},
} = {}) {
    return {
        id: "reminder-1",
        event_type: "reminder",
        event_date: eventDate,
        status: "planned",
        details_json: details,
    }
}
