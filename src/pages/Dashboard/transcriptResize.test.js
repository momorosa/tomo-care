import test from "node:test"
import assert from "node:assert/strict"
import { transcriptBounds, clampTranscriptRatio, transcriptRatioFromPointer, transcriptRatioFromKey } from "./transcriptResize.js"
import { answerBadge } from "./answerBadge.js"

test("dragging left expands the transcript and protects both panels", () => {
    assert.equal(transcriptRatioFromPointer(500, 100, 1000), 0.6)
    assert.equal(transcriptRatioFromPointer(-1000, 100, 1000), 0.72)
    assert.equal(transcriptRatioFromPointer(2000, 100, 1000), 0.32)
    const bounds = transcriptBounds(800)
    assert.equal(bounds.min * 800, 320)
    assert.equal((1 - bounds.max) * 800, 280)
})

test("keyboard resizing, reset, and narrow containers remain bounded", () => {
    assert.equal(transcriptRatioFromKey("ArrowLeft", 0.5, 1000), 0.52)
    assert.equal(transcriptRatioFromKey("ArrowRight", 0.5, 1000, true), 0.4)
    assert.equal(transcriptRatioFromKey("Home", 0.5, 1000), 0.32)
    assert.equal(transcriptRatioFromKey("End", 0.5, 1000), 0.72)
    assert.equal(transcriptRatioFromKey("Enter", 0.7, 1000), 0.5)
    assert.equal(transcriptRatioFromKey("a", 0.5, 1000), null)
    assert.equal(clampTranscriptRatio(0.7, 400), 0.5)
    assert.equal(clampTranscriptRatio(NaN, 1000), 0.5)
})

test("unsupported and missing-data answers never claim grounding", () => {
    assert.deepEqual(answerBadge("unsupported_question"), { label: "Not supported yet", warning: true })
    assert.deepEqual(answerBadge("no_trusted_data"), { label: "Missing verified data", warning: true })
    assert.equal(answerBadge("safety_boundary").warning, true)
    assert.equal(answerBadge("new_unrecognized_type").warning, true)
    assert.deepEqual(answerBadge("grounded_answer"), { label: "Grounded answer", warning: false })
})
