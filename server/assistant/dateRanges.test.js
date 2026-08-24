import test from "node:test"
import assert from "node:assert/strict"
import {
    dateInRange,
    getDateRangePhrase,
    resolveAttentionDateRange,
    resolveDateRange,
} from "./dateRanges.js"

test("resolves a named month without a year in the current care year", () => {
    const range = resolveDateRange(
        "Is anything on my calendar for August?",
        "2026-07-31"
    )

    assert.deepEqual(range, {
        type: "calendar_month",
        label: "August 2026",
        start: "2026-08-01",
        end: "2026-08-31",
    })
    assert.equal(getDateRangePhrase(range), "in August 2026")
    assert.equal(dateInRange("2026-08-16", range), true)
    assert.equal(dateInRange("2026-07-22", range), false)
})

test("uses an explicit year with a named month", () => {
    const range = resolveDateRange(
        "What was on the calendar in February 2024?",
        "2026-07-31"
    )

    assert.deepEqual(range, {
        type: "calendar_month",
        label: "February 2024",
        start: "2024-02-01",
        end: "2024-02-29",
    })
})

test("does not interpret modal may as the calendar month May", () => {
    const range = resolveDateRange(
        "I may have given Momo Adequan yesterday.",
        "2026-08-18"
    )

    assert.deepEqual(range, {
        type: "all_time",
        label: "all time",
        start: null,
        end: null,
    })
})

test("still resolves May when it is used as a calendar month", () => {
    const range = resolveDateRange(
        "Is anything on my calendar for May?",
        "2026-04-30"
    )

    assert.deepEqual(range, {
        type: "calendar_month",
        label: "May 2026",
        start: "2026-05-01",
        end: "2026-05-31",
    })
})

test("resolves bounded forward-looking attention windows", () => {
    const cases = [
        ["Do I need to do anything today?", "care_day", "2026-08-14", "2026-08-14"],
        ["Anything tomorrow?", "next_care_day", "2026-08-15", "2026-08-15"],
        ["What needs attention this week?", "current_week", "2026-08-14", "2026-08-16"],
        ["Anything this month?", "current_month", "2026-08-14", "2026-08-31"],
    ]

    for (const [question, type, start, end] of cases) {
        const range = resolveAttentionDateRange(question, "2026-08-14")

        assert.deepEqual(range, {
            type,
            label: {
                care_day: "today",
                next_care_day: "tomorrow",
                current_week: "this week",
                current_month: "this month",
            }[type],
            start,
            end,
        })
        assert.equal(getDateRangePhrase(range), range.label)
    }
})

test("keeps unbounded attention focused on current governed work", () => {
    assert.deepEqual(
        resolveAttentionDateRange("What needs my attention?", "2026-08-14"),
        {
            type: "all_time",
            label: "current attention",
            start: null,
            end: null,
        }
    )
})
