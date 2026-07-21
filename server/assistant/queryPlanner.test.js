import test from "node:test"
import assert from "node:assert/strict"
import { buildQueryPlan } from "./queryPlanner.js"

test("routes the real Simparica wording to last administration, not future schedule", () => {
    const plan = buildQueryPlan("When did I last give Simparica?")

    assert.equal(plan.intent, "home_medication_status")
    assert.equal(plan.subject, "simparica_trio")
    assert.equal(plan.scope, "verified_home_medication_administrations")
})

test("keeps a due-date question routed to the planned schedule", () => {
    const plan = buildQueryPlan("When is Simparica due next?")

    assert.equal(plan.intent, "home_medication_due")
})
