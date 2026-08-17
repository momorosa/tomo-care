import assert from "node:assert/strict"
import test from "node:test"

import { formatDisplayMoney } from "./formatDisplayMoney.js"

test("formats displayed money with two decimal places and currency", () => {
    assert.equal(formatDisplayMoney(44, "USD"), "44.00 USD")
    assert.equal(formatDisplayMoney(160.4, "USD"), "160.40 USD")
    assert.equal(formatDisplayMoney(31.65, "USD"), "31.65 USD")
    assert.equal(formatDisplayMoney(-14.78, "USD"), "-14.78 USD")
})

test("preserves nonnumeric source text and handles missing values", () => {
    assert.equal(formatDisplayMoney("pending", "USD"), "pending USD")
    assert.equal(formatDisplayMoney(null, "USD"), "—")
})
