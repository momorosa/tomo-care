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