import test from "node:test"
import assert from "node:assert/strict"
import { formatAge, formatAgeValue, getAgeInYears } from "./petAge.js"

test("updates age on the stored birthday", () => {
    assert.equal(getAgeInYears("2014-08-22", "2026-08-21"), 11)
    assert.equal(getAgeInYears("2014-08-22", "2026-08-22"), 12)
})

test("formats a server-derived age without recalculating it in the browser", () => {
    assert.equal(formatAgeValue(11), "11 years")
    assert.equal(formatAgeValue(1), "1 year")
    assert.equal(formatAgeValue(null), "Age not set")
})

test("uses a safe label when birth date is unavailable", () => {
    assert.equal(formatAge(null, "2026-08-03"), "Age not set")
})
