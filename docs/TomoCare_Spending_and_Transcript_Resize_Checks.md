# Spending follow-ups and transcript resizing

**Date:** September 19, 2026  
**Branch:** `final-voice-animation-ui-polish`  
**Status:** Accepted by Rosa on September 19, 2026: wider-screen resizing works beautifully; vague spending uses Needs details and clarification produces the correct total. The subsequently reported animation failure is tracked separately in [animation recovery checks](./TomoCare_Animation_Recovery_Checks.md).

## Findings and changes

Rosa’s manual check confirmed that praise and playful expressions are more varied, and that ending live animation successfully falls back to local speech. She also reported a spending failure and requested a draggable transcript boundary.

The spending implementation previously supported Librela totals only. “How much I spent on Momo’s medication this year” had no supported general medication scope, and a generic clarification lost the relevant scope/timeframe. The UI then incorrectly used its default “Grounded answer” badge for an unsupported response. This was a coverage and presentation gap, not evidence that character reactions changed the financial records.

- **Medication spending:** total only verified cost items explicitly categorized as `medication`, within the requested period. Visit fees and other categories are excluded. Medication-category credits and discounts count; discounts in other categories are not allocated to medication. The answer labels this as a verified-record subtotal, not proof of all actual spending. Currencies remain separate; unusable amounts/currencies do not become zero.
- **Spending clarification:** an unspecified spending request asks specifically about medication, direct Librela, or Librela visit costs. An unnamed medication is never silently treated as Librela. Other named medication-specific totals remain outside this bounded slice.
- **Follow-ups:** retain the spending scope and a validated date range across Chat JSON and Voice context headers. “Spending, please” retains the previous selection. An explicit new timeframe replaces the old one. No answer text, record values, or approval authority is carried in this context.
- **Badges:** unsupported responses say “Not supported yet”; missing records say “Missing verified data”; safety boundaries say “Care boundary.” Unrecognized answer types no longer default to a grounding claim.
- **Transcript divider:** hover over the boundary between Tomo and Conversation on a wider screen, then drag. A visible focus/hover line and resize cursor identify the handle. Arrow keys adjust the width; Shift+Arrow makes a larger adjustment; Home/End choose the limits; Enter or double-click resets it. Escape during a drag restores its starting width. The layout protects space for both Tomo and the transcript, remembers the preference during collapse/reopen and Voice/Chat switches, and adapts when available space changes. Full reload starts at the default width. Phones retain the stacked layout and have no divider.

These changes share the real-care and demo application paths. No database schema, extraction categories, care records, approval rules, avatar provider, or voice identity changed.

## Minimum manual checks

Start `npm run dev:demo`. A live avatar worker is not needed for these checks; ordinary Voice and Chat can exercise spending.

1. Ask the original medication-spending question, then say “Spending, please.” Both should give the same verified medication subtotal and timeframe. Open the sources to check what contributes. Try “What about last year?” to check the changed period; absent records must not become zero spending.
2. Ask a vague spending question in a fresh conversation. Expect a spending-specific clarification. An unsupported question must not display a green “Grounded answer” badge.
3. On a wide screen, drag the line between Tomo and Conversation in both directions. Neither side should collapse. Hide/reopen the transcript and switch Voice → Chat → Voice; the selected width should remain. Tab to the divider and try Arrow keys and Enter.

No demo reset, inbox processing, or record verification is needed. If using live animation for other checks, run `npm run dev:demo:avatar` in a separate terminal as usual.

## Validation

- **375 tests passed** across assistant, voice, dashboard, and avatar suites. Added cases cover the exact question/follow-up, targeted clarification, period preservation, verified/category/date filtering, credits, separate currencies, invalid values, sanitized context, unchanged Librela scopes, truthful badges, and width/keyboard bounds.
- In the running isolated demo, the exact question returned **USD 141.50 across two verified medication line items**, with two sources and explicit scope limits. “Spending, please” returned the same year-to-date subtotal. This value is specific to the demo’s existing records, not a real-care amount.
- Browser checks: pointer dragging changed a transcript from 444px to 562px at an 888px stage; limits preserved a 280px avatar panel. Keyboard adjustments worked. Collapse/reopen and Voice/Chat switching retained the selected width. At 390px, the divider was hidden, the layout stacked, and no horizontal document overflow occurred.
- Lint, production build, and whitespace checks passed. The existing LiveKit bundle-size warning remains.
- No microphone recording or new Runway session was needed. Browser spending checks used Chat against the demo service. Voice follows the shared assistant; context serialization round-trip and sanitization have automated coverage. Subjective speech review remains Rosa’s checkpoint.

## Deferred continuity enhancement

Rosa noticed a slight perceived voice change when live animation hands off to local speech, similar to the posture difference between local clips and live Runway imagery. She confirmed fallback works and is not blocked by this difference. Track this as future production polish: compare perceived timbre, loudness, pacing, and pose at handoff, then choose improvements from a bounded listening/visual comparison. Do not assume the cause is a different configured voice; this report is a perceptual observation. No voice/provider changes are included here.
