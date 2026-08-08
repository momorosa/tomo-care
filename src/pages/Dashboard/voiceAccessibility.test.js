import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("loads every Material Symbol used by the voice controls", async () => {
    const html = await readFile(
        new URL("../../../index.html", import.meta.url),
        "utf8"
    )

    for (const icon of [
        "animation",
        "mic",
        "replay",
        "stop",
        "stop_circle",
        "subject",
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
    assert.match(css, /\.tomo-voice-stage__focus,[\s\S]*transition:\s*none !important/)
    assert.match(css, /\.tomo-voice-stage__avatar,[\s\S]*animation:\s*none !important/)
})

test("explains automatic stopping and makes transcript interpretation visible", async () => {
    const source = await readFile(
        new URL("./AssistantPanel.jsx", import.meta.url),
        "utf8"
    )

    assert.match(
        source,
        /Pause naturally when you’re done/
    )
    assert.match(source, /Heard “/)
    assert.match(source, /Interpreted as “/)
    assert.match(source, /Understood as “/)
    assert.match(source, /using the previous care question/)
    assert.match(source, /conversationContextRef/)
})

test("keeps Runway animation behind an explicit user-controlled start", async () => {
    const source = await readFile(
        new URL("./RunwayAvatarMedia.jsx", import.meta.url),
        "utf8"
    )

    assert.match(source, /onClick=\{startLiveAnimation\}/)
    assert.match(source, /Animate Tomo/)
    assert.match(source, /End live animation/)
    assert.match(source, /createRunwayAvatarSession\(\)/)
    assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*startLiveAnimation/)
})

test("uses the still image and disables live startup for reduced motion", async () => {
    const [source, assistantSource, css] = await Promise.all([
        readFile(new URL("./RunwayAvatarMedia.jsx", import.meta.url), "utf8"),
        readFile(new URL("./AssistantPanel.jsx", import.meta.url), "utf8"),
        readFile(new URL("../../index.css", import.meta.url), "utf8"),
    ])

    assert.match(source, /prefers-reduced-motion: reduce/)
    assert.match(source, /disabled=\{reducedMotion\}/)
    assert.match(assistantSource, /fallbackSrc=\{tomoVoiceAvatar\}/)
    assert.match(css, /\.tomo-avatar-media__video,[\s\S]*transition:\s*none !important/)
})

test("preserves local voice playback and cleanup when live animation fails", async () => {
    const source = await readFile(
        new URL("./AssistantPanel.jsx", import.meta.url),
        "utf8"
    )

    assert.match(source, /avatarMediaRef\.current\?\.isReady\(\)/)
    assert.match(source, /avatarMediaRef\.current\.speak/)
    assert.match(source, /const playback = new Audio\(nextVoiceResponse\.audioUrl\)/)
    assert.match(source, /avatarMediaRef\.current\?\.stopSpeech\(\)/)
    assert.match(source, /avatarMediaRef\.current\?\.end\(\)/)
})
