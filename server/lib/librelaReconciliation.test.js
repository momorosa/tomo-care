import assert from "node:assert/strict"
import test from "node:test"

import {
    buildLibrelaReconciliationPlan,
    toLibrelaReconciliationPreview,
} from "./librelaReconciliation.js"

const DOC_ID = "11111111-1111-4111-8111-111111111111"

function buildDocument(overrides = {}) {
    return {
        id: DOC_ID,
        pet_id: "pet-momo",
        status: "verified",
        title: "Veterinary clinic invoice",
        source_org: "Veterinary clinic",
        doc_date: "2026-08-03",
        text_extracted: {
            doc_date: "2026-08-03",
            events: [
                {
                    event_type: "appointment",
                    event_date: "2026-08-03",
                    details_json: { description: "Nurse office visit" },
                },
            ],
            cost_items: [
                {
                    label: "Injection Librela",
                    service_date: "2026-08-03",
                    amount: 100,
                },
                {
                    label: "Injection Librela",
                    service_date: "2026-08-03",
                    amount: -10,
                },
            ],
        },
        ...overrides,
    }
}

function buildOldReminder(overrides = {}) {
    return {
        id: "old-reminder",
        event_type: "reminder",
        event_date: "2026-07-22",
        status: "planned",
        details_json: {
            subtype: "Librela",
            anchor_event_date: "2026-06-10",
            due_date: "2026-07-29",
        },
        ...overrides,
    }
}

function buildInjection(overrides = {}) {
    return {
        id: "august-injection",
        doc_id: DOC_ID,
        event_type: "injection",
        event_date: "2026-08-03",
        status: "verified",
        details_json: { subtype: "Librela", medication: "Librela" },
        ...overrides,
    }
}

test("previews the bounded August repair without touching appointments or insurance", () => {
    const appointment = {
        id: "appointment",
        event_type: "appointment",
        event_date: "2026-08-03",
        status: "verified",
        details_json: { description: "Nurse office visit" },
    }
    const insurance = {
        id: "insurance",
        event_type: "reminder",
        event_date: "2026-09-02",
        status: "planned",
        details_json: { subtype: "Insurance claim" },
    }

    const plan = buildLibrelaReconciliationPlan({
        document: buildDocument(),
        documentEvents: [appointment],
        petEvents: [appointment, insurance, buildOldReminder()],
    })

    assert.equal(plan.state, "repair_required")
    assert.equal(plan.changes.canonical_event, "create")
    assert.equal(plan.changes.prior_reminders_to_complete, 1)
    assert.equal(plan.changes.next_reminder, "create")
    assert.deepEqual(plan.expected, {
        anchor_date: "2026-08-03",
        due_date: "2026-09-21",
        reminder_date: "2026-09-14",
        rule_version: "librela_v1",
    })

    const preview = toLibrelaReconciliationPreview(plan)
    assert.equal(preview.preserves_appointments, true)
    assert.equal(preview.preserves_non_librela_reminders, true)
    assert.match(preview.preview_token, /^[a-f0-9]{64}$/)
})

test("preserves an existing canonical injection while completing the prior cycle", () => {
    const injection = buildInjection()
    const plan = buildLibrelaReconciliationPlan({
        document: buildDocument(),
        documentEvents: [injection],
        petEvents: [injection, buildOldReminder()],
    })

    assert.equal(plan.state, "repair_required")
    assert.equal(plan.changes.canonical_event, "preserve")
    assert.equal(plan.changes.prior_reminders_to_complete, 1)
    assert.equal(plan.changes.next_reminder, "create")
})

test("recognizes an already-reconciled cycle and plans no duplicate", () => {
    const injection = buildInjection()
    const nextReminder = {
        id: "september-reminder",
        doc_id: DOC_ID,
        event_type: "reminder",
        event_date: "2026-09-14",
        status: "planned",
        details_json: {
            subtype: "Librela",
            anchor_event_id: injection.id,
            anchor_event_date: "2026-08-03",
            due_date: "2026-09-21",
            source_document_id: DOC_ID,
        },
    }

    const plan = buildLibrelaReconciliationPlan({
        document: buildDocument(),
        documentEvents: [injection, nextReminder],
        petEvents: [injection, nextReminder],
    })

    assert.equal(plan.state, "already_reconciled")
    assert.equal(plan.changes.prior_reminders_to_complete, 0)
    assert.equal(plan.changes.next_reminder, "preserve")
})

test("blocks an older invoice when a newer verified Librela injection exists", () => {
    const plan = buildLibrelaReconciliationPlan({
        document: buildDocument(),
        petEvents: [
            buildInjection({
                id: "newer-injection",
                doc_id: "newer-doc",
                event_date: "2026-08-10",
            }),
        ],
    })

    assert.equal(plan.actionable, false)
    assert.equal(plan.reason, "newer_verified_injection_exists")
})

test("rejects a narrative-only mention instead of deriving treatment", () => {
    const document = buildDocument({
        text_extracted: {
            doc_date: "2026-08-03",
            summary: "Discussed Librela as a future option.",
            events: [],
            cost_items: [],
        },
    })

    const plan = buildLibrelaReconciliationPlan({ document })

    assert.equal(plan.actionable, false)
    assert.equal(plan.reason, "administration_not_confirmed")
    assert.equal(plan.preview_token, null)
})

test("changes the preview token when the planned reminder state changes", () => {
    const before = buildLibrelaReconciliationPlan({
        document: buildDocument(),
        petEvents: [buildOldReminder()],
    })
    const after = buildLibrelaReconciliationPlan({
        document: buildDocument(),
        petEvents: [buildOldReminder({ status: "completed" })],
    })

    assert.notEqual(before.preview_token, after.preview_token)
})
