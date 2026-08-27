import assert from "node:assert/strict"
import test from "node:test"

import {
    buildSourceReviewFailSafe,
    buildSourceReviewSystemPrompt,
    parseSourceReview,
} from "./sourceReviewContract.js"

const REQUESTED = [
    { path: "invoice_id", value: "DEMO-1" },
    { path: "weight_measurement.value", value: 15 },
]

test("source prompt keeps history, arithmetic, medical meaning, and approval deterministic", () => {
    const prompt = buildSourceReviewSystemPrompt()

    assert.match(prompt, /Do not re-extract/i)
    assert.match(prompt, /compare with history/i)
    assert.match(prompt, /calculate totals/i)
    assert.match(prompt, /assess medical significance/i)
    assert.match(prompt, /decide whether the document may be verified/i)
    assert.match(prompt, /downstream consequence does not make the source uncertain/i)
    assert.match(prompt, /Do not require human confirmation solely because/i)
    assert.match(prompt, /10 mg\/ml solution vial.*not an administered dose/is)
    assert.match(prompt, /Do not infer vaccine administration/i)
    assert.match(prompt, /Do not infer a paid total/i)
})

test("parser allowlists paths and states and fills omitted requested fields safely", () => {
    const parsed = parseSourceReview(
        JSON.stringify({
            fields: [
                {
                    path: "invoice_id",
                    state: "source_match",
                    reason: "Visible in source.",
                },
                {
                    path: "invented.path",
                    state: "source_match",
                    reason: "Should be ignored.",
                },
                {
                    path: "weight_measurement.value",
                    state: "high_confidence",
                    reason: "Invalid state.",
                },
            ],
            notes: "Bounded note",
        }),
        REQUESTED
    )

    assert.deepEqual(parsed.fields, [
        {
            path: "invoice_id",
            state: "source_match",
            reason: "Visible in source.",
        },
        {
            path: "weight_measurement.value",
            state: "uncertain",
            reason: "The source reviewer did not return a valid comparison for this field.",
        },
    ])
})

test("malformed source response falls back to manual review input", () => {
    assert.equal(parseSourceReview("not json", REQUESTED), null)

    const fallback = buildSourceReviewFailSafe(
        REQUESTED,
        "Reviewer unavailable",
        "fixture-model"
    )
    assert.equal(fallback.failed, true)
    assert.equal(fallback.model, "fixture-model")
    assert.deepEqual(fallback.failure, {
        reason: "unavailable",
        retryable: true,
        elapsed_ms: null,
    })
    assert.equal(fallback.fields.length, 2)
    assert.equal(
        fallback.fields.every((field) => field.state === "uncertain"),
        true
    )
})
