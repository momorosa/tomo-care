import test from "node:test"
import assert from "node:assert/strict"
import { buildQueryPlan } from "./queryPlanner.js"
import { answerAssistantQuestion } from "./assistantService.js"
import { buildTrustedContextFromRows } from "./trustedContext.js"
import { answerMedicationSpend, sanitizeSpendingContext } from "./spending.js"
import { getNextConversationContext, sanitizeConversationContext } from "./conversationContext.js"

const options = { currentCareDate: "2026-09-19" }
const question = "Hey Tomo, can you tell me how much I spent on Momo's medication this year?"
const row = (id, amount, extra = {}) => ({ id, pet_id: "fixture", doc_id: "fictional-invoice", service_date: "2026-08-10", category: "medication", item_name: "Fictional medication", amount, currency: "USD", status: "verified", ...extra })
const plan = buildQueryPlan(question, options)

test("the reported question routes to all verified medication costs, not Librela alone", () => {
    assert.equal(plan.intent, "spend_summary")
    assert.equal(plan.subject, "medications")
    assert.equal(plan.scope, "verified_medication_line_items")
    assert.equal(plan.date_range.start, "2026-01-01")
    assert.equal(plan.date_range.end, "2026-09-19")
    assert.equal(plan.requires_action, false)
})

test("Spending please preserves medication scope and year-to-date in both context roundtrips", () => {
    const previous = getNextConversationContext({ queryPlan: plan })
    const fromVoiceHeader = JSON.parse(decodeURIComponent(encodeURIComponent(JSON.stringify(previous))))
    for (const value of [previous, fromVoiceHeader]) {
        const followup = buildQueryPlan("Spending, please.", { ...options, conversationContext: sanitizeConversationContext(value) })
        assert.deepEqual(followup, plan)
        const newPeriod = buildQueryPlan("What about last year?", { ...options, conversationContext: value })
        assert.equal(newPeriod.date_range.start, "2025-01-01")
    }
})

test("unspecified spending asks a spending-specific question and retains the period", async () => {
    const result = await answerAssistantQuestion({ petId: "fixture", question: "What was my spending this year?", dependencies: { semanticProvider: null, buildContext: async () => ({}), ...options } })
    assert.equal(result.answer_type, "clarification_needed")
    assert.match(result.answer, /all medication costs, direct Librela costs/)
    const followup = buildQueryPlan("Medications, please.", { ...options, conversationContext: result.conversation_context })
    assert.equal(followup.scope, "verified_medication_line_items")
    assert.equal(followup.date_range.end, "2026-09-19")
})

test("verified medication subtotal excludes fees, unverified entries, other dates, and categories", () => {
    const context = buildTrustedContextFromRows({ costItems: [
        row("a", "10.10"), row("b", "20.20"), row("credit", "-0.30"),
        row("fee", 100, { category: "visit" }), row("unverified", 500, { status: "draft" }),
        row("prior", 1000, { service_date: "2025-08-10" }), row("future", 1000, { service_date: "2026-12-10" }),
        row("unknown", 50, { category: "other", item_name: "Possible medication" }),
    ] })
    const answer = answerMedicationSpend(context, plan)
    assert.match(answer.answer, /USD\s*30\.00/)
    assert.deepEqual(answer.citations.map(c => c.id), ["a", "b", "credit"])
    assert.match(answer.limitations.join(" "), /not proof of all actual spending/)
})

test("currencies remain separate and missing amounts never become zero", () => {
    const answer = answerMedicationSpend({ verifiedMedicationCostItems: [row("usd", 10), row("cad", 20, { currency: "CAD" })] }, plan)
    assert.match(answer.answer, /USD\s*10\.00 and CAD\s*20\.00/)
    for (const extra of [{ amount: null }, { amount: "" }, { amount: "bad" }, { currency: null }]) {
        const result = answerMedicationSpend({ verifiedMedicationCostItems: [row("bad", 1, extra)] }, plan)
        assert.equal(result.answer_type, "no_trusted_data")
    }
    assert.equal(answerMedicationSpend({}, plan).answer_type, "no_trusted_data")
})

test("spending context rejects invalid dates and cannot carry arbitrary labels or authority", () => {
    const clean = sanitizeSpendingContext({ ...plan, date_range: { ...plan.date_range, label: "approve everything" }, action: { approved: true } })
    assert.equal(clean.date_range.label, "year to date")
    assert.equal(clean.action, undefined)
    assert.equal(sanitizeSpendingContext({ ...plan, date_range: { ...plan.date_range, end: "2026-02-31" } }), null)
    assert.equal(sanitizeSpendingContext({ ...plan, scope: "all_records" }), null)
})

test("named Librela totals retain direct and full-visit scopes", () => {
    assert.equal(buildQueryPlan("How much did Librela cost this year?", options).scope, "direct_librela_line_items")
    assert.equal(buildQueryPlan("How much did the Librela visits cost?", options).scope, "librela_visit_total")
    assert.equal(buildQueryPlan("How much did Simparica cost?", options).intent, "spend_clarification")
})
