import assert from "node:assert/strict"
import test from "node:test"

import {
    buildVaccineEvidencePresentation,
    updateVaccineAssertion,
} from "./vaccineEvidencePresentation.js"

test("presents independent Rabies evidence rows", () => {
    const candidate = {
        care_item: "rabies",
        source_record_type: "vaccination_certificate",
        assertions: [
            { assertion_type: "administration", date: "2026-04-12" },
            { assertion_type: "next_due", date: "2029-04-11" },
        ],
        product_details: { product_expiration_date: "2027-01-31" },
    }

    const view = buildVaccineEvidencePresentation(candidate)
    assert.equal(view.administration.date, "2026-04-12")
    assert.equal(view.nextDue.date, "2029-04-11")
    assert.equal(view.product.product_expiration_date, "2027-01-31")
})

test("editing next due does not mutate administration", () => {
    const candidate = {
        assertions: [
            { assertion_type: "administration", date: "2026-04-12" },
        ],
    }
    const next = updateVaccineAssertion(candidate, "next_due", {
        date: "2029-04-11",
        date_meaning: "clinic_reported_next_due",
    })

    assert.equal(candidate.assertions.length, 1)
    assert.equal(next.assertions[0].date, "2026-04-12")
    assert.equal(next.assertions[1].date, "2029-04-11")
})
