import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const extractionUrl = new URL("../../agent/tomo/tools/extract.py", import.meta.url)
const reviewToolsUrl = new URL(
    "../verification/verificationReviewTools.js",
    import.meta.url
)
const verificationUrl = new URL(
    "../verification/verificationIntelligence.js",
    import.meta.url
)
const sourceReviewUrl = new URL(
    "../verification/sourceReviewContract.js",
    import.meta.url
)

test("extractor has a deterministic, bounded weight candidate contract", async () => {
    const source = await readFile(extractionUrl, "utf8")

    assert.match(source, /"weight_measurement"/)
    assert.match(source, /Never infer weight/)
    assert.match(source, /_normalize_weight_measurement/)
    assert.match(source, /_plausible_weight/)
    assert.match(source, /source_context/)
    assert.match(source, /patient_header_weight/)
})

test("verification intelligence compares weight value, unit, and date before risk grouping", async () => {
    const [reviewToolsSource, verificationSource, sourceReviewSource] = await Promise.all([
        readFile(reviewToolsUrl, "utf8"),
        readFile(verificationUrl, "utf8"),
        readFile(sourceReviewUrl, "utf8"),
    ])

    assert.match(reviewToolsSource, /buildSourceReviewSystemPrompt/)
    assert.match(sourceReviewSource, /source-comparison tool/)
    assert.match(verificationSource, /weight_measurement\.value/)
    assert.match(verificationSource, /weight_measurement\.unit/)
    assert.match(verificationSource, /weight_measurement\.measured_date/)
    assert.match(verificationSource, /WEIGHT_ATTENTION_PERCENT = 5/)
    assert.match(verificationSource, /not a medical conclusion/)
})
