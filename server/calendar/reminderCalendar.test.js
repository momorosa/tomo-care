import test from "node:test"
import assert from "node:assert/strict"
import {
    buildHomeMedicationCalendarDescription,
    getStableGoogleCalendarEventId,
    isHomeMedicationReminder,
} from "./reminderCalendar.js"

const REMINDER_ID = "36fc213e-fec2-4135-acd7-6bfe8454afad"

function buildReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        event_type: "reminder",
        event_date: "2026-08-16",
        details_json: {
            reminder_type: "home_medication",
            care_item: "Simparica Trio",
            care_category: "at_home_medication",
            due_date: "2026-08-19",
            target_admin_date: "2026-08-17",
            last_administered_date: "2026-07-20",
            preferred_admin_day: "Monday",
            route: "oral chewable",
            requires_appointment: false,
            cadence_days: 30,
            rule_version: "home_medication_v1",
            ...overrides,
        },
    }
}

test("builds a user-friendly Simparica Calendar description", () => {
    const description = buildHomeMedicationCalendarDescription(buildReminder())

    assert.match(description, /Simparica Trio reminder for Momo/)
    assert.match(description, /Reminder date: 2026-08-16/)
    assert.match(description, /Target date: 2026-08-17/)
    assert.match(description, /Cadence due date: 2026-08-19/)
    assert.match(description, /Based on the last confirmed dose on 2026-07-20/)
    assert.doesNotMatch(description, /home_medication/)
    assert.doesNotMatch(description, /rule_version|event_id|36fc213e/i)
})

test("uses the same Calendar copy contract for Adequan", () => {
    const description = buildHomeMedicationCalendarDescription(
        buildReminder({
            care_item: "Adequan",
            care_category: "at_home_injection",
            due_date: "2026-10-26",
            target_admin_date: "2026-10-26",
            last_administered_date: "2026-08-31",
            route: "subcutaneous injection",
            cadence_days: 56,
        })
    )

    assert.match(description, /Adequan reminder for Momo/)
    assert.match(description, /Target date: 2026-10-26/)
    assert.match(description, /How to give: subcutaneous injection/)
    assert.doesNotMatch(description, /Cadence due date/)
})

test("recognizes only planned reminder-shaped home-medication events", () => {
    assert.equal(isHomeMedicationReminder(buildReminder()), true)
    assert.equal(
        isHomeMedicationReminder({
            ...buildReminder(),
            event_type: "medication_administration",
        }),
        false
    )
    assert.equal(
        isHomeMedicationReminder(
            buildReminder({ reminder_type: "insurance_claim" })
        ),
        false
    )
})

test("derives a stable Google-compatible ID from the TomoCare UUID", () => {
    assert.equal(
        getStableGoogleCalendarEventId(REMINDER_ID),
        "36fc213efec24135acd76bfe8454afad"
    )

    assert.throws(
        () => getStableGoogleCalendarEventId("contains-x"),
        /cannot be used/
    )
})