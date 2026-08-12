import assert from "node:assert/strict"
import test from "node:test"

import {
    buildLibrelaReminderRecommendation,
    canonicalizeVerifiedLibrelaEvents,
    classifyLibrelaAdministrationEvidence,
    getLibrelaReminderReadiness,
} from "./librelaEvidence.js"

function buildVerifiedInvoice(overrides = {}) {
    return {
        id: "document-1",
        pet_id: "pet-1",
        status: "verified",
        doc_type: "invoice",
        doc_date: "2026-08-03",
        title: "Veterinary invoice",
        text_extracted: {
            doc_date: "2026-08-03",
            events: [
                {
                    event_type: "appointment",
                    event_date: "2026-08-03",
                    details_json: {
                        veterinarian: "Clinic veterinarian",
                    },
                },
            ],
            cost_items: [
                {
                    service_date: "2026-08-03",
                    label: "Nurse Office Visit",
                    amount: 44,
                },
                {
                    service_date: "2026-08-03",
                    label: "Injection Librela",
                    amount: -14.78,
                },
                {
                    service_date: "2026-08-03",
                    label: "Librela 10 mg/ml Solution Vial",
                    amount: 99.53,
                },
                {
                    service_date: "2026-08-03",
                    label: "Injection Librela",
                    amount: 31.65,
                },
            ],
        },
        ...overrides,
    }
}

test("recognizes the observed invoice wording as verified Librela administration", () => {
    const assessment = classifyLibrelaAdministrationEvidence({
        document: buildVerifiedInvoice(),
    })

    assert.equal(assessment.state, "eligible")
    assert.equal(assessment.event_date, "2026-08-03")
    assert.equal(assessment.evidence_source, "verified_invoice_cost_item")
    assert.equal(assessment.evidence_path, "cost_items[3]")
})

test("derives one canonical injection while preserving the appointment", () => {
    const document = buildVerifiedInvoice()
    const result = canonicalizeVerifiedLibrelaEvents({
        document,
        events: document.text_extracted.events,
    })

    assert.equal(result.derived, true)
    assert.equal(result.events.length, 2)
    assert.equal(result.events[0].event_type, "appointment")
    assert.deepEqual(result.events[1], {
        event_type: "injection",
        event_date: "2026-08-03",
        details_json: {
            subtype: "Librela",
            medication: "Librela",
            description: "Librela injection",
            derived_from: "verified_invoice_cost_item",
            source_evidence_path: "cost_items[3]",
            classifier_version: "librela_evidence_v1",
        },
    })
})

test("canonicalization is idempotent when the injection already exists", () => {
    const document = buildVerifiedInvoice()
    const first = canonicalizeVerifiedLibrelaEvents({
        document,
        events: document.text_extracted.events,
    })
    const second = canonicalizeVerifiedLibrelaEvents({
        document,
        events: first.events,
    })

    assert.equal(second.derived, false)
    assert.equal(
        second.events.filter((event) => event.event_type === "injection").length,
        1
    )
})

test("does not qualify a negative adjustment or vial purchase alone", () => {
    const document = buildVerifiedInvoice()
    document.text_extracted.cost_items =
        document.text_extracted.cost_items.slice(0, 3)

    const assessment = classifyLibrelaAdministrationEvidence({ document })

    assert.equal(assessment.state, "review_required")
    assert.equal(assessment.reason, "administration_not_confirmed")
})

test("keeps separate same-date vial and generic injection lines reviewable", () => {
    const document = buildVerifiedInvoice()
    document.text_extracted.cost_items = [
        {
            service_date: "2026-08-03",
            label: "Librela 10 mg/ml Solution Vial",
            amount: 99.53,
        },
        {
            service_date: "2026-08-03",
            label: "Injection fee",
            amount: 31.65,
        },
    ]

    const assessment = classifyLibrelaAdministrationEvidence({ document })

    assert.equal(assessment.state, "review_required")
    assert.equal(assessment.reason, "administration_not_confirmed")
})

test("keeps a narrative-only Librela mention reviewable", () => {
    const document = buildVerifiedInvoice()
    document.text_extracted.events = [
        {
            event_type: "appointment",
            event_date: "2026-08-03",
            details_json: {
                description: "Discussed whether Librela may be appropriate.",
            },
        },
    ]
    document.text_extracted.cost_items = []

    const assessment = classifyLibrelaAdministrationEvidence({ document })

    assert.equal(assessment.state, "review_required")
    assert.equal(assessment.reason, "administration_not_confirmed")
})

test("hides the action when the verified source has no Librela evidence", () => {
    const document = buildVerifiedInvoice({ title: "Wellness visit invoice" })
    document.text_extracted.events = []
    document.text_extracted.cost_items = [
        {
            service_date: "2026-08-03",
            label: "Nail trim",
            amount: 20,
        },
    ]

    const recommendation = buildLibrelaReminderRecommendation({ document })

    assert.equal(recommendation.state, "not_applicable")
    assert.equal(recommendation.show, false)
    assert.equal(recommendation.disabled, true)
})

test("accepts an explicit verified structured Librela injection", () => {
    const document = buildVerifiedInvoice()
    document.text_extracted.events = [
        {
            event_type: "injection",
            event_date: "2026-08-03",
            details_json: { medication: "Librela" },
        },
    ]
    document.text_extracted.cost_items = []

    const assessment = classifyLibrelaAdministrationEvidence({ document })

    assert.equal(assessment.state, "eligible")
    assert.equal(assessment.evidence_source, "verified_structured_event")
})

test("never promotes evidence from an unverified document", () => {
    const document = buildVerifiedInvoice({ status: "needs_review" })

    const assessment = classifyLibrelaAdministrationEvidence({ document })

    assert.equal(assessment.state, "review_required")
    assert.equal(assessment.reason, "document_not_verified")
})

test("requires review when direct administration evidence lacks a valid date", () => {
    const document = buildVerifiedInvoice({ doc_date: null })
    document.text_extracted.doc_date = null
    document.text_extracted.cost_items = [
        {
            label: "Injection Librela",
            amount: 31.65,
        },
    ]

    const assessment = classifyLibrelaAdministrationEvidence({ document })

    assert.equal(assessment.state, "review_required")
    assert.equal(assessment.reason, "missing_administration_date")
})

test("reports repair required when source evidence is eligible but the canonical event is missing", () => {
    const readiness = getLibrelaReminderReadiness({
        document: buildVerifiedInvoice(),
        materializedEvents: [
            {
                event_type: "appointment",
                event_date: "2026-08-03",
                status: "verified",
                details_json: {},
            },
        ],
    })

    assert.equal(readiness.state, "repair_required")
    assert.equal(readiness.evidence_state, "eligible")
    assert.equal(readiness.actionable, false)
    assert.equal(readiness.reason, "canonical_event_missing")
})

test("enables the action only when both verified evidence and the canonical event exist", () => {
    const readiness = getLibrelaReminderReadiness({
        document: buildVerifiedInvoice(),
        materializedEvents: [
            {
                id: "injection-1",
                event_type: "injection",
                event_date: "2026-08-03",
                status: "verified",
                details_json: { subtype: "Librela" },
            },
        ],
    })

    assert.equal(readiness.state, "eligible")
    assert.equal(readiness.actionable, true)
    assert.equal(readiness.injection.id, "injection-1")
})

test("recognizes a reminder already linked to the canonical injection", () => {
    const readiness = getLibrelaReminderReadiness({
        document: { ...buildVerifiedInvoice(), id: "doc-1" },
        materializedEvents: [
            {
                id: "injection-1",
                event_type: "injection",
                event_date: "2026-08-03",
                status: "verified",
                details_json: { subtype: "Librela" },
            },
            {
                id: "reminder-1",
                event_type: "reminder",
                event_date: "2026-09-14",
                status: "planned",
                details_json: {
                    subtype: "Librela",
                    anchor_event_id: "injection-1",
                    anchor_event_date: "2026-08-03",
                    source_document_id: "doc-1",
                },
            },
        ],
    })

    assert.equal(readiness.state, "reconciled")
    assert.equal(readiness.actionable, false)
    assert.equal(readiness.reminder.id, "reminder-1")
})
