import test from "node:test"
import assert from "node:assert/strict"
import {
    getCompactReminderPresentation,
    GOOGLE_CALENDAR_HOME_URL,
} from "./reminderPresentation.js"

test("presents Librela with clinic cues and structured care dates", () => {
    const result = getCompactReminderPresentation(
        {
            id: "librela",
            event_date: "2026-07-22",
            timing_state: "overdue",
            google_calendar_url: "https://calendar.google.com/event?eid=trusted",
            details_json: {
                subtype: "Librela",
                due_date: "2026-07-29",
            },
        },
        { lastLibrelaDate: "2026-06-10" }
    )

    assert.equal(result.eyebrow, "Clinic care")
    assert.equal(result.icon, "medical_services")
    assert.equal(result.title, "Librela")
    assert.equal(result.dateLabel, "Due 07-29-2026")
    assert.equal(result.statusLabel, "Overdue")
    assert.deepEqual(result.details, [
        { label: "Last shot", value: "06-10-2026" },
        { label: "Expected due", value: "07-29-2026" },
    ])
    assert.equal(result.calendarIsSpecificEvent, true)
})

test("presents home medication and injection reminders without raw ISO copy", () => {
    const simparica = getCompactReminderPresentation({
        id: "simparica",
        event_date: "2026-08-16",
        timing_state: "upcoming",
        details_json: {
            care_item: "Simparica Trio",
            care_category: "at_home_medication",
            reminder_type: "home_medication",
            target_admin_date: "2026-08-17",
            due_date: "2026-08-19",
            last_administered_date: "2026-07-20",
            preferred_admin_day: "Monday",
            requires_appointment: false,
        },
    })
    const adequan = getCompactReminderPresentation({
        id: "adequan",
        timing_state: "upcoming",
        details_json: {
            care_item: "Adequan",
            care_category: "at_home_injection",
            reminder_type: "home_medication",
            target_admin_date: "2026-08-31",
            due_date: "2026-08-31",
            requires_appointment: false,
        },
    })

    assert.equal(simparica.eyebrow, "At-home medication")
    assert.equal(simparica.icon, "pill")
    assert.equal(simparica.dateLabel, "Due 08-17-2026")
    assert.equal(simparica.note, "Preferred day: Monday · No appointment needed")
    assert.equal(adequan.eyebrow, "At-home injection")
    assert.equal(adequan.icon, "syringe")
    assert.equal(adequan.calendarUrl, GOOGLE_CALENDAR_HOME_URL)
})

test("presents insurance reminders with filing dates and a recognizable icon", () => {
    const result = getCompactReminderPresentation({
        id: "claim",
        event_date: "2026-05-14",
        timing_state: "due_now",
        details_json: {
            subtype: "Insurance claim",
            treatment_date: "2026-04-14",
            target_submit_date: "2026-05-14",
            claim_deadline_date: "2026-10-11",
        },
    })

    assert.equal(result.eyebrow, "Insurance")
    assert.equal(result.icon, "receipt_long")
    assert.equal(result.dateLabel, "Due 05-14-2026")
    assert.deepEqual(result.details.at(-1), {
        label: "Claim deadline",
        value: "10-11-2026",
    })
})
