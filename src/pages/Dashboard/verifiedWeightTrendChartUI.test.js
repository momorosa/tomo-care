import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const chartUrl = new URL("./VerifiedWeightTrendChart.jsx", import.meta.url)
const panelUrl = new URL("./AssistantPanel.jsx", import.meta.url)
const cssUrl = new URL("../../index.css", import.meta.url)

test("renders the typed chart once inside the shared Chat and Voice answer", async () => {
    const [chartSource, panelSource] = await Promise.all([
        readFile(chartUrl, "utf8"),
        readFile(panelUrl, "utf8"),
    ])

    assert.match(panelSource, /import VerifiedWeightTrendChart/)
    assert.match(panelSource, /<VerifiedWeightTrendChart[\s\S]*visualization=\{answer\.visualization\}[\s\S]*citations=\{answer\.citations\}/)
    assert.equal((panelSource.match(/function AssistantTurn\(/g) || []).length, 1)
    assert.match(panelSource, /<VoiceTranscriptSheet[\s\S]*sessionTurns=\{sessionTurns\}/)
    assert.match(panelSource, /<SessionTranscript[\s\S]*sessionTurns=\{sessionTurns\}/)
    assert.match(chartSource, /buildVerifiedWeightTrendChartModel/)
})

test("makes every SVG point selectable by pointer and keyboard", async () => {
    const source = await readFile(chartUrl, "utf8")

    assert.match(source, /role="button"/)
    assert.match(source, /tabIndex="0"/)
    assert.match(source, /aria-label=\{point\.accessible_label\}/)
    assert.match(source, /event\.key !== "Enter"/)
    assert.match(source, /event\.key !== " "/)
    assert.match(source, /onFocus=\{\(\) => selectPoint\(point\)\}/)
})

test("keeps a text summary and verification route available beside the SVG", async () => {
    const source = await readFile(chartUrl, "utf8")

    assert.match(source, /aria-live="polite"/)
    assert.match(source, /Selected reading/)
    assert.match(source, /Open verification record/)
    assert.match(source, /Source link unavailable/)
    assert.match(source, /model\.scale_label/)
    assert.doesNotMatch(
        source,
        /ideal weight|target weight|healthy range|warning zone|prediction/i
    )
})

test("uses explicit point states and makes selection changes visually prominent", async () => {
    const [chartSource, cssSource] = await Promise.all([
        readFile(chartUrl, "utf8"),
        readFile(cssUrl, "utf8"),
    ])

    assert.match(chartSource, /Verified reading/)
    assert.match(chartSource, />\s*Selected\s*</)
    assert.match(chartSource, /key=\{selectedPoint\.fact_id\}/)
    assert.match(chartSource, /tomo-weight-trend__metric--selected/)
    assert.doesNotMatch(chartSource, /point--extreme|point--latest/)
    assert.match(cssSource, /@keyframes tomo-weight-reading-selected/)
})

test("offers lb-first display selection and keeps the source action on its own row", async () => {
    const [chartSource, cssSource] = await Promise.all([
        readFile(chartUrl, "utf8"),
        readFile(cssUrl, "utf8"),
    ])

    assert.match(chartSource, /useState\("lb"\)/)
    assert.match(chartSource, /aria-label="Weight display unit"/)
    assert.match(chartSource, /\["lb", "kg"\]/)
    assert.match(
        chartSource,
        /tomo-weight-trend__selected-content[\s\S]*tomo-weight-trend__actions[\s\S]*Open verification record/
    )
    assert.match(cssSource, /@container \(max-width: 520px\)/)
    assert.match(
        cssSource,
        /tomo-weight-trend__actions \.tomo-btn[\s\S]*white-space: nowrap/
    )
})
