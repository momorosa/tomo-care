import test from "node:test"
import assert from "node:assert/strict"
import { buildQueryPlan } from "./queryPlanner.js"

test("routes the real Simparica wording to last administration, not future schedule", () => {
    const plan = buildQueryPlan("When did I last give Simparica?")

    assert.equal(plan.intent, "home_medication_status")
    assert.equal(plan.subject, "simparica_trio")
    assert.equal(plan.scope, "verified_home_medication_administrations")
})

test("routes the observed last-Simparica wording to verified history, not an action", () => {
    const plan = buildQueryPlan(
        "Hey Tomo, when was the last time I gave Momo Simparica?"
    )

    assert.equal(plan.intent, "home_medication_status")
    assert.equal(plan.subject, "simparica_trio")
    assert.equal(plan.requires_action, false)
})

test("keeps a due-date question routed to the planned schedule", () => {
    const plan = buildQueryPlan("When is Simparica due next?")

    assert.equal(plan.intent, "home_medication_due")
})

test("routes a definite medication administration statement to preparation", () => {
    const plan = buildQueryPlan("I gave Simparica today.", {
        currentCareDate: "2026-07-26",
    })

    assert.equal(plan.intent, "home_medication_given_action")
    assert.equal(plan.subject, "simparica_trio")
    assert.equal(plan.requires_action, true)
    assert.equal(plan.action.administered_date, "2026-07-26")
})

test("keeps Did I give Adequan as a factual status question", () => {
    const plan = buildQueryPlan("Did I give Adequan yesterday?", {
        currentCareDate: "2026-07-26",
    })

    assert.equal(plan.intent, "home_medication_status")
    assert.equal(plan.subject, "adequan")
    assert.equal(plan.requires_action, false)
})

test("routes an explicit Librela appointment-message request to draft preparation", () => {
    const plan = buildQueryPlan(
        "Draft an appointment request for Momo’s next Librela shot."
    )

    assert.equal(plan.intent, "librela_appointment_message")
    assert.equal(plan.subject, "librela")
    assert.equal(plan.scope, "trusted_librela_schedule")
    assert.equal(plan.requires_action, true)
})

test("preserves the appointment-status and booking guardrail routes", () => {
    const statusPlan = buildQueryPlan("Have we made a Librela appointment?")
    const bookingPlan = buildQueryPlan(
        "Can you book Momo's Librela appointment?"
    )

    assert.equal(statusPlan.intent, "appointment_status")
    assert.equal(bookingPlan.intent, "action_request")
})

test("treats a named home medication on the care calendar as its planned reminder", () => {
    const plan = buildQueryPlan("Is Adequan on my calendar?")

    assert.equal(plan.intent, "home_medication_due")
    assert.equal(plan.subject, "adequan")
    assert.equal(plan.requires_action, false)
})

test("treats a general care-calendar question as active reminders", () => {
    const plan = buildQueryPlan("What’s on my calendar?")

    assert.equal(plan.intent, "active_reminders")
    assert.equal(plan.subject, "reminders")
})

test("scopes the observed August calendar wording to August only", () => {
    const plan = buildQueryPlan(
        "Is anything on my calendar for August?",
        { currentCareDate: "2026-07-31" }
    )

    assert.equal(plan.intent, "active_reminders")
    assert.deepEqual(plan.date_range, {
        type: "calendar_month",
        label: "August 2026",
        start: "2026-08-01",
        end: "2026-08-31",
    })
})

test("does not mistake a calendar-write request for a reminder lookup", () => {
    const plan = buildQueryPlan("Can you put Adequan on my calendar?")

    assert.equal(plan.intent, "action_request")
    assert.equal(plan.requires_action, true)
})

test("routes the Phase 3E.3 attention question to governed attention", () => {
    for (const question of [
        "Tomo, what needs my attention?",
        "Show me what needs attention.",
        "Anything I need to review?",
        "Do I need to do anything?",
        "Is there anything I need to take care of?",
        "What should I handle next?",
        "Is there anything waiting for me?",
        "Anything pending?",
    ]) {
        const plan = buildQueryPlan(question)

        assert.equal(plan.intent, "attention_summary")
        assert.equal(plan.subject, "attention")
        assert.equal(plan.scope, "governed_attention")
        assert.equal(plan.requires_action, false)
    }
})

test("guarantees the four bounded attention windows", () => {
    const cases = [
        ["Do I need to do anything today?", "care_day", "2026-08-14", "2026-08-14"],
        ["Anything I need to handle tomorrow?", "next_care_day", "2026-08-15", "2026-08-15"],
        ["Hey Tomo, do I need to do anything this week?", "current_week", "2026-08-14", "2026-08-16"],
        ["What needs my attention this month?", "current_month", "2026-08-14", "2026-08-31"],
    ]

    for (const [question, type, start, end] of cases) {
        const plan = buildQueryPlan(question, {
            currentCareDate: "2026-08-14",
        })

        assert.equal(plan.intent, "attention_summary")
        assert.equal(plan.date_range.type, type)
        assert.equal(plan.date_range.start, start)
        assert.equal(plan.date_range.end, end)
    }
})

test("asks a focused clarification for broad care-overview prompts", () => {
    for (const question of [
        "What's new?",
        "What do I need to know?",
        "Hey Tomo, anything I need to know?",
    ]) {
        const plan = buildQueryPlan(question)

        assert.equal(plan.intent, "semantic_clarification")
        assert.equal(plan.subject, "care_overview")
        assert.equal(plan.requires_action, false)
    }
})

test("does not let an attention phrase absorb a consequential request", () => {
    const plan = buildQueryPlan(
        "What needs my attention, and can you approve it for me?"
    )

    assert.equal(plan.intent, "action_request")
    assert.equal(plan.requires_action, true)
})
