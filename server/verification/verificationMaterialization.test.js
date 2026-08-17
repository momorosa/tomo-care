import assert from "node:assert/strict"
import test from "node:test"

import {
    buildVerifiedDocumentMaterialization,
    isMaterializableVerifiedEvent,
} from "../documents/verifiedDocumentMaterialization.js"

test("Phase 3E.5 never materializes vaccine-shaped candidate events", () => {
    const vaccine = {
        event_type: "injection",
        event_date: "2026-08-16",
        details_json: {
            description: "Rabies vaccine due reminder",
        },
    }

    assert.equal(isMaterializableVerifiedEvent(vaccine), false)

    const result = buildVerifiedDocumentMaterialization({
        document: {
            id: "72000000-0000-4000-8000-000000000001",
            pet_id: "70000000-0000-4000-8000-000000000001",
            doc_type: "receipt",
            doc_date: "2026-08-16",
            status: "needs_review",
        },
        extracted: {
            doc_date: "2026-08-16",
            events: [vaccine],
            cost_items: [],
            labs: [],
        },
        verifiedAt: "2026-08-16T18:00:00.000Z",
        verifiedBy: "fixture-owner",
    })

    assert.deepEqual(result.events, [])
    assert.deepEqual(result.labs, [])
})
