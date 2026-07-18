import test from "node:test"
import assert from "node:assert/strict"
import {
    DEFAULT_APP_TIME_ZONE,
    addDaysToIsoDate,
    getAppTimeZone,
    getCareDate,
    resolveRelativeCareDate,
} from "./careDates.js"

test("uses Pacific time as the default care timezone", () => {
    assert.equal(getAppTimeZone({}), DEFAULT_APP_TIME_ZONE)
})

test("allows APP_TIME_ZONE to override the default", () => {
    assert.equal(getAppTimeZone({ APP_TIME_ZONE: " UTC " }), "UTC")
})

test("resolves a summer UTC rollover to the previous Pacific care date", () => {
    const now = new Date("2026-07-18T06:30:00.000Z")

    assert.equal(getCareDate(now, "America/Los_Angeles"), "2026-07-17")
})

test("resolves a winter UTC rollover to the previous Pacific care date", () => {
    const now = new Date("2026-01-01T07:30:00.000Z")

    assert.equal(getCareDate(now, "America/Los_Angeles"), "2025-12-31")
})

test("resolves today and yesterday from the configured care date", () => {
    const options = {
        now: new Date("2026-07-18T06:30:00.000Z"),
        timeZone: "America/Los_Angeles",
    }

    assert.equal(resolveRelativeCareDate("today", options), "2026-07-17")
    assert.equal(resolveRelativeCareDate("yesterday", options), "2026-07-16")
})

test("date-only arithmetic crosses month and year boundaries", () => {
    assert.equal(addDaysToIsoDate("2026-01-01", -1), "2025-12-31")
    assert.equal(addDaysToIsoDate("2028-02-28", 1), "2028-02-29")
})

test("rejects invalid timezones and impossible ISO dates", () => {
    assert.throws(
        () => getAppTimeZone({ APP_TIME_ZONE: "Pacific/Momo" }),
        /Invalid APP_TIME_ZONE/
    )
    assert.throws(() => addDaysToIsoDate("2026-02-30", 1), /Invalid ISO date/)
})