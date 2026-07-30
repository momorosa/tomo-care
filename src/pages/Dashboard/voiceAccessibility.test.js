import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("loads every Material Symbol used by the voice controls", async () => {
    const html = await readFile(
        new URL("../../../index.html", import.meta.url),
        "utf8"
    )

    for (const icon of [
        "mic",
        "replay",
        "stop",
        "stop_circle",
        "volume_off",
        "volume_up",
    ]) {
        assert.match(html, new RegExp(`(?:,|=)${icon}(?:,|&)`))
    }
})

test("provides non-animated voice states for reduced-motion users", async () => {
    const css = await readFile(
        new URL("../../index.css", import.meta.url),
        "utf8"
    )

    assert.match(css, /prefers-reduced-motion:\s*reduce/)
    assert.match(css, /\.tomo-voice-status__orb span\s*\{[\s\S]*animation:\s*none !important/)
})