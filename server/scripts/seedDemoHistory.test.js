import test from "node:test"
import assert from "node:assert/strict"
import { seedDemoHistory } from "./seedDemoHistory.js"
import { buildDemoHistoricalVisits, DEMO_PET_ID, DEMO_PROJECT_REF, DEMO_PROJECT_URL, DEMO_RESET_TARGETS } from "../demo/scenarioManifest.js"
import { buildTrustedContextFromRows } from "../assistant/trustedContext.js"
import { composeGroundedAnswer } from "../assistant/answerComposer.js"
import { buildVerifiedWeightTrendPresentation } from "../assistant/weightTrendPresentation.js"

const env = { TOMOCARE_RUNTIME_MODE: "demo", TOMO_PET_ID: DEMO_PET_ID, SUPABASE_URL: DEMO_PROJECT_URL, SUPABASE_SECRET_KEY: "fixture", APP_TIME_ZONE: "America/Los_Angeles" }
const argv = ["--project-ref", DEMO_PROJECT_REF]
const now = new Date("2026-09-19T20:00:00Z")
function harness(initial = {}) {
    const store = { pets: [{ id: DEMO_PET_ID }], documents: [], events: [], cost_items: [], facts: [], ...structuredClone(initial) }
    const writes = []
    let failTable = null
    const client = { from(table) { return {
        select() { return {
            eq: (_key, value) => ({ maybeSingle: async () => ({ data: store[table].find(row => row.id === value) }) }),
            in: async (_key, ids) => ({ data: store[table].filter(row => ids.includes(row.id)) }),
        } },
        insert(rows) { return { select: async () => {
            if (table === failTable) return { error: { message: "fixture failure" } }
            writes.push(table); store[table].push(...structuredClone(rows)); return { data: rows.map(row => ({ id: row.id })) }
        } } },
    } } }
    return { store, writes, clientFactory: () => client, fail: table => { failTable = table } }
}

test("history is source-linked, labeled synthetic, and covered by exact reset IDs", () => {
    const tables = buildDemoHistoricalVisits("2026-09-19")
    for (const [table, rows] of Object.entries(tables)) {
        assert.equal(rows.length, 2)
        assert.ok(rows.every(row => DEMO_RESET_TARGETS.rows[table].ids.includes(row.id)))
        assert.ok(rows.every(row => row.pet_id === DEMO_PET_ID && row.status === "verified"))
    }
    assert.deepEqual(tables.documents.map(row => row.doc_date), ["2026-05-07", "2026-07-07"])
    assert.ok(tables.documents.every(row => row.file_url === null && row.title.includes("Preloaded") && row.external_refs.has_pdf === false))
    assert.equal(tables.events.some(row => row.event_type === "reminder"), false)
})

test("repeating history seeding preserves the current invoice and reminders without duplicates", async () => {
    const kept = { documents: [{ id: "existing-invoice", status: "verified" }], events: [{ id: "existing-reminder", status: "planned" }] }
    const h = harness(kept)
    const first = await seedDemoHistory({ env, argv, now, clientFactory: h.clientFactory })
    const snapshot = structuredClone(h.store)
    const second = await seedDemoHistory({ env, argv, now: new Date("2026-09-20T20:00:00Z"), clientFactory: h.clientFactory })
    assert.deepEqual(first.inserted, { documents: 2, events: 2, cost_items: 2, facts: 2 })
    assert.deepEqual(second.inserted, { documents: 0, events: 0, cost_items: 0, facts: 0 })
    assert.deepEqual(h.store, snapshot)
    assert.deepEqual(h.store.documents[0], kept.documents[0])
    assert.deepEqual(h.store.events[0], kept.events[0])
})

test("real mode and wrong project confirmation fail before creating a client", async () => {
    for (const input of [
        { env, argv: [] },
        { env, argv: ["--project-ref", "wrong"] },
        { env: { ...env, TOMOCARE_RUNTIME_MODE: "real", TOMO_PET_ID: "real-pet", SUPABASE_URL: "https://realproject.supabase.co" }, argv },
    ]) {
        await assert.rejects(seedDemoHistory({ ...input, now, clientFactory: () => { assert.fail("must not reach database") } }))
    }
})

test("conflicting fixture data is detected before any write and never overwritten", async () => {
    const facts = buildDemoHistoricalVisits("2026-09-19").facts
    const h = harness({ facts: [{ ...facts[0], value_json: { value_kg: 99 } }] })
    await assert.rejects(seedDemoHistory({ env, argv, now, clientFactory: h.clientFactory }), /fixture differs/)
    assert.equal(h.writes.length, 0)
    assert.equal(h.store.facts[0].value_json.value_kg, 99)
})

test("an interrupted multi-table seed can be safely rerun", async () => {
    const h = harness(); h.fail("cost_items")
    await assert.rejects(seedDemoHistory({ env, argv, now, clientFactory: h.clientFactory }), /Earlier inserts may remain/)
    h.fail(null)
    await seedDemoHistory({ env, argv, now, clientFactory: h.clientFactory })
    for (const table of ["documents", "events", "cost_items", "facts"]) assert.equal(h.store[table].length, 2)
})

test("historical samples enrich totals and trends without changing the latest care anchor", () => {
    const history = buildDemoHistoricalVisits("2026-09-19")
    const septemberDocument = { id: "september", doc_date: "2026-09-07", status: "verified" }
    const facts = [...history.facts, { id: "september-weight", doc_id: "september", status: "verified", fact_type: "weight", fact_date: "2026-09-07", value_json: { value_kg: 13.1 } }]
    const context = buildTrustedContextFromRows({ petId: DEMO_PET_ID,
        documents: [...history.documents, septemberDocument], facts,
        events: [...history.events, { id: "latest", doc_id: "september", status: "verified", event_type: "injection", event_date: "2026-09-07", details_json: { medication: "Librela" } }],
        costItems: [...history.cost_items, { id: "sep-cost-1", doc_id: "september", status: "verified", category: "medication", service_date: "2026-09-07", amount: 141.5, currency: "USD" }],
    })
    const dateRange = { type: "calendar_year", start: "2026-01-01", end: "2026-12-31", label: "2026" }
    const spend = composeGroundedAnswer({ question: "Medication spending in 2026", queryPlan: { intent: "spend_summary", scope: "verified_medication_line_items", date_range: dateRange }, context })
    assert.match(spend.answer, /416.50/)
    assert.equal(new Set(spend.citations.map(c => c.doc_id)).size, 3)
    const trend = buildVerifiedWeightTrendPresentation(facts, dateRange)
    assert.equal(trend.summary.reading_count, 3)
    assert.equal(trend.summary.overall_change_kg, -0.5)
    assert.deepEqual(trend.points.map(p => p.value_kg), [13.6, 13.4, 13.1])
    const latest = composeGroundedAnswer({ question: "Last Librela injection", queryPlan: { intent: "last_librela" }, context })
    assert.equal(latest.citations[0].doc_id, "september")
})
