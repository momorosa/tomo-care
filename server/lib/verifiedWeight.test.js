import assert from "node:assert/strict"
import test from "node:test"

import {
    buildVerifiedWeightPlan,
    extractWeightMeasurementFromText,
    getVerifiedWeightCandidate,
    normalizeStructuredWeightMeasurement,
    toVerifiedWeightPreview,
} from "./verifiedWeight.js"

const document = {
    id: "doc-aug-3",
    pet_id: "momo",
    status: "verified",
    doc_date: "2026-08-03",
    updated_at: "2026-08-03T18:00:00Z",
    raw_text: "Patients: Momo, canine, 15.1 kg. Injection Librela.",
    text_extracted: {
        doc_date: "2026-08-03",
    },
}

const pet = {
    id: "momo",
    weight_value: 15.2,
    weight_unit: "kg",
    updated_at: "2026-06-10T18:00:00Z",
}

test("normalizes a structured verified weight and both display units", () => {
    const measurement = normalizeStructuredWeightMeasurement(
        {
            value: 33.29,
            unit: "lb",
            measured_date: "2026-08-03",
            source_label: "Weight",
        },
        null
    )

    assert.equal(measurement.value, 33.29)
    assert.equal(measurement.unit, "lb")
    assert.equal(measurement.value_kg, 15.1)
    assert.equal(measurement.value_lb, 33.29)
})

test("rejects implausible or undated structured weights", () => {
    assert.equal(
        normalizeStructuredWeightMeasurement(
            { value: 4, unit: "kg", measured_date: "2026-08-03" },
            null
        ),
        null
    )
    assert.equal(
        normalizeStructuredWeightMeasurement({ value: 15.1, unit: "kg" }, null),
        null
    )
})

test("recovers a labeled or patient-header weight from verified source text", () => {
    const labeled = extractWeightMeasurementFromText(
        "Visit weight: 15.1 kg before treatment.",
        "2026-08-03"
    )
    const header = getVerifiedWeightCandidate(document, { allowRawText: true })

    assert.equal(labeled.extraction_method, "labeled_weight")
    assert.equal(labeled.value_kg, 15.1)
    assert.equal(header.extraction_method, "patient_header_weight")
    assert.match(header.source_context, /Patients: Momo/)
})

test("does not derive raw-text weight during normal approval", () => {
    assert.equal(
        getVerifiedWeightCandidate(document, { allowRawText: false }),
        null
    )
})

test("builds a token-bound materialization plan for the historical invoice", () => {
    const plan = buildVerifiedWeightPlan({ document, facts: [], pet })
    const preview = toVerifiedWeightPreview(plan)

    assert.equal(plan.state, "materialization_required")
    assert.equal(plan.actionable, true)
    assert.equal(plan.candidate.value_kg, 15.1)
    assert.equal(preview.weight_fact_action, "create")
    assert.equal(preview.latest_weight_snapshot, "update_if_newest")
    assert.equal(preview.preserves_events, true)
    assert.equal(preview.preserves_cost_items, true)
    assert.equal(preview.preserves_reminders, true)
    assert.match(plan.preview_token, /^[a-f0-9]{64}$/)
})

test("changes the preview token when trusted state changes", () => {
    const before = buildVerifiedWeightPlan({ document, facts: [], pet })
    const after = buildVerifiedWeightPlan({
        document: { ...document, updated_at: "2026-08-04T18:00:00Z" },
        facts: [],
        pet,
    })

    assert.notEqual(before.preview_token, after.preview_token)
})

test("recognizes the canonical fact and blocks a conflicting verified fact", () => {
    const matching = {
        id: "fact-1",
        pet_id: "momo",
        doc_id: document.id,
        fact_type: "weight",
        fact_date: "2026-08-03",
        status: "verified",
        value_json: { value_kg: 15.1 },
    }
    const conflict = {
        ...matching,
        id: "fact-2",
        value_json: { value_kg: 14.3 },
    }

    assert.equal(
        buildVerifiedWeightPlan({ document, facts: [matching], pet }).state,
        "already_materialized"
    )
    assert.equal(
        buildVerifiedWeightPlan({ document, facts: [conflict], pet }).state,
        "review_required"
    )
})

test("requires a verified document before producing a write plan", () => {
    const plan = buildVerifiedWeightPlan({
        document: { ...document, status: "needs_review" },
        facts: [],
        pet,
    })

    assert.equal(plan.actionable, false)
    assert.equal(plan.reason, "document_not_verified")
})
