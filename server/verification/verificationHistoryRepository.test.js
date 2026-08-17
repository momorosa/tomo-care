import assert from "node:assert/strict"
import test from "node:test"

import { buildHistoricalSnapshots } from "./verificationHistoryRepository.js"

test("builds at most five ordered trusted historical snapshots", () => {
    const documents = Array.from({ length: 6 }, (_, index) => ({
        id: `doc-${index + 1}`,
        doc_date: `2026-0${6 - index}-01`,
        status: "verified",
    }))
    const costItems = documents.map((document) => ({
        id: `cost-${document.id}`,
        doc_id: document.id,
        item_name: "Nurse Office Visit",
        amount: 44,
        status: "verified",
    }))
    const facts = [
        {
            id: "weight-doc-1",
            doc_id: "doc-1",
            fact_type: "weight",
            status: "verified",
        },
    ]

    const snapshots = buildHistoricalSnapshots({
        documents,
        costItems,
        facts,
    })

    assert.equal(snapshots.length, 5)
    assert.equal(snapshots[0].document.id, "doc-1")
    assert.equal(snapshots[0].cost_items.length, 1)
    assert.equal(snapshots[0].facts.length, 1)
    assert.equal(snapshots[1].facts.length, 0)
})
