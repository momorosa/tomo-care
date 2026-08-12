import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const extractionUrl = new URL("../../agent/tomo/tools/extract.py", import.meta.url)
const triageUrl = new URL("../routes/triage.js", import.meta.url)

test("extractor has a deterministic, bounded weight candidate contract", async () => {
    const source = await readFile(extractionUrl, "utf8")

    assert.match(source, /"weight_measurement"/)
    assert.match(source, /Never infer weight/)
    assert.match(source, /_normalize_weight_measurement/)
    assert.match(source, /_plausible_weight/)
    assert.match(source, /source_context/)
    assert.match(source, /patient_header_weight/)
})

test("triage exposes weight value, unit, and date to human confirmation", async () => {
    const source = await readFile(triageUrl, "utf8")

    assert.match(source, /Weight value, unit, and measurement date.*ALWAYS require human confirmation/)
    assert.match(source, /weight_measurement\.value/)
    assert.match(source, /weight_measurement\.unit/)
    assert.match(source, /weight_measurement\.measured_date/)
})
