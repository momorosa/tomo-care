import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("uses local motion for non-speaking states and live video only for playback", async () => {
    const [avatarSource, motionSource, assistantSource, css] =
        await Promise.all([
            readFile(new URL("./RunwayAvatarMedia.jsx", import.meta.url), "utf8"),
            readFile(new URL("./TomoMotionMedia.jsx", import.meta.url), "utf8"),
            readFile(new URL("./AssistantPanel.jsx", import.meta.url), "utf8"),
            readFile(new URL("../../index.css", import.meta.url), "utf8"),
        ])

    assert.match(assistantSource, /voiceState={voiceState}/)
    assert.match(avatarSource, /onPlaybackStarted/)
    assert.match(avatarSource, /wantsLiveSpeech/)
    assert.match(avatarSource, /displayLive/)
    assert.match(avatarSource, /tomo-avatar-media__transition--covered/)
    assert.match(avatarSource, /<TomoMotionMedia/)
    assert.match(motionSource, /tomo-avatar-media__motion--visible/)
    assert.match(motionSource, /renderedPhases\.map/)
    assert.match(motionSource, /setDisplayPhase\(phase\)/)
    assert.doesNotMatch(motionSource, /local-transition/)
    assert.doesNotMatch(css, /tomo-avatar-media__local-transition/)
    assert.match(css, /.tomo-avatar-media--speaking .tomo-avatar-media__video/)
    assert.match(css, /transition: opacity 120ms ease-out/)
    assert.doesNotMatch(css, /transition: opacity 220ms ease-out/)
})

test("preserves the still fallback and disables MP4 motion for reduced motion", async () => {
    const [avatarSource, motionSource, css] = await Promise.all([
        readFile(new URL("./RunwayAvatarMedia.jsx", import.meta.url), "utf8"),
        readFile(new URL("./TomoMotionMedia.jsx", import.meta.url), "utf8"),
        readFile(new URL("../../index.css", import.meta.url), "utf8"),
    ])

    assert.match(avatarSource, /disabled={reducedMotion}/)
    assert.match(motionSource, /if \(disabled\) return null/)
    assert.match(
        css,
        /prefers-reduced-motion:[\s\S]*\.tomo-avatar-media__motion,[\s\S]*transition:\s*none !important/
    )
})
