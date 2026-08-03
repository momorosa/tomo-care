import test from "node:test"
import assert from "node:assert/strict"
import { formatDisplayDate, formatIsoDatesInText } from "./displayDate.js"

test("formats stored ISO dates as MM-DD-YYYY without timezone conversion", () => {
    assert.equal(formatDisplayDate("2026-06-10"), "06-10-2026")
    assert.equal(
        formatDisplayDate("2026-07-29T23:30:00.000Z"),
        "07-29-2026"
    )
})

test("preserves explicit fallbacks and unexpected source values", () => {
    assert.equal(formatDisplayDate(null), "—")
    assert.equal(formatDisplayDate(null, "Date pending"), "Date pending")
    assert.equal(formatDisplayDate("not-a-date"), "not-a-date")
    assert.equal(formatDisplayDate("2026-02-30"), "2026-02-30")
})

test("reformats every valid ISO date embedded in user-facing copy", () => {
    assert.equal(
        formatIsoDatesInText(
            "Last shot: 2026-06-10 · Expected due: 2026-07-29"
        ),
        "Last shot: 06-10-2026 · Expected due: 07-29-2026"
    )
})
