import assert from "node:assert/strict"
import test from "node:test"

import {
    buildVerificationAssessment,
    enumerateVerificationFields,
    validateVerificationApproval,
} from "./verificationIntelligence.js"

const DOCUMENT = Object.freeze({
    id: "81000000-0000-4000-8000-000000000001",
    pet_id: "80000000-0000-4000-8000-000000000001",
    doc_type: "vaccination_certificate",
    doc_date: "2026-04-12",
    source_org: "Fictional Veterinary Center",
    status: "needs_review",
})

function certificateEvidence() {
    return {
        doc_type: "vaccination_certificate",
        doc_date: "2026-04-12",
        source_org: "Fictional Veterinary Center",
        vaccine_evidence: [
            {
                schema_version: 1,
                care_kind: "vaccine",
                care_item: "rabies",
                source_record_type: "vaccination_certificate",
                assertions: [
                    {
                        assertion_type: "administration",
                        date: "2026-04-12",
                        date_meaning: "administered_on",
                    },
                    {
                        assertion_type: "next_due",
                        date: "2029-04-11",
                        date_meaning: "clinic_reported_next_due",
                    },
                ],
                product_details: {
                    product_expiration_date: "2027-01-31",
                },
            },
        ],
        events: [],
        cost_items: [],
        labs: [],
    }
}

function sourceReview(extracted) {
    return {
        fields: enumerateVerificationFields(extracted).map((field) => ({
            path: field.path,
            state: "source_match",
            reason: "The synthetic source clearly prints this value.",
        })),
    }
}

function assessment(extracted, history = []) {
    return buildVerificationAssessment({
        rawText:
            "SYNTHETIC CERTIFICATE Rabies administered 04/12/2026. Next due 04/11/2029. Product expires 01/31/2027.",
        extracted,
        document: DOCUMENT,
        history,
        sourceReview: sourceReview(extracted),
        createdAt: "2026-08-26T12:00:00.000Z",
        model: "synthetic-source-reviewer",
    })
}

test("groups certificate-backed administration and due without conflation", () => {
    const extracted = certificateEvidence()
    const result = assessment(extracted)
    const vaccine = result.fields.find(
        (field) => field.path === "checks.vaccine_evidence[0]"
    )

    assert.equal(vaccine.outcome, "new_or_limited_history")
    assert.equal(vaccine.blocks_approval, false)
    assert.equal(vaccine.extracted_value.administered_on, "2026-04-12")
    assert.equal(
        vaccine.extracted_value.clinic_reported_next_due,
        "2029-04-11"
    )
    assert.equal(
        vaccine.extracted_value.product_expiration_date,
        "2027-01-31"
    )
    assert.equal(
        result.fields.some((field) => field.path === "unsupported.rabies_evidence"),
        false
    )
})

test("matching receipt due date becomes supporting provenance, not administration", () => {
    const extracted = certificateEvidence()
    extracted.doc_type = "receipt"
    extracted.vaccine_evidence[0] = {
        schema_version: 1,
        care_kind: "vaccine",
        care_item: "rabies",
        source_record_type: "receipt",
        assertions: [
            {
                assertion_type: "next_due",
                date: "2029-04-11",
                date_meaning: "clinic_reported_next_due",
            },
        ],
        product_details: {},
    }
    const result = assessment(extracted, [
        {
            document: { id: "trusted-certificate", doc_date: "2026-04-12" },
            facts: [
                {
                    status: "verified",
                    fact_type: "preventive_care_status",
                    value_json: {
                        care_item: "rabies",
                        clinic_reported_next_due: "2029-04-11",
                    },
                },
            ],
        },
    ])

    const vaccine = result.fields.find(
        (field) => field.path === "checks.vaccine_evidence[0]"
    )
    assert.equal(vaccine.outcome, "consistent_pattern")
    assert.equal(
        extracted.vaccine_evidence[0].assertions.some(
            (item) => item.assertion_type === "administration"
        ),
        false
    )
})

test("conflicting trusted due date is surfaced without silent selection", () => {
    const extracted = certificateEvidence()
    const result = assessment(extracted, [
        {
            document: { id: "trusted-receipt", doc_date: "2026-04-12" },
            facts: [
                {
                    status: "verified",
                    fact_type: "preventive_care_status",
                    value_json: {
                        care_item: "rabies",
                        clinic_reported_next_due: "2028-04-11",
                    },
                },
            ],
        },
    ])
    const vaccine = result.fields.find(
        (field) => field.path === "checks.vaccine_evidence[0]"
    )

    assert.equal(vaccine.outcome, "conflict_or_uncertainty")
    assert.equal(vaccine.blocks_approval, true)
    assert.match(vaccine.reason, /did not choose between them/i)
})

test("structurally invalid vaccine evidence cannot be waived at approval", () => {
    const extracted = certificateEvidence()
    extracted.vaccine_evidence[0].source_record_type = "receipt"
    const result = assessment(extracted)

    const approval = validateVerificationApproval({
        assessment: result,
        extracted,
        candidateFingerprint: result.candidate_fingerprint,
        acceptedPaths: ["checks.vaccine_evidence[0]"],
    })

    assert.equal(approval.ok, false)
    assert.equal(approval.reason, "invalid_vaccine_evidence")
})
