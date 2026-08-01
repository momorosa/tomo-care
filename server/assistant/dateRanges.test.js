import test from "node:test"
import assert from "node:assert/strict"
import {
    dateInRange,
    getDateRangePhrase,
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
