import assert from "node:assert/strict"
import test from "node:test"

import {
    buildDemoInvoiceCandidate,
    buildDemoInvoiceSourceReview,
    DEMO_INVOICE_ID,
    DEMO_INVOICE_REVIEW_FIELD,
    isManifestOwnedDemoInvoice,
} from "./demoInvoiceReviewContract.js"
import {
    DEMO_INTAKE_FIXTURE,
    DEMO_PET_ID,
    DEMO_SCENARIO_ID,
} from "./scenarioManifest.js"
import {
    buildVerificationAssessment,
    enumerateVerificationFields,
} from "../verification/verificationIntelligence.js"
import { createVerificationReviewTools } from "../verification/verificationReviewTools.js"

const DOCUMENT = Object.freeze({
    id: DEMO_INTAKE_FIXTURE.documentId,
    pet_id: DEMO_PET_ID,
    doc_type: "receipt",
    title: DEMO_INTAKE_FIXTURE.title,
    file_url: DEMO_INTAKE_FIXTURE.storageKey,
    status: "ingested",
    external_refs: Object.freeze({
        demo_owned: true,
        scenario_id: DEMO_SCENARIO_ID,
        fixture_kind: DEMO_INTAKE_FIXTURE.fixtureKind,
        content_sha256: DEMO_INTAKE_FIXTURE.contentSha256,
    }),
})

const RAW_TEXT = `
SAMPLE - DEMO DATA - WHOLLY FICTIONAL
Harborlight Veterinary Center
Invoice HVC-DEMO-090726
Service date September 7, 2026
Visit weight 13.1 kg
Mobility follow-up with Dr. Avery Chen. Librela was administered during this visit.
Nurse mobility visit $48.00
Librela administration $29.50
Librela 10 mg/mL single-dose vial $112.00
Demo wellness credit -$12.50
TOTAL PAID $177.00
Rabies status: Current per clinic record.
This invoice does not document a Rabies vaccine administration or establish an administration date.
`.trim()

function history() {
    return [
        {
            document: {
                id: "history-receipt",
                doc_type: "receipt",
                doc_date: "2026-08-06",
                source_org: "Harborlight Veterinary Center",
            },
            cost_items: [
                {
                    item_name: "SAMPLE — DEMO DATA — Librela injection",
                    amount: 142.75,
                    status: "verified",
                },
            ],
            facts: [
                {
                    fact_type: "weight",
                    fact_date: "2026-08-06",
                    status: "verified",
                    value_json: { value: 13.3, unit: "kg", value_kg: 13.3 },
                },
            ],
            events: [],
        },
        ...["wellness_summary", "wellness_summary", "wellness_summary"].map(
            (docType, index) => ({
                document: {
                    id: `history-wellness-${index}`,
                    doc_type: docType,
                    doc_date: `2026-0${7 - index}-01`,
                    source_org: "Harborlight Veterinary Center",
                },
                cost_items: [],
                facts: [],
                events: [],
            })
        ),
        {
            document: {
                id: "history-certificate",
                doc_type: "vaccination_certificate",
                doc_date: "2026-07-12",
                source_org: "Harborlight Veterinary Center",
            },
            cost_items: [],
            facts: [
                {
                    fact_type: "preventive_care_status",
                    fact_date: "2027-09-05",
                    status: "verified",
                    value_json: {
                        care_item: "rabies",
                        clinic_reported_next_due: "2027-09-05",
                    },
                },
            ],
            events: [],
        },
    ]
}

test("builds the exact untrusted invoice candidate with one planned omission", () => {
    const candidate = buildDemoInvoiceCandidate({
        document: DOCUMENT,
        rawText: RAW_TEXT,
    })

    assert.equal(isManifestOwnedDemoInvoice(DOCUMENT), true)
    assert.equal(candidate.invoice_id, null)
    assert.equal(candidate.doc_date, "2026-09-07")
    assert.equal(candidate.source_org, "Harborlight Veterinary Center")
    assert.deepEqual(candidate.totals, { paid: 177, currency: "USD" })
    assert.equal(candidate.weight_measurement.value, 13.1)
    assert.equal(candidate.events[0].event_type, "injection")
    assert.equal(candidate.events[0].details_json.subtype, "Librela")
    assert.equal(candidate.cost_items.length, 4)
    assert.equal(
        candidate.vaccine_evidence[0].assertions.some(
            (assertion) => assertion.assertion_type === "administration"
        ),
        false
    )
})

test("fails closed when manifest identity or approved source text changes", () => {
    assert.equal(
        buildDemoInvoiceCandidate({
            document: { ...DOCUMENT, file_url: "somewhere-else.pdf" },
            rawText: RAW_TEXT,
        }),
        null
    )

    assert.throws(
        () =>
            buildDemoInvoiceCandidate({
                document: DOCUMENT,
                rawText: RAW_TEXT.replace("$177.00", "$999.00"),
            }),
        /does not match its approved synthetic source contract/i
    )
})

test("source comparison flags only the missing invoice number for correction", () => {
    const candidate = buildDemoInvoiceCandidate({
        document: DOCUMENT,
        rawText: RAW_TEXT,
    })
    const review = buildDemoInvoiceSourceReview({
        document: DOCUMENT,
        rawText: RAW_TEXT,
        extracted: candidate,
        fields: enumerateVerificationFields(candidate),
    })
    const nonMatches = review.fields.filter(
        (field) => field.state !== "source_match"
    )

    assert.deepEqual(nonMatches, [
        {
            path: DEMO_INVOICE_REVIEW_FIELD,
            state: "missing_in_candidate",
            reason:
                `The source clearly prints invoice ${DEMO_INVOICE_ID}, but the candidate did not capture it.`,
        },
    ])

    candidate.invoice_id = DEMO_INVOICE_ID
    const corrected = buildDemoInvoiceSourceReview({
        document: DOCUMENT,
        rawText: RAW_TEXT,
        extracted: candidate,
        fields: enumerateVerificationFields(candidate),
    })

    assert.equal(
        corrected.fields.every((field) => field.state === "source_match"),
        true
    )
})

test("the exact demo source comparison stays inside the bounded contract", async () => {
    const candidate = buildDemoInvoiceCandidate({
        document: DOCUMENT,
        rawText: RAW_TEXT,
    })
    let providerCalled = false
    const tools = createVerificationReviewTools({
        async sourceReviewer() {
            providerCalled = true
            throw new Error("The general source reviewer must not run.")
        },
    })

    const review = await tools.compare_current_source({
        document: {
            ...DOCUMENT,
            raw_text: RAW_TEXT,
            text_extracted: candidate,
        },
    })

    assert.equal(providerCalled, false)
    assert.equal(review.failed, false)
    assert.equal(
        review.fields.find((field) => field.path === DEMO_INVOICE_REVIEW_FIELD)
            .state,
        "missing_in_candidate"
    )
})

test("Verification Intelligence creates one bounded review item without trusting data", () => {
    const candidate = buildDemoInvoiceCandidate({
        document: DOCUMENT,
        rawText: RAW_TEXT,
    })
    const sourceReview = buildDemoInvoiceSourceReview({
        document: DOCUMENT,
        rawText: RAW_TEXT,
        extracted: candidate,
        fields: enumerateVerificationFields(candidate),
    })
    const assessment = buildVerificationAssessment({
        rawText: RAW_TEXT,
        extracted: candidate,
        document: DOCUMENT,
        history: history(),
        sourceReview,
        model: sourceReview.model,
        createdAt: "2026-09-10T12:00:00.000Z",
    })
    const blocking = assessment.fields.filter(
        (field) => field.blocks_approval
    )

    assert.equal(assessment.status, "ready")
    assert.equal(assessment.fail_safe, false)
    assert.equal(assessment.summary.blocking_count, 1)
    assert.equal(blocking[0].path, DEMO_INVOICE_REVIEW_FIELD)
    assert.match(blocking[0].reason, /invoice HVC-DEMO-090726/i)
    assert.equal(
        assessment.fields.find(
            (field) => field.path === "checks.invoice_arithmetic"
        ).outcome,
        "consistent_pattern"
    )
    assert.equal(
        assessment.fields.find(
            (field) => field.path === "checks.vaccine_evidence[0]"
        ).extracted_value.administered_on,
        null
    )
    assert.equal(DOCUMENT.status, "ingested")
})

test("correcting the planned field clears the review block on recheck", () => {
    const candidate = buildDemoInvoiceCandidate({
        document: DOCUMENT,
        rawText: RAW_TEXT,
    })
    candidate.invoice_id = DEMO_INVOICE_ID
    const sourceReview = buildDemoInvoiceSourceReview({
        document: DOCUMENT,
        rawText: RAW_TEXT,
        extracted: candidate,
        fields: enumerateVerificationFields(candidate),
    })
    const assessment = buildVerificationAssessment({
        rawText: RAW_TEXT,
        extracted: candidate,
        document: DOCUMENT,
        history: history(),
        sourceReview,
        model: sourceReview.model,
        createdAt: "2026-09-10T12:05:00.000Z",
    })

    assert.equal(assessment.summary.blocking_count, 0)
})
