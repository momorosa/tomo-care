import assert from "node:assert/strict"
import test from "node:test"

import { composeGroundedAnswer } from "../assistant/answerComposer.js"
import { buildTrustedContextFromRows } from "../assistant/trustedContext.js"
import { summarizeVerifiedCareEvents } from "../dashboard/careSummary.js"
import { buildVerifiedDocumentMaterialization } from "../documents/verifiedDocumentMaterialization.js"
import { composeSpokenAnswer } from "../voice/spokenAnswer.js"
import {
    buildDemoInvoiceCandidate,
    DEMO_INVOICE_ID,
} from "./demoInvoiceReviewContract.js"
import {
    buildDemoScenario,
    DEMO_INTAKE_FIXTURE,
    DEMO_PET_ID,
} from "./scenarioManifest.js"

const RAW_INVOICE_TEXT = `
SAMPLE - DEMO DATA - WHOLLY FICTIONAL
Harborlight Veterinary Center
Invoice HVC-DEMO-090726
Service date September 7, 2026
Visit weight 13.1 kg
Librela was administered during this visit
Total paid $177.00
Rabies status: Current per clinic record
This receipt does not document a Rabies vaccine administration
`

function sourceDocument() {
    return {
        id: DEMO_INTAKE_FIXTURE.documentId,
        pet_id: DEMO_PET_ID,
        doc_type: "receipt",
        title: DEMO_INTAKE_FIXTURE.title,
        file_url: DEMO_INTAKE_FIXTURE.storageKey,
        doc_date: null,
        source_org: null,
        status: "needs_review",
        external_refs: {
            demo_owned: true,
            scenario_id: "tomocare-demo-v1",
            fixture_kind: DEMO_INTAKE_FIXTURE.fixtureKind,
            content_sha256: DEMO_INTAKE_FIXTURE.contentSha256,
        },
    }
}

function buildApprovedResult() {
    const document = sourceDocument()
    const extracted = buildDemoInvoiceCandidate({
        document,
        rawText: RAW_INVOICE_TEXT,
    })
    extracted.invoice_id = DEMO_INVOICE_ID

    return buildVerifiedDocumentMaterialization({
        document: { ...document, text_extracted: extracted },
        extracted,
        verifiedAt: "2026-09-10T12:00:00.000Z",
        verifiedBy: "rosa",
    })
}

function trustedRows(materialization) {
    const scenario = buildDemoScenario("2026-09-10")
    const event = {
        id: "demo-invoice-librela-event",
        ...materialization.events[0],
    }
    const costs = materialization.costItems.map((item, index) => ({
        id: `demo-invoice-cost-${index + 1}`,
        ...item,
    }))
    const weight = {
        id: "demo-invoice-weight",
        pet_id: DEMO_PET_ID,
        doc_id: DEMO_INTAKE_FIXTURE.documentId,
        fact_type: "weight",
        fact_date: materialization.weightMeasurement.measured_date,
        status: "verified",
        verified_at: "2026-09-10T12:00:00.000Z",
        value_json: materialization.weightMeasurement,
    }
    const baselineRabies = scenario.tables.facts.find(
        (fact) => fact.fact_type === "preventive_care_status"
    )
    const rabiesStatus = {
        ...baselineRabies,
        verified_at: "2026-09-10T12:00:00.000Z",
        value_json: {
            ...baselineRabies.value_json,
            clinic_reported_status: "current",
            clinic_reported_status_as_of: "2026-09-07",
            source_document_ids: [
                ...baselineRabies.value_json.source_document_ids,
                DEMO_INTAKE_FIXTURE.documentId,
            ],
            evidence_types: ["vaccination_certificate", "receipt"],
        },
    }
    const verifiedDocument = {
        ...sourceDocument(),
        ...materialization.documentUpdate,
        id: DEMO_INTAKE_FIXTURE.documentId,
        updated_at: "2026-09-10T12:00:00.000Z",
    }

    return {
        events: [...scenario.tables.events, event],
        costItems: [...scenario.tables.cost_items, ...costs],
        documents: [...scenario.tables.documents, verifiedDocument],
        facts: [
            ...scenario.tables.facts.filter(
                (fact) => fact.fact_type !== "preventive_care_status"
            ),
            rabiesStatus,
            weight,
        ],
    }
}

test("explicit approval materializes the reviewed invoice with source links and exact evidence meaning", () => {
    const result = buildApprovedResult()

    assert.equal(result.documentUpdate.status, "verified")
    assert.equal(result.verifiedDocument.text_extracted.invoice_id, DEMO_INVOICE_ID)
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].event_type, "injection")
    assert.equal(result.events[0].event_date, "2026-09-07")
    assert.equal(result.events[0].doc_id, DEMO_INTAKE_FIXTURE.documentId)
    assert.equal(result.costItems.length, 4)
    assert.equal(
        result.costItems.reduce((sum, item) => sum + item.amount, 0),
        177
    )
    assert.ok(
        result.costItems.every(
            (item) => item.doc_id === DEMO_INTAKE_FIXTURE.documentId
        )
    )
    assert.equal(result.weightMeasurement.value_kg, 13.1)
    assert.equal(result.weightMeasurement.measured_date, "2026-09-07")
    assert.equal(result.vaccineEvidence.length, 1)
    assert.equal(
        result.vaccineEvidence[0].assertions[0].assertion_type,
        "clinic_reported_status"
    )
    assert.equal(
        result.events.some((event) => /rabies|vaccine/i.test(JSON.stringify(event))),
        false
    )
})

test("candidate truth changes no trusted read until approval, then Dashboard uses the source-linked Librela event", () => {
    const scenario = buildDemoScenario("2026-09-10")
    const before = summarizeVerifiedCareEvents(scenario.tables.events)
    const materialization = buildApprovedResult()
    const rows = trustedRows(materialization)
    const after = summarizeVerifiedCareEvents(rows.events)

    assert.notEqual(before.last_librela.event_date, "2026-09-07")
    assert.equal(after.latest_verified_care.event_date, "2026-09-07")
    assert.equal(after.last_librela.event_date, "2026-09-07")
    assert.equal(after.last_librela.id, "demo-invoice-librela-event")
})

test("Chat and Voice use the same newly verified invoice evidence", () => {
    const rows = trustedRows(buildApprovedResult())
    const context = buildTrustedContextFromRows({
        petId: DEMO_PET_ID,
        ...rows,
    })

    const librela = composeGroundedAnswer({
        question: "When was Momo's last Librela injection?",
        queryPlan: {
            intent: "last_librela",
            subject: "librela",
            date_range: { type: "all_time", start: null, end: null },
        },
        context,
    })
    const weight = composeGroundedAnswer({
        question: "What was Momo's last weight?",
        queryPlan: {
            intent: "last_weight",
            subject: "weight",
            date_range: { type: "all_time", start: null, end: null },
        },
        context,
    })
    const spend = composeGroundedAnswer({
        question: "What was the total for Momo's Librela visit?",
        queryPlan: {
            intent: "spend_summary",
            subject: "librela",
            scope: "librela_visit_total",
            date_range: {
                type: "calendar_month",
                label: "September 2026",
                start: "2026-09-01",
                end: "2026-09-30",
            },
        },
        context,
    })
    const rabies = composeGroundedAnswer({
        question: "What did the clinic say about Momo's Rabies status?",
        queryPlan: {
            intent: "vaccine_record_lookup",
            subject: "rabies_vaccine",
            vaccine_focus: "clinic_reported_status",
        },
        context,
    })

    assert.match(librela.answer, /September 7, 2026/)
    assert.equal(librela.citations[0].doc_id, DEMO_INTAKE_FIXTURE.documentId)
    assert.equal(composeSpokenAnswer(librela), librela.answer)
    assert.match(weight.answer, /13\.1 kg/)
    assert.equal(weight.citations[0].doc_id, DEMO_INTAKE_FIXTURE.documentId)
    assert.match(spend.answer, /\$177\.00/)
    assert.ok(
        spend.citations.every(
            (citation) => citation.doc_id === DEMO_INTAKE_FIXTURE.documentId
        )
    )
    assert.match(rabies.answer, /clinic-reported rabies vaccine status is current/i)
    assert.ok(
        context.verifiedPreventiveCareFacts[0].value_json.source_document_ids.includes(
            DEMO_INTAKE_FIXTURE.documentId
        ),
        "the clinic status keeps the receipt in its source-document set"
    )
})
