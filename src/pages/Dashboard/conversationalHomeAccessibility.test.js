import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const dashboardUrl = new URL("./Dashboard.jsx", import.meta.url)
const sidebarUrl = new URL("./CareSidebar.jsx", import.meta.url)
const assistantUrl = new URL("./AssistantPanel.jsx", import.meta.url)
const avatarMediaUrl = new URL("./RunwayAvatarMedia.jsx", import.meta.url)
const evidenceUrl = new URL("./EvidenceCard.jsx", import.meta.url)
const cssUrl = new URL("../../index.css", import.meta.url)
const appUrl = new URL("../../App.jsx", import.meta.url)
const indexHtmlUrl = new URL("../../../index.html", import.meta.url)

test("keeps the app header outside the responsive conversational-home grid", async () => {
    const [appSource, dashboardSource] = await Promise.all([
        readFile(appUrl, "utf8"),
        readFile(dashboardUrl, "utf8"),
    ])

    assert.match(appSource, /<Header\s*\/>[\s\S]*<Routes>/)
    assert.match(dashboardSource, /className="tomo-conversational-home/)
})

test("lets the main conversation consume remaining width after either panel closes", async () => {
    const css = await readFile(cssUrl, "utf8")

    assert.match(
        css,
        /grid-template-columns:[\s\S]*var\(--tomo-nav-width\)[\s\S]*var\(--tomo-drawer-width\)[\s\S]*minmax\(0, 1fr\)/
    )
    assert.match(
        css,
        /\.tomo-home-grid--nav-collapsed[\s\S]*--tomo-nav-width: 72px/
    )
    assert.match(
        css,
        /\.tomo-home-grid--drawer-closed[\s\S]*--tomo-drawer-width: 0px/
    )
})

test("labels every care section and keeps its content below a drawer header", async () => {
    const source = await readFile(sidebarUrl, "utf8")

    assert.match(source, /aria-label="Momo care navigation"/)
    assert.match(source, /Momo Care Profile/)
    assert.match(source, /tomo-context-drawer__header/)
    assert.match(source, /tomo-context-drawer__body/)
})

test("uses one aligned subheader boundary and clean full-width navigation rows", async () => {
    const [sidebarSource, css] = await Promise.all([
        readFile(sidebarUrl, "utf8"),
        readFile(cssUrl, "utf8"),
    ])

    assert.match(sidebarSource, /tomo-care-nav__header/)
    assert.match(sidebarSource, /tomo-care-nav__footer/)
    assert.match(css, /\.tomo-care-nav__header[\s\S]*min-h-\[72px\]/)
    assert.match(css, /\.tomo-context-drawer__header[\s\S]*min-h-\[72px\]/)
    assert.match(css, /\.tomo-conversation-header[\s\S]*min-h-\[72px\]/)
    assert.match(css, /\.tomo-care-nav__item[\s\S]*w-full/)

    const activeRule = css.match(
        /\.tomo-care-nav__item--active\s*\{([\s\S]*?)\n\s*\}/
    )?.[1]

    assert.ok(activeRule)
    assert.doesNotMatch(activeRule, /box-shadow|border-radius|rounded/)
})

test("keeps compact reminder cards scannable and links to Google Calendar", async () => {
    const [sidebarSource, presentationSource, calendarSource, css, indexHtml] =
        await Promise.all([
            readFile(sidebarUrl, "utf8"),
            readFile(
                new URL("./reminderPresentation.js", import.meta.url),
                "utf8"
            ),
            readFile(new URL("./calendarRecovery.js", import.meta.url), "utf8"),
            readFile(cssUrl, "utf8"),
            readFile(indexHtmlUrl, "utf8"),
        ])

    assert.match(sidebarSource, /tomo-compact-reminder__icon/)
    assert.match(sidebarSource, /meta\.eyebrow/)
    assert.match(sidebarSource, /calendar_month/)
    assert.match(indexHtml, /(?:,|=)calendar_month(?:,|&)/)
    assert.match(indexHtml, /(?:,|=)receipt_long(?:,|&)/)
    assert.match(sidebarSource, /\{control\.label\}/)
    assert.match(calendarSource, /Add to Google Calendar/)
    assert.match(calendarSource, /Open Google Calendar event/)
    assert.match(calendarSource, /Open Google Calendar/)
    assert.match(sidebarSource, /tomo-calendar-footer--collapsed/)
    assert.match(sidebarSource, /tomo-calendar-footer--expanded/)
    assert.match(presentationSource, /At-home medication/)
    assert.match(presentationSource, /At-home injection/)
    assert.match(presentationSource, /Clinic care/)
    assert.match(presentationSource, /Insurance/)
    assert.match(css, /\.tomo-compact-reminder__summary/)
    assert.match(css, /--tomo-drawer-width: 360px/)
    assert.match(
        css,
        /\.tomo-compact-reminder\[open\][\s\S]*tomo-calendar-footer--collapsed/
    )
    assert.match(
        css,
        /\.tomo-compact-reminder:not\(\[open\]\)[\s\S]*tomo-calendar-footer--expanded/
    )
    assert.doesNotMatch(
        sidebarSource,
        /tomo-compact-reminder__title[^>]*truncate/
    )
})

test("presents inbox failures as actionable alerts instead of provider errors", async () => {
    const [dashboardSource, sidebarSource] = await Promise.all([
        readFile(dashboardUrl, "utf8"),
        readFile(sidebarUrl, "utf8"),
    ])

    assert.match(dashboardSource, /setError\(err\)/)
    assert.match(sidebarSource, /getInboxErrorPresentation/)
    assert.match(sidebarSource, /className="tomo-inbox-error" role="alert"/)
    assert.doesNotMatch(sidebarSource, /\{error\.message\}/)
})

test("shows an accessible inbox activity animation while Gmail is being checked", async () => {
    const [sidebarSource, css] = await Promise.all([
        readFile(sidebarUrl, "utf8"),
        readFile(cssUrl, "utf8"),
    ])

    assert.match(sidebarSource, /aria-busy=\{checking\}/)
    assert.match(sidebarSource, /Checking Gmail inbox/)
    assert.match(sidebarSource, /className="tomo-inbox-check__track"/)
    assert.match(sidebarSource, /className="tomo-inbox-check__dot"/)
    assert.match(sidebarSource, /role="status" aria-live="polite"/)
    assert.match(css, /@keyframes tomo-inbox-check-travel/)
    assert.match(css, /\.tomo-inbox-check--loading:disabled[\s\S]*opacity: 1/)
    assert.match(
        css,
        /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.tomo-inbox-check__dot/
    )
})

test("preserves a session transcript while Voice and Chat share one panel", async () => {
    const source = await readFile(assistantUrl, "utf8")

    assert.match(source, /CONVERSATION_MODES\.VOICE/)
    assert.match(source, /CONVERSATION_MODES\.CHAT/)
    assert.match(source, /Today · Session only/)
    assert.match(source, /appendConversationExchange/)
    assert.match(source, /<VoiceStage/)
    assert.match(source, /<SessionTranscript/)
    assert.match(source, /conversationContextRef\.current = null/)
})

test("keeps Chat readable, uses Tomo branding, and provides a calm multiline composer", async () => {
    const [source, css] = await Promise.all([
        readFile(assistantUrl, "utf8"),
        readFile(cssUrl, "utf8"),
    ])

    assert.match(source, /assets\/tomocare-logo\.png/)
    assert.doesNotMatch(source, /Tomo is here/)
    assert.match(
        source,
        /mode === CONVERSATION_MODES\.VOICE[\s\S]*<VoiceStage/
    )
    assert.equal(
        (source.match(/const SUGGESTED_QUESTIONS = \[[\s\S]*?\]/)?.[0].match(/"/g)
            ?.length || 0) / 2,
        3
    )
    assert.match(source, /<textarea[\s\S]*rows=\{3\}/)
    assert.match(source, /event\.key === "Enter"/)
    assert.match(source, /!event\.shiftKey/)
    const userTurnSource = source.match(
        /function UserTurn[\s\S]*?(?=\nfunction AssistantTurn)/
    )?.[0]

    assert.ok(userTurnSource)
    assert.match(userTurnSource, /\btext-base\b/)
    assert.match(userTurnSource, /\bleading-6\b/)
    assert.match(userTurnSource, /\btext-tomo-text-h\b/)
    assert.match(
        source,
        /tomo-answer-fresh mt-3 text-base leading-7 text-tomo-text-h/
    )
    assert.match(
        css,
        /\.tomo-chat-composer-box\s*\{[\s\S]*border-color: var\(--color-tomo-border\)/
    )
    assert.match(
        css,
        /\.tomo-chat-composer-box:focus-within\s*\{[\s\S]*border-color: rgba\(156, 163, 175, 0\.46\)/
    )
    assert.match(
        css,
        /\.tomo-chat-input\s*\{[\s\S]*text-base[\s\S]*min-height: 72px/
    )
    assert.match(
        css,
        /\.tomo-theme \.tomo-chat-input:focus-visible\s*\{[\s\S]*outline: none/
    )
})

test("gives Voice a centered avatar stage with transcript detail on demand", async () => {
    const [source, avatarSource, css] = await Promise.all([
        readFile(assistantUrl, "utf8"),
        readFile(avatarMediaUrl, "utf8"),
        readFile(cssUrl, "utf8"),
    ])

    assert.match(source, /assets\/tomo-voice-avatar-placeholder\.webp/)
    assert.match(source, /<RunwayAvatarMedia/)
    assert.match(avatarSource, /data-avatar-media=/)
    assert.match(avatarSource, /"runway-live"\s*:\s*"placeholder"/)
    assert.match(avatarSource, /Animate Tomo/)
    assert.match(avatarSource, /End live animation/)
    assert.match(source, /aria-label="Voice conversation with Tomo"/)
    assert.match(source, /aria-label="Full session transcript"/)
    assert.match(source, /aria-expanded=\{transcriptOpen\}/)
    assert.match(source, /aria-controls="tomo-voice-transcript"/)
    assert.match(source, /tomo-voice-stage__focus/)
    assert.match(source, /tomo-voice-stage--transcript-open/)
    assert.doesNotMatch(source, /VoiceCaptionLayer/)
    assert.doesNotMatch(source, /tomo-voice-captions/)
    assert.match(source, /tomo-voice-dock__primary/)
    assert.match(source, /tomo-voice-transcript-control/)
    assert.match(source, /Answers use verified records\. Changes still require approval\./)
    assert.match(css, /\.tomo-voice-stage\s*\{[\s\S]*grid-row: 2 \/ 4/)
    assert.match(css, /\.tomo-voice-stage__focus\s*\{[\s\S]*inset: 0/)
    assert.match(
        css,
        /\.tomo-voice-stage--transcript-open \.tomo-voice-stage__focus\s*\{[\s\S]*right: var\(--tomo-voice-transcript-width\)/
    )
    assert.match(css, /\.tomo-voice-transcript-sheet\s*\{[\s\S]*position: absolute/)
    assert.match(css, /\.tomo-voice-dock\s*\{[\s\S]*backdrop-filter: blur/)
    assert.match(css, /\.tomo-avatar-media__video\s*\{[\s\S]*object-fit: cover/)
})

test("uses a neutral eyebrow color for reminder categories", async () => {
    const css = await readFile(cssUrl, "utf8")
    const eyebrowRule = css.match(
        /\.tomo-compact-reminder__eyebrow\s*\{([\s\S]*?)\n\s*\}/
    )?.[1]

    assert.ok(eyebrowRule)
    assert.match(eyebrowRule, /text-tomo-text/)
    assert.doesNotMatch(eyebrowRule, /text-tomo-accent/)
})

test("uses the loaded sidebar reminder for status, date, and Calendar citations", async () => {
    const [dashboardSource, assistantSource, evidenceSource] = await Promise.all([
        readFile(dashboardUrl, "utf8"),
        readFile(assistantUrl, "utf8"),
        readFile(evidenceUrl, "utf8"),
    ])

    assert.match(dashboardSource, /<AssistantPanel[\s\S]*reminders=\{reminders\}/)
    assert.match(assistantSource, /new Map\(reminders\.map/)
    assert.match(assistantSource, /reminder=\{reminderById\.get\(citation\.id\)/)
    assert.match(evidenceSource, /getCompactReminderPresentation\(reminder\)/)
    assert.match(evidenceSource, /meta\.statusLabel/)
    assert.match(evidenceSource, /meta\.dateLabel/)
    assert.match(evidenceSource, /reminderMeta\.calendarUrl/)
    assert.match(evidenceSource, /calendar_month/)
})

test("uses the server-derived Profile age instead of browser-local calculation", async () => {
    const source = await readFile(sidebarUrl, "utf8")

    assert.match(source, /formatAgeValue\(profile\.age\)/)
    assert.match(source, /profile\.species/)
    assert.match(source, /profile\.reproductive_status/)
    assert.doesNotMatch(source, /American Eskimo · 11 years/)
})
