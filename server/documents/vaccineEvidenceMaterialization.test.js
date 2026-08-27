import assert from "node:assert/strict"
import test from "node:test"

import { buildVerifiedDocumentMaterialization } from "./verifiedDocumentMaterialization.js"

test("generic events cannot materialize Rabies while bounded evidence is forwarded", () => {
    const extracted = {
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
        events: [
            {
                event_type: "vaccine",
                event_date: "2026-04-12",
                details_json: { description: "Rabies vaccine" },
            },
        ],
        cost_items: [],
    }
    const result = buildVerifiedDocumentMaterialization({
        document: {
            id: "81000000-0000-4000-8000-000000000001",
            pet_id: "80000000-0000-4000-8000-000000000001",
            doc_type: "vaccination_certificate",
            doc_date: null,
            text_extracted: extracted,
        },
        extracted,
        verifiedAt: "2026-08-26T12:00:00.000Z",
    })

    assert.deepEqual(result.events, [])
    assert.equal(result.vaccineEvidence.length, 1)
    assert.equal(result.approvedDocDate, "2026-04-12")
    assert.equal(result.approvedSourceOrg, "Fictional Veterinary Center")
    assert.equal(
        result.documentUpdate.source_org,
        "Fictional Veterinary Center"
    )
})
