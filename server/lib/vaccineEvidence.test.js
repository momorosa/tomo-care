import assert from "node:assert/strict"
import test from "node:test"

import {
    getVerifiedRabiesEvidence,
    isRealIsoDate,
    summarizeVaccineEvidence,
    validateVaccineEvidenceCandidate,
} from "./vaccineEvidence.js"

const CERTIFICATE = Object.freeze({
    schema_version: 1,
    care_kind: "vaccine",
    care_item: "rabies",
    source_record_type: "vaccination_certificate",
    assertions: [
        {
            assertion_type: "administration",
            date: "2026-04-12",
            date_meaning: "administered_on",
            source_context: "Rabies vaccination date: 04/12/2026",
        },
        {
            assertion_type: "next_due",
            date: "2029-04-11",
            date_meaning: "clinic_reported_next_due",
            source_context: "Next vaccination due: 04/11/2029",
        },
    ],
    product_details: {
        product_name: "Example Rabies Vaccine",
        manufacturer: "Demo Animal Health",
        batch_number: "SYNTHETIC-LOT",
        product_expiration_date: "2027-01-31",
    },
})

test("keeps administration, next due, and product expiration distinct", () => {
    const validation = validateVaccineEvidenceCandidate(CERTIFICATE)
    const summary = summarizeVaccineEvidence(CERTIFICATE)

    assert.equal(validation.ok, true)
    assert.equal(summary.administered_on, "2026-04-12")
    assert.equal(summary.clinic_reported_next_due, "2029-04-11")
    assert.equal(summary.product_expiration_date, "2027-01-31")
})

test("rejects receipt-based administration and impossible calendar dates", () => {
    const receipt = structuredClone(CERTIFICATE)
    receipt.source_record_type = "receipt"
    receipt.assertions[0].date = "2026-02-31"

    const validation = validateVaccineEvidenceCandidate(receipt)
    assert.equal(validation.ok, false)
    assert.equal(isRealIsoDate("2026-02-31"), false)
    assert.match(validation.errors.join(" "), /receipt candidate/i)
})

test("allowlists Rabies without rewriting the future-ready array", () => {
    const bordetella = { ...CERTIFICATE, care_item: "bordetella" }
    assert.deepEqual(
        getVerifiedRabiesEvidence({
            vaccine_evidence: [bordetella, CERTIFICATE],
        }),
        [CERTIFICATE]
    )
})
