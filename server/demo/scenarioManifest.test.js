import test from "node:test"
import assert from "node:assert/strict"
import {
    buildDemoScenario,
    DEMO_INTAKE_FIXTURE,
    DEMO_OWNED_TABLES,
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
    DEMO_STORAGE_PREFIX,
    getDemoScenarioCounts,
} from "./scenarioManifest.js"

test("builds one deterministic fictional scenario from the care date", () => {
    const first = buildDemoScenario("2026-09-03")
    const second = buildDemoScenario("2026-09-03")

    assert.deepEqual(first, second)
    assert.equal(first.projectRef, DEMO_PROJECT_REF)
    assert.equal(first.petId, DEMO_PET_ID)
    assert.equal(first.storage.prefix, DEMO_STORAGE_PREFIX)
    assert.deepEqual(Object.keys(first.tables).sort(), [...DEMO_OWNED_TABLES].sort())
    assert.deepEqual(getDemoScenarioCounts(first), {
        pets: 1,
        documents: 7,
        events: 6,
        cost_items: 3,
        labs: 0,
        facts: 7,
        provider_contacts: 0,
        orchestration_runs: 0,
        care_actions: 0,
        apple_messages_handoffs: 0,
    })
    assert.ok(
        DEMO_INTAKE_FIXTURE.storageKey.startsWith(`${DEMO_STORAGE_PREFIX}/`)
    )
    assert.equal(
        first.tables.documents.some(
            (document) => document.id === DEMO_INTAKE_FIXTURE.documentId
        ),
        false
    )
})

test("resolves care dates as stable offsets without changing the product clock", () => {
    const scenario = buildDemoScenario("2026-09-03")
    const librelaInjection = scenario.tables.events[0]
    const librelaReminder = scenario.tables.events[1]
    const simparicaReminder = scenario.tables.events[3]

    assert.equal(librelaInjection.event_date, "2026-07-30")
    assert.equal(librelaReminder.event_date, "2026-09-03")
    assert.equal(librelaReminder.details_json.due_date, "2026-09-17")
    assert.equal(simparicaReminder.details_json.target_admin_date, "2026-09-03")
    assert.equal(simparicaReminder.details_json.due_date, "2026-09-05")
})

test("keeps the baseline source-linked, visibly synthetic, and destination-free", () => {
    const scenario = buildDemoScenario("2026-09-03")
    const serialized = JSON.stringify(scenario)

    assert.equal(scenario.tables.provider_contacts.length, 0)
    assert.equal(scenario.tables.apple_messages_handoffs.length, 0)
    assert.ok(
        scenario.tables.documents.every(
            (document) =>
                document.title.startsWith("SAMPLE — DEMO DATA") &&
                document.external_refs.demo_owned === true &&
                document.file_url === null
        )
    )
    assert.ok(
        scenario.tables.facts.every(
            (fact) => fact.doc_id && fact.status === "verified"
        )
    )

    for (const forbidden of [
        "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95",
        "SoMa Animal Hospital",
        "gmail_msg_id",
        "google_calendar_event_id",
        "recipient_address",
    ]) {
        assert.doesNotMatch(serialized, new RegExp(forbidden))
    }
})

test("rejects invalid scenario care dates", () => {
    assert.throws(() => buildDemoScenario("2026-02-30"))
    assert.throws(() => buildDemoScenario("today"))
})
