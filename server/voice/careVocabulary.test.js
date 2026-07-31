import test from "node:test"
import assert from "node:assert/strict"
import {
    interpretCareTranscript,
    TOMO_TRANSCRIPTION_KEYWORDS,
    TOMO_TRANSCRIPTION_PROMPT,
} from "./careVocabulary.js"

test("interprets the observed Librella near-match without hiding it", () => {
    const result = interpretCareTranscript(
        "Hey Tomo, how much have I spent on Librella?"
    )

    assert.equal(
        result.original,
        "Hey Tomo, how much have I spent on Librella?"
    )
    assert.equal(
        result.interpreted,
        "Hey Tomo, how much have I spent on Librela?"
    )
    assert.deepEqual(result.corrections, [
        {
            heard: "Librella",
            interpreted_as: "Librela",
        },
    ])
})

test("limits fuzzy interpretation to known medication entities", () => {
    const result = interpretCareTranscript(
        "Please keep this literal and check a general reminder."
    )

    assert.equal(result.interpreted, result.original)
    assert.deepEqual(result.corrections, [])
})

test("handles one-letter medication variations and preserves punctuation", () => {
    const result = interpretCareTranscript(
        "Was Simperica given, and when is Adequon due?"
    )

    assert.equal(
        result.interpreted,
        "Was Simparica given, and when is Adequan due?"
    )
    assert.deepEqual(result.corrections, [
        {
            heard: "Simperica",
            interpreted_as: "Simparica",
        },
        {
            heard: "Adequon",
            interpreted_as: "Adequan",
        },
    ])
})

test("provides bounded transcription context for TomoCare terms", () => {
    assert.match(TOMO_TRANSCRIPTION_PROMPT, /Momo’s pet care/)
    assert.deepEqual(TOMO_TRANSCRIPTION_KEYWORDS, [
        "Momo",
        "Tomo",
        "Librela",
        "Simparica Trio",
        "Adequan",
        "SoMa Animal Hospital",
    ])
})
