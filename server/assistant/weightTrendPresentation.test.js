import assert from "node:assert/strict"
import test from "node:test"

import { buildVerifiedWeightTrendPresentation } from "./weightTrendPresentation.js"

function weightFact({
    id,
    date,
    kg,
    lb,
    docId = `doc-${id}`,
    status = "verified",
    factType = "weight",
} = {}) {
    return {
        id,
        doc_id: docId,
        fact_type: factType,
        fact_date: date,
        status,
        value_json: {
            value_kg: kg,
            ...(lb === undefined ? {} : { value_lb: lb }),
        },
    }
}

test("keeps only verified numeric weight facts with valid dates in range", () => {
    const presentation = buildVerifiedWeightTrendPresentation(
        [
            weightFact({ id: "included", date: "2026-02-01", kg: 15.4 }),
            weightFact({
                id: "unverified",
                date: "2026-03-01",
                kg: 15.3,
                status: "candidate",
            }),
            weightFact({ id: "invalid-date", date: "2026-02-31", kg: 15.2 }),
            weightFact({ id: "invalid-value", date: "2026-04-01", kg: "" }),
            weightFact({
                id: "wrong-type",
                date: "2026-05-01",
                kg: 15.1,
                factType: "lab_result",
            }),
            weightFact({ id: "outside", date: "2025-12-01", kg: 15.8 }),
        ],
        { start: "2026-01-01", end: "2026-12-31" }
    )

    assert.deepEqual(
        presentation.points.map((point) => point.fact_id),
        ["included"]
    )
    assert.equal(presentation.points[0].value_lb, 33.95)
})

test("orders duplicate dates by fact id and keeps each source traceable", () => {
    const presentation = buildVerifiedWeightTrendPresentation([
        weightFact({ id: "same-b", date: "2026-04-14", kg: 15.4 }),
        weightFact({ id: "later", date: "2026-06-10", kg: 15.2 }),
        weightFact({ id: "same-a", date: "2026-04-14", kg: 15.5 }),
    ])

    assert.deepEqual(
        presentation.points.map((point) => point.fact_id),
        ["same-a", "same-b", "later"]
    )
    assert.deepEqual(
        presentation.points.map((point) => point.doc_id),
        ["doc-same-a", "doc-same-b", "doc-later"]
    )
})

test("returns the complete requested history without a presentation cap", () => {
    const facts = Array.from({ length: 14 }, (_, index) =>
        weightFact({
            id: `weight-${String(index + 1).padStart(2, "0")}`,
            date: new Date(Date.UTC(2025, index, 1))
                .toISOString()
                .slice(0, 10),
            kg: 16 - index / 10,
        })
    )

    const presentation = buildVerifiedWeightTrendPresentation(facts)

    assert.equal(presentation.points.length, 14)
    assert.equal(presentation.summary.reading_count, 14)
})

test("derives summary ids and changes from the same ordered points", () => {
    const presentation = buildVerifiedWeightTrendPresentation([
        weightFact({ id: "first", date: "2026-01-01", kg: 15.4 }),
        weightFact({ id: "high", date: "2026-02-01", kg: 16 }),
        weightFact({ id: "low-a", date: "2026-03-01", kg: 15.2 }),
        weightFact({ id: "low-b", date: "2026-04-01", kg: 15.2 }),
    ])

    assert.deepEqual(presentation.summary, {
        reading_count: 4,
        first_fact_id: "first",
        latest_fact_id: "low-b",
        low_fact_ids: ["low-a", "low-b"],
        high_fact_ids: ["high"],
        overall_change_kg: -0.2,
        latest_from_high_kg: -0.8,
        overall_direction: "slightly_downward",
        recent_first_fact_id: "first",
        recent_reading_count: 4,
        recent_change_kg: -0.2,
        recent_direction: "mixed",
    })
})

test("returns no presentation when no trusted point qualifies", () => {
    assert.equal(
        buildVerifiedWeightTrendPresentation([
            weightFact({
                id: "candidate",
                date: "2026-01-01",
                kg: 15.4,
                status: "candidate",
            }),
        ]),
        null
    )
})

test("labels one reading as insufficient rather than manufacturing a trend", () => {
    const presentation = buildVerifiedWeightTrendPresentation([
        weightFact({ id: "only", date: "2026-08-03", kg: 15.2 }),
    ])

    assert.equal(presentation.summary.overall_direction, "insufficient_readings")
    assert.equal(presentation.summary.recent_direction, "insufficient_readings")
    assert.equal(presentation.summary.overall_change_kg, 0)
})

test("keeps equal readings stable and preserves all high and low ties", () => {
    const presentation = buildVerifiedWeightTrendPresentation([
        weightFact({ id: "same-a", date: "2026-01-01", kg: 15.4 }),
        weightFact({ id: "same-b", date: "2026-02-01", kg: 15.4 }),
        weightFact({ id: "same-c", date: "2026-03-01", kg: 15.4 }),
    ])

    assert.equal(presentation.summary.overall_direction, "stable")
    assert.equal(presentation.summary.recent_direction, "stable")
    assert.deepEqual(presentation.summary.low_fact_ids, [
        "same-a",
        "same-b",
        "same-c",
    ])
    assert.deepEqual(
        presentation.summary.high_fact_ids,
        presentation.summary.low_fact_ids
    )
})
