import assert from "node:assert/strict"
import test from "node:test"

import {
    buildManualReviewExtraction,
    buildManualReviewWarning,
    getProcessingFailurePresentation,
} from "./documentProcessingFallback.js"

test("routes failed structured extraction into editable untrusted candidate data", () => {
    const extracted = buildManualReviewExtraction({
        id: "synthetic-document",
        pet_id: "synthetic-pet",
        doc_type: "receipt",
        title: "Synthetic veterinary receipt",
    })

    assert.equal(extracted.doc_id, "synthetic-document")
    assert.equal(extracted.doc_type, "receipt")
    assert.deepEqual(extracted.cost_items, [])
    assert.deepEqual(extracted.vaccine_evidence, [])
    assert.equal(extracted.confidence, 0)
    assert.match(extracted.notes, /before approval/i)
})

test("gives manual receipt recovery a direct review action", () => {
    const warning = buildManualReviewWarning("synthetic-document")

    assert.equal(warning.code, "automatic_extraction_incomplete")
    assert.equal(warning.nextAction, "open_review")
    assert.match(warning.message, /open the saved document/i)
})

test("explains unreadable text without exposing provider errors", () => {
    const presentation = getProcessingFailurePresentation("populate_raw_text")

    assert.match(presentation.title, /could not read its text/i)
    assert.match(presentation.message, /OCR/i)
    assert.equal(presentation.nextAction, "open_source_or_retry")
})
