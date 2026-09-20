# TomoCare — Consolidated polish register

**Prepared:** September 13, 2026  
**Updated:** September 19, 2026
**Status:** Rosa accepted feedback coverage and the four tracks: Layout, Voice, Journey, Animation. Layout checkpoint A is accepted as of September 19, including both compact-sidebar icon-alignment refinements. Rosa approved the first character direction; broader voice choices, additional reactions, later estimates, and provider acceptance remain separate checkpoints.
**Baseline:** Accepted setup/inbox isolation merge `5c57733`, on `final-voice-animation-ui-polish`.  
**Current activity:** Rosa accepted transcript resizing and spending clarification/totals. Rosa also accepted P10 animation recovery: at the real five-minute limit, local Voice took over seamlessly and the care conversation continued. This recovery slice is complete. See [animation recovery](./TomoCare_Animation_Recovery_Checks.md) and [model lifecycle review](./TomoCare_Model_Lifecycle.md).

## Current finish-line view — September 19

This status summary supersedes older discovery/proposal wording below; those sections preserve how feedback was found and resolved.

- **Accepted:** layout A1–A3 and sidebar alignment; transcript resizing; spending clarification and totals; first praise/playfulness character improvements; improved live/local transitions; real five-minute expiry with seamless local Voice continuation. Broader expressive range and exact voice/posture matching are later product refinement.
- **Added at Rosa’s request:** two preloaded May/July 2026 Librela visits with medication costs and weights, without additional PDFs. Implemented, seeded, and accepted by Rosa on September 19, 2026 after manual testing of the three-point weight trend and varied spending questions. P20 is complete. This is bounded Journey data enrichment (P20), not a new care capability. See [history and checks](./TomoCare_Demo_History_Seed.md).
- **Next: integrated Journey acceptance (P05/P16), with remaining scoped P03/P04/P06/P11/P12/P13 audits.** Rehearse the three existing stories on the final implementation: source → correction/recheck → explicit verification → trusted evidence → reminders/October Attention → editable review-only draft. Include a verified answer, a missing-evidence answer, and an action waiting for review. Check supported-window usability, keyboard/zoom/Reduced Motion, PDF access, and recovery copy. Passing audits close without new code; newly observed blockers get bounded fixes.
- **Then: evidence and portfolio freeze.** Capture the accepted live path, screenshots and a recorded provider fallback; update case-study claims; finish regression/lint/build and release review; merge/tag the accepted checkpoint. These are later actions, not completed or initiated by this planning update.
- **Deferred by Rosa:** extraction-model comparison/migration. Other later work includes extra expressions, durable relationship memory, exact live/local voice/posture matching, new care capabilities and production/platform expansion.
- **Planning allowance:** 1–2 focused work sessions for integrated rehearsal and minor repairs; 2–3 more for capture, case-study updates and release closeout. This is an estimate assuming the existing scope and no major new defect, not a calendar commitment. A new portfolio site or full case-study rewrite would need separate sizing.

## Integrated Journey review — September 19

The [Journey checkpoint and three minimum checks](./TomoCare_Journey_Checkpoint.md) record a fresh review of the current demo plus isolated correction/dialog fixtures. 721 regression tests, focused lint and production build passed. Repairs clarify October scope, improve P11 inbox recovery, and hide unavailable demo Calendar controls. A stale test was aligned with the existing explicit-verification boundary.

P05/P16 remain pending Rosa’s combined manual acceptance and fresh-source replay. The current demo has only the Librela reminder; the insurance reminder is created during the documented fresh-source path. P03/P04/P06/P12/P13 have bounded review evidence, not blanket accessibility or audio certification. No care records were reset or changed. P20 history acceptance remains closed.

## Purpose and evidence

Keep the remaining polish work, previously accepted feedback, and new suggestions in one place. Preserve the original product concerns without treating every historical issue as an unresolved bug.

This register consolidates the current handover, earlier closeout documents, and the recent conversations reviewed for this task. It is not a claim that every historical conversation or screenshot has been audited. Rosa reviewed the consolidated register and confirmed that it accurately captures her feedback; she may add nuance as individual items are resolved.

Evidence types used below:

- **Observed:** visible in this task's earlier app inspection; not a claim about every screen size.
- **Recorded limitation:** explicitly left open in a repository document.
- **Audit:** an acceptance requirement to check; a current defect has not been established. If it already passes, close it with no implementation.
- **Investigation:** a reported symptom whose cause or current reproduction is not established.
- **Fresh recommendation:** a new proposal from Codex, not previously requested or approved by Rosa.
- **Accepted:** previous documents and/or Rosa's messages record a fix and acceptance. Preserve it during regression checks.

Source keys link to the [source index](#source-index). A historical limitation needs a fresh check before a fix is sized as committed work.

## Priority and size conventions

These priorities are recommendations for review:

- **P1 — Before portfolio acceptance:** a comprehension, usability, continuity, accessibility, or reliability requirement. An audit may satisfy it without code changes.
- **P2 — Improve within polish:** visible quality improvement after the essential path works.
- **P3 — Optional:** explicitly cut if it threatens the finish line.

Relative effort includes focused implementation and validation, not elapsed calendar time:

- **S:** one local component, copy change, or bounded investigation.
- **M:** a few connected components/states plus focused regression checks.
- **L:** several interacting lifecycle or layout concerns; split before implementation.
- **Unknown:** investigation required before a credible fix estimate.

For audit rows, the size is the review effort; any newly discovered repair must be separately sized. Do not sum this table into a delivery estimate: several rows share a single rehearsal or the same component. Provider availability and Rosa's review time are separate dependencies.

## Open work and proposed additions

| ID | Item and reason | Evidence/status | Suggested priority | Rough size | Acceptance check |
| --- | --- | --- | --- | --- | --- |
| P01 | **Balance the care drawer, Tomo stage, and transcript at medium widths.** The 1280 × 720 view inspected in this task squeezed Tomo into a narrow strip and crowded the status/animation controls. Keep the transcript open by default. | Observed in this task; fresh recommendation. Current layout uses a 190px navigation, 360px drawer, and transcript up to 520px wide. [S1, S8] | P1 | M | With care details and transcript open at the agreed laptop widths, speech and animation controls remain readable and reachable, the evidence remains useful, and panels do not overlap. Any adaptive layout preserves the user's explicit collapse/open choice. |
| P02 | **Check short windows, narrow screens, drawers, and dialogs.** Avoid clipped primary actions, hidden close controls, horizontal overflow, and trapped scrolling. | Audit; not a confirmed defect on every surface. The current home grid has a minimum height, so short windows deserve explicit coverage. [S1, S8] | P1 | M audit | Complete the invoice and appointment-draft dialogs at the agreed narrow and short sizes; reach each action and close control without losing entered text or becoming trapped in a scroll region. |
| P03 | **Make Voice state and control changes understandable.** Review idle, listening, thinking, speaking, stop, replay, mute, and completion. | Audit of the existing Voice experience. [S1] | P1 | M audit | A short spoken turn visibly passes through the appropriate states; stop, replay, and mute have predictable effects; completion returns to a clear ready state without duplicate playback. |
| P04 | **Preserve transcript and evidence continuity.** Charts, citations, Attention cards, and the same conversation must remain usable across Voice/Chat and panel changes. | Audit; default-open transcript and chart refinements are already accepted. [S1, S4, S5] | P1 | S audit | Ask for the weight trend, select a point, switch Voice/Chat, and collapse/reopen the transcript. The same conversation and evidence remain available, with readable controls and no duplicate turns. Do not create durable conversation storage. |
| P05 | **Rehearse the entire correction-to-follow-through sequence.** Each step should communicate what happened and what comes next. | Audit of accepted verification, confirmation, reminders, Attention, and review-only draft behavior. [S1, S2] | P1 | M audit | Correct the invoice, recheck, explicitly verify, see confirmation before optional actions, create the existing reminders, inspect October Attention, and prepare/edit/copy the draft. Candidate, verified, reminder-created, and review-only states remain distinct. |
| P06 | **Keyboard and accessibility pass on the demo path.** Review focus order/return, labels, status announcements, contrast, zoom, and Reduced Motion. | Audit; no blanket accessibility defect claim. [S1] | P1 | M audit | Complete the principal controls and dialogs by keyboard; focus remains visible and returns sensibly after closing; status announcements are useful without repetition; 200% zoom and Reduced Motion retain usable controls and evidence. |
| P07 | **Resolve uncertainty about demo live-animation startup.** Rosa reported that animation could not start while local Voice worked. A later private-care worker connection is not proof of demo end-to-end animation. | Investigation; fallback acceptance is recorded, but a root-cause resolution is not. `dev:demo` does not launch the optional worker. That is a hypothesis to check, not a proven explanation for the earlier failure. [S2, S7, C1] | P1 investigation; fix priority depends on whether live animation is required for the chosen presentation | S investigation; fix Unknown | Establish the intended demo configuration and worker requirements, attempt one bounded explicit start, and record the outcome without exposing secrets. Either validate start/speak/end, or make an explicit product decision to use the complete local presentation for portfolio v1. No automatic reconnect or new provider. |
| P08 | **Refine local-to-live and live-to-local visual continuity.** Local clips and Runway use different poses; the posture change is a recorded limitation. | Recorded limitation, reinforced by Rosa’s September 19 report of abrupt idle-to-Runway and end-of-conversation transitions. The cause and exact end-state path need fresh reproduction. [S3] | P2; conditional on live animation being included | M provisional | In an explicit live session, start, speak, finish, and end without double faces, an unnecessary cover flash, or controls jumping. Improve the transition with the existing character and media; do not promise perfect pose matching or create a new avatar. |
| P09 | **Protect the improved local motion sequence.** Earlier loop resets, purple flickers, and face overlaps were already improved and accepted. | Regression audit, not a request to rebuild local motion. [S3, S6] | P2 | S audit | Idle → acknowledgment → listening → thinking follows the intended sequence without unnecessary restarts; held frames are stable; Reduced Motion uses the still path. Close with no change if it passes. |
| P10 | **Validate animation failure, expiry, and retry presentation.** Distinguish an intentional end from a failure and preserve local audio exactly once. | Regression audit of shipped reliability work. [S1, S6] | P1 for fallback behavior; live-specific rehearsal conditional on P07 | S–M audit | Exercise start/end and one controlled transient failure or existing test fixture. One clear user-driven recovery is available; the existing answer continues once locally, without replay, resynthesis, or automatic retry. Do not disrupt the provider solely to generate a failure. |
| P11 | **Make inbox recovery language more useful.** The missing PDF dependency produced a message mentioning OCR, and the UI exposed `populate_raw_text` as a processing stage. | Fresh recommendation grounded in this task's failure screenshot and current copy. The dependency defect itself is closed. [S7, S9] | P2 | S | Recovery explains what was saved, what has not happened, and the next useful action. It does not imply that an unreadable scan is the confirmed cause of a general processing failure. Keep technical detail secondary and preserve diagnostic access. |
| P12 | **Unify presentation details along the accepted path.** Dates, spacing, button sizing, visual hierarchy, and icons should read consistently. | Audit from the handover; fresh suggestion to prefer unambiguous displayed dates such as “Sep 7, 2026,” subject to Rosa's choice. [S1] | P2 | M audit; individual fixes S–M | Apply the agreed display convention across the rehearsed surfaces; no ambiguous or contradictory dates, raw icon names, truncated field titles, or avoidable button-label wrapping. Preserve underlying dates, units, source values, and calculations. |
| P13 | **Reduce repeated status messaging.** The inspected Voice view showed readiness in several places while the stage was crowded. | Fresh recommendation; visual hierarchy concern, not a proven contradiction between states. [S8] | P2 | S | One primary Voice state and any separate animation state are easy to distinguish. Remove redundant visible copy only where it improves clarity; retain accessible announcements and necessary recovery text. Coordinate with P01/P03 rather than adding a second state system. |
| P14 | **Design Tomo's expressive vocabulary and select reactions.** Review existing happy, laughing, oops, acknowledgment, and attentive assets against actual conversational contexts. Expression is part of the core experience; each additional reaction needs a justified role. | Product direction clarified September 14 and September 19: Rosa reports repetitive idle/thinking presentation and missing contextual responses to playfulness, jokes, gratitude, excitement, and praise. The first pleased/amused reactions and concern-first restraint are approved and implemented in B2; additional expressions remain proposals. [S1, S3] | P1 expression design; implementation priority set per selected reaction | S design review; M–L implementation if selected, split by reaction | Rosa reviews an explicit situation → voice tone → expression → visual aid map. Selected cues fit the meaning, never suggest unsupported reassurance or action success, preserve speech, and respect Reduced Motion. Use existing assets first; record gaps before commissioning new ones. |
| P15 | **Review voice identity and delivery as a product choice.** Evaluate warmth, maturity/playfulness, pace, pauses, pronunciation of names/numbers, and how uncertainty sounds. Existing code already distinguishes warm and restrained delivery; its perceived quality needs listening acceptance. | Explicit September 14 direction, expanded September 19 to include personally appropriate delivery for playful, thankful, excited, and praising exchanges. Acceptance review, not a claim that tone support is missing. [S10] | P1 | M provisional, including a bounded listening comparison | Compare the same grounded lines across a small set of voice/delivery options. Rosa accepts a consistent Tomo voice for a greeting, verified summary, missing evidence, correction, and prepared-for-review response. Words and figures remain unchanged; delivery and expression do not imply greater certainty than the evidence. |
| P16 | **Make speech, expression, and visual evidence agree.** Treat one turn as one experience across all four tracks. Check when evidence appears, where attention goes, and whether tone/motion match the answer and actual action state. | Explicit September 14 and September 19 direction; cross-track acceptance includes socially appropriate wording, tone, and expression together, alongside grounded care answers. | P1 | S scenario specification; M integrated review, repairs sized after observation | Rehearse the agreed situations in Voice and Chat: charts/cards are available when referenced; numbers/units match; animation does not distract from review or signal success early; stop/end/fallback preserve one intelligible answer. Missing information is expressed clearly in words, voice, and motion. |

## Manual feedback follow-up — September 19

Rosa’s screenshots, manual observations, and follow-up request add the tracked items below. These supplement the existing four tracks.

| ID | Feedback | Track / priority | Status and acceptance |
| --- | --- | --- | --- |
| P17 | General medication spending failed; “Spending, please” did not recover; unsupported answer claimed grounding. | Journey / P1 | Implemented verified medication-category totals, bounded spending follow-ups and honest badges. Exact exchange checked against demo records. Accepted by Rosa on September 19, 2026. |
| P18 | Perceived voice and posture change at live/local handoff breaks continuity slightly. | Voice + Animation / P2 future | Record as production enhancement; fallback function was successful and Rosa is not blocked. Investigate perceptual continuity before changing a voice or provider. |
| P19 | Drag the transcript boundary to expand or contract Conversation. | Layout / P1 requested | Implemented pointer and keyboard resizing, panel limits, session preference across mode/collapse changes, and unchanged mobile stacking. Accepted by Rosa on September 19, 2026. |
| P20 | Enrich spending and weight answers with two preprocessed May/July Librela visits; no new PDFs. | Journey / P1 requested; S | Implemented and seeded in the isolated demo; existing September invoice and reminders preserved. Browser checks confirm three weights, medication totals and readable source records. Accepted by Rosa on September 19, 2026: three plotted weights and varied spending questions worked well for the demo. Complete; see [minimum checks](./TomoCare_Demo_History_Seed.md). |

P14–P16 update: Rosa observed more varied, better praise and playful reactions. P10 update: following the recovery fixes, Rosa confirmed seamless local Voice continuation at the actual five-minute limit and accepted this slice on September 19, 2026. These observations are acceptance evidence for those paths, not blanket closure of every expression or provider-quality item. See [the delivery and three minimum checks](./TomoCare_Spending_and_Transcript_Resize_Checks.md).

## Layout discovery update — September 14

Rosa authorized proceeding with the Layout audit and concrete proposal. The [checkpoint report](./TomoCare_Layout_Checkpoint_A.md) records eight findings, passing observations, coverage limits, proposed responsive arrangements, and bounded implementation slices. No application code was changed during discovery.

- **P01/P13:** L01 confirms severe panel competition and covered controls; L03 confirms transcript coverage of the microphone on phones.
- **P02:** L02 confirms displaced/translucent mobile care details; L05 confirms short-window overflow; L07 records the compressed narrow verification workspace. L08 confirms next-step modal clipping in a shipped-component fixture.
- **P04:** The same turn/evidence survived mode changes, but kg reset to lb (L06). Multi-point selection still needs a fixture; do not mark the whole continuity audit passed.
- **P06:** L04 confirms missing accessible names after responsive label hiding; L08 confirms missing modal focus containment and Escape in the fixture. Full assistive-technology, zoom, contrast, and Reduced Motion checks remain pending.
- The blank embedded PDF observed in the in-app browser is an unresolved viewer observation. It is not evidence of a new intake failure or a reason to reopen the accepted isolation checkpoint.

The eight L-identifiers are sub-findings mapped to existing P-items, not eight new top-level work streams. The proposed arrangement is ready for Rosa's product review before A1 implementation.

## Layout implementation update — September 19

Rosa approved the proposal and A1–A3 are implemented on `final-voice-animation-ui-polish`. See the [delivery evidence and minimum manual checks](./TomoCare_Layout_A_Manual_Checks.md). L01–L08 have implementation coverage. Rosa completed manual checks and accepted the enhancements, then confirmed both the compact-menu and footer shield alignment refinements. Layout checkpoint A is accepted on September 19; the documented validation limits remain.

- **A1 / P01, P02, P03, P06, P13:** balanced home panels, compact care overlays, reachable microphone/transcript controls, stable accessible names, and fewer overlapping status elements.
- **A2 / P04:** session-scoped chart units and selection survive mode changes and transcript remounting. This does not add stored conversation history.
- **A3 / P02, P06, P12:** responsive verification workspace, collapsible queue, larger-screen guidance, Open PDF fallback, correction-label sizing, and shared modal focus/Escape/scroll behavior.
- The broad P-items are not closed wholesale: voice delivery, animation, full accessibility/browser acceptance, and later journey polish still have their own checkpoints. No voice/provider selection or care approval rules changed.

## Voice and character feedback — September 19

**Rosa’s report:** Overall quality is good. Transitions from the local idle presentation into live Runway animation and at conversation completion still feel abrupt. Tomo also feels repetitive and robotic when Rosa jokes, is playful, thanks or praises her, or expresses excitement about her help. Rosa wants a character built for her, responsive to her conversational style rather than generic bot replies. This feedback is recorded now even where implementation falls outside the next technical slice.

This refines **P08, P14, P15, and P16**, rather than opening duplicate work items. The reported symptoms are user evidence; a new technical reproduction has not yet established their causes. Do not assume turn completion, stopping speech, and ending the live session use the same transition path. Preserve the accepted local-motion repairs in P09.

### Proposed next checkpoint

1. **Transition quality (P08/P09/P10):** inspect local idle → first usable live frame, normal speech completion while live remains connected, explicit live-session end → local idle, and interruption/fallback separately. Identify framing, pose, cut timing, or lifecycle causes before choosing a repair. Acceptance includes a visually settled return, no double face/flash, and uninterrupted or correctly stopped audio as appropriate. Technical connection success alone does not pass perceived-quality acceptance.
2. **Conversational character (P14/P15/P16):** review short exchanges that pair response wording, voice delivery, and a purposeful expression. Selecting a different animation alone will not satisfy this feedback if the response remains generic. Use the current exchange and recent conversational context; review any longer-term preference storage as a separate design choice.

| Rosa’s conversational cue | Proposed behavior to review, not a committed script or animation |
| --- | --- |
| Thanks for specific help | A brief acknowledgment tied to what Tomo helped with; warm delivery and a small appreciative reaction. Avoid repeating a stock service phrase. |
| Praise or excitement about the help | Share the upbeat tone proportionately, with a pleased reaction; return naturally to attentive readiness. |
| Clear playful teasing or a joke | A light, context-appropriate reply and playful reaction when the meaning is clear. Avoid triggering laughter from isolated keywords or forcing a joke when unsure. |
| Gratitude combined with worry about Momo | Acknowledge the thanks gently and stay attentive to the concern; cheerful wording alone must not select a celebration. |
| Repeated thanks within one conversation | Keep responses brief and natural, with contextual variation rather than repeating the same line and animation. |
| An uncertain care answer or an action awaiting approval | Preserve the known facts, expressed uncertainty, and actual action state. Warmth and familiarity remain compatible with those boundaries. |

**Scope recommendation:** Carry transition quality into the upcoming technical investigation, and bring gratitude and clear playfulness as the first two character examples to the Voice/Animation design review. Broader expressive behavior stays visible in P14–P16 until reviewed; it is not silently deferred as optional decoration. No automatic inference of emotional state, new assets, new provider, or exact reaction trigger set is approved by this feedback record. Rosa should judge whether the complete exchange feels personal and responsive, not just whether the clip changes.

## Voice/Animation implementation checkpoint — September 19

Rosa approved the three-checkpoint plan: transitions, first character behaviors after reviewing examples, then integrated acceptance. The [B checkpoint handoff](./TomoCare_Voice_Animation_Checkpoint_B.md) records implementation, evidence, limits, and three minimum manual checks.

- **P08 / B1:** frame-preserving soft-focus handoffs replace the solid-color cover; normal completion gets a short settling interval; ending, expiry, and disconnect preserve a visual frame while releasing provider resources immediately. Rosa subsequently reported improved transitions and accepted seamless expiry recovery. The underlying pose mismatch remains deferred production polish.
- **P07:** one bounded real demo session reached ready, completed one sample, began another, and accepted Stop/End with the matching worker running. This establishes a currently working configuration, not the historical failure’s root cause.
- **P09/P10:** cancellation, readiness, expiry, failure, and Reduced Motion checks pass with the existing local sequence and audio fallback retained. Provider-wide reliability and subjective lip-sync quality are not blanket claims.
- **P14/P15/P16 / B2:** [three listening examples and candidate clips](./TomoCare_Character_Review.html) were approved by Rosa and subsequently connected in B2. Rosa reported improved praise/playfulness; complete care-journey integration is the remaining checkpoint.

## Previously reported feedback — preserve as accepted behavior

These items remain visible for traceability. They are not added to the new implementation estimate. Reopen only when a fresh reproduction or Rosa's notes identifies a remaining gap.

| ID | Rosa's feedback or prior observation | Recorded outcome | Evidence |
| --- | --- | --- | --- |
| C01 | The highlighted invoice card looked clickable but did not open editing; the “check” badge was misleading as an apparent action. | The card's actionable content opens focused field correction. The current implementation uses an edit button inside the card, not literally every pixel of the container. Check that distinction if Rosa still finds the hit area unintuitive. | S2, C1; `WorkingPanel.jsx` |
| C02 | The invoice-number input was difficult to find after selecting Edit. | Focused correction makes the relevant field explicit. | S2, C1 |
| C03 | “Save and approve” combined correction with the approval decision. | “Save correction & recheck” is separate from “Verify and add to care record.” | S2, C1 |
| C04 | The next-action modal appeared before a reassuring confirmation. | Confirmation appears before optional next actions. | S2, C1 |
| C05 | “Invoice number” was cut off; “Correct” and “Keep as shown” were redundant; use hover/pointer cues and avoid wrapped button labels. | The card was refined and Rosa accepted it. “Keep as shown,” full field labels, and hover/pointer treatment are present. The closeout summarizes the interaction but does not repeat every visual request verbatim. | S2, C1; `WorkingPanel.jsx` |
| C06 | “Open verification record” was squashed in both narrow Voice and Chat layouts. | The action has its own row. | S4, C2 |
| C07 | Gold, white, and purple chart dots were hard to interpret. | A direct key explains verified/selected states; high and low values use labeled summaries rather than an unexplained third color. | S4, C2 |
| C08 | A selected chart point changed nearby text too subtly. | A highlighted detail panel and selection treatment make the update clearer. | S4, C2 |
| C09 | Lb should be prominent for Rosa, with a way to choose kg. | Lb is the initial display and a visible lb/kg selector is available; kg calculations remain canonical. | S4, C2 |
| C10 | Spoken weight-trend answers ended too abruptly and omitted useful numbers. | A concise but meaningful spoken summary was implemented and accepted. | S4, C2 |
| C11 | Add the microchip number and make Profile information easier to digest. | Microchip detail and direct questions are supported; Profile details are separated from Care overview. | S5, C2, C3 |
| C12 | Open the Voice transcript by default because links and graphs are frequently useful. | It opens by default and can be collapsed/reopened; the mounted session preserves the explicit choice. This preference remains a constraint on P01. | S5, C3 |
| C13 | Asking what needs attention in October omitted the Librela reminder. | Named-month Attention was fixed and manually accepted. | S1, C4 |
| C14 | The appointment draft displayed the literal Material Symbol name. | The missing visibility icon was loaded and accepted. | S1, C4 |
| C15 | A transition recording showed loop resets, purple flickers, and overlapping faces. | The pose-matched local sequence was simplified and accepted. A separate local/live posture limitation remains P08. | S3 |
| C16 | Start/end animation messaging and continuing local Voice needed to be reliable. | The reliability slice was accepted; a later demo startup failure also showed an honest local-Voice fallback. This closes fallback feedback, not the unresolved cause in P07. | S2, S6, C5 |
| C17 | The new laptop encountered the demo invoice in private care, could not read the PDF, and switching servers was confusing. | Dependency setup, source isolation, environment labels, read-only setup checks, and launcher conflict handling were accepted and merged. The private-care inbox exclusion was manually confirmed. | S7; current task |

## Recorded work outside this polish scope

| Item | Treatment |
| --- | --- |
| Portfolio screenshots/video, case-study updates, recorded provider fallback, release tagging | The following evidence/freeze checkpoint, not deliverables in this planning pass. A later verification screenshot does not mean portfolio capture has started. |
| Broader Runway cost and latency benchmarking | Comprehensive benchmarking remains later work. A bounded timing, reliability, and usage observation belongs in the Animation provider acceptance check; prior timing was one sample, not a service-level claim. Set the test budget and acceptable experience before that exercise. |
| Broader Inbox/Recently verified assistant coverage, appointment aggregation, Calendar navigation, preventive/lab intelligence, or new care actions | Separate product capability slices after the portfolio checkpoint unless Rosa reprioritizes them. |
| Durable conversation history, production hosting, authentication, multi-user support | Separate product/platform work. |
| Deleting the old unprocessed synthetic copy from private care | Separate optional cleanup decision. The isolation checkpoint is accepted and stays closed. No cleanup is part of this register. |

## Product direction and four-track plan

**Accepted direction:** Accuracy, calibrated confidence, and a thoughtfully crafted multimodal character experience are core TomoCare value. Voice, tone, animation, charts, and cards must support the same meaning. Warmth should make trustworthy information easier to understand; it must not imply that missing information is known or that an unapproved action has happened.

The September 14 clarification supersedes the earlier blanket recommendation to defer expressive work. Individual extra reactions remain scope choices, but voice identity, appropriate expression, and coherent transitions are acceptance requirements.

| Track | Main scope | Register mapping | Product checkpoint |
| --- | --- | --- | --- |
| **Layout — first** | Panel balance, evidence access, responsive behavior, dialogs/scrolling, clear controls, keyboard/zoom, visual hierarchy. | P01/P02/P04/P06/P12; coordinate P13 | Review a concrete adaptive layout proposal, then accept a focused implementation at agreed sizes. Preserve transcript-open default and the user's panel choices. |
| **Voice** | Voice identity and tone, pacing and pronunciation, state clarity, stop/replay/mute, continuity with visible evidence. | P03/P13/P15; shared P04/P16 | Listen to a small set of identical grounded scripts before choosing delivery changes; accept one complete spoken exchange after implementation. |
| **Journey** | Discoverable next steps, correction versus approval, confirmation, reminders, Attention, drafts, and useful recovery language. | P05/P11/P12; shared P16 | Rehearse the complete isolated-demo journey; confirm both actual record state and the user's understanding at each step. |
| **Animation** | Character expression, speech synchronization, local/live transitions, startup/end/fallback, and a bounded provider evaluation. | P07/P08/P09/P10/P14; shared P16 | Accept the character in actual conversational situations, including uncertainty and interruption, and explicitly decide whether Runway meets the intended experience. |

### Proposed delivery sequence

1. **Define the shared experience now.** Prepare a short situation → words/evidence → voice tone → expression map for greeting, verified summary, missing evidence, correction, and a draft ready for review. This informs all tracks before individual reaction code or new media work.
2. **Layout discovery and design checkpoint.** Inventory the existing screens and inspect the known crowded laptop layout. Propose panel behavior at 1440 × 900, 1280 × 720, 1024 × 768, and a narrow 390 × 844 CSS viewport; distinguish core supported sizes from graceful narrow-screen behavior. Include short-window and 200% zoom checks. Show the recommended arrangement and concrete tradeoffs before implementing a product layout change.
3. **Layout implementation checkpoint.** Deliver one bounded slice: first panel balance and evidence access, then any distinct dialog/accessibility repairs. Check click affordances, action visibility, keyboard focus/return, Escape where appropriate, scroll containment, labels, loading/empty/error/success feedback, and preservation of entered data. Record each audit as pass or a reproducible issue; do not label every audit a defect. Size concrete repairs after discovery.
4. **Voice and Animation design review together.** Audition the voice and review expression timing with the same scenarios. Investigate P07 early in this checkpoint, before relying on live output. Then implement Voice changes and selected Animation improvements in separately reviewable slices. A model/provider change requires evidence of a specific experience gap.
5. **Journey and integrated acceptance.** Rehearse correction through follow-through with the polished layout and chosen delivery; resolve journey/recovery gaps. Check P16 across the same scenarios rather than accepting each track only in isolation. Portfolio capture follows this acceptance.

Accessibility and governed data/action boundaries apply throughout. These are four ownership tracks, not four isolated waterfall phases; journey checks accompany each implementation. No total delivery estimate is committed before discovery separates passing audits from concrete repairs.

### Current Runway assessment — September 14

The installed LiveKit Runway plugin requests **`gwm1_avatars`**. TomoCare's worker forwards already-prepared speech and is instructed not to converse, reason, or call tools. Voice synthesis is separate: the current source defaults are `gpt-4o-mini-tts-2025-12-15` and `marin`, with environment overrides available. These are source defaults, not a claim that every launch uses them. Existing speech instructions already distinguish warm/lightly playful from calm/restrained delivery. [S10]

Runway's current documentation supports stylized characters and an external audio-in/video-out integration; the connected agent's speech supersedes Runway's own character voice/personality settings. This makes it a reasonable candidate for Tomo's speaking animation. Documentation does not establish that our particular dog avatar has acceptable identity stability, lip movement, exact expressive control, or response timing. [W1, W2, W3]

**Recommendation:** Retain the existing integration for a bounded evaluation while keeping local motion available. Evaluate character likeness, mouth/voice synchronization, waiting time, appropriate expression, interruption/end behavior, transitions, and fallback with the chosen voice. Record observed time and usage without presenting one sample as a guarantee. Runway documents a maximum five-minute session, so session-end UX is part of fit. Use authored local motion where deliberate reactions are needed, subject to a coherent transition design; do not assume the current live API can precisely trigger every reaction. Compare another provider only if this evaluation identifies a meaningful unmet need. No provider session or paid evaluation was started for this planning update.

## Minimum manual checks proposed for later implementation checkpoints

These are future acceptance guides, not instructions to restart the app now. Each delivery should narrow this list to what actually changed and identify any step that writes demo data. Use the isolated demo for write-producing rehearsals; the exact reset remains an explicitly scheduled preparation step.

| Checkpoint | Minimum checks Rosa would receive |
| --- | --- |
| A — Layout | 1. Open care details and the transcript at the agreed laptop width. 2. Inspect a chart and invoice dialog at the agreed narrow/short size. 3. Reach the main actions and close/reopen panels by keyboard. Expect readable evidence, usable controls, and sensible focus. |
| B — Voice | 1. Listen to the agreed verified-information and missing-evidence examples: tone, pacing, pronunciation, and certainty should fit. 2. Ask a short question, then exercise the changed stop/replay/mute control. 3. Switch Voice/Chat and reopen the transcript. Expect one answer, no duplicate audio, and the same evidence. |
| C — Journey | After planned demo preparation: 1. Correct/recheck the invoice; verify that saving alone does not approve it. 2. Explicitly verify and see confirmation before next actions. 3. Create the existing reminders and inspect October Attention and the editable review-only draft. These steps intentionally write demo records. |
| D — Animation | 1. Watch the agreed ordinary and uncertainty examples: likeness, expression, lip timing, and evidence should agree with speech. 2. Start/end live animation if included, and confirm local Voice continues once. 3. Review one controlled failure/fallback supplied by Codex. Expect truthful status, appropriate reactions, and one recovery choice without duplicate speech. Any paid provider exercise is bounded in advance. |

Codex owns focused automated regression checks, lint/build where relevant, and an explicit report of unverified behavior. Rosa owns product acceptance and can explore beyond the minimum. At handoff, state who owns the running server and its active environment.

## Decisions and gaps for Rosa's review

- **Feedback coverage accepted:** add nuance to the existing ID as we work; add a new ID only for a distinct concern.
- **Presentation sizes:** proposed starting checks are 1440 × 900, 1280 × 720, 1024 × 768, and 390 × 844 CSS pixels, plus a short-window and zoom check. These are proposed coverage points, not a promise of full support at every size.
- **Narrow-layout preference — accepted:** transcript remains open by default; compact care details use a fitted overlay, and phones stack Tomo above evidence with separate speech controls. Verification encourages a larger screen for careful PDF comparison.
- **Live animation:** decide its presentation role after the bounded quality evaluation. The complete local experience remains necessary for recovery; the quality of expression and voice is required whichever presentation is selected.
- **Display conventions:** decide whether date wording should become unambiguous month-name text; preserve the accepted lb/kg choice.
- **Voice and character:** the B2 gratitude, playful-praise, and concerned-response direction is approved. Happy/laughing clips now have bounded one-shot roles; Rosa reported better in-app praise/playfulness. Broader nuance remains available for later refinement. Oops and additional expressions remain proposals.

Future updates should retain stable IDs and record: status, agreed priority, observed reproduction, accepted behavior, implementation/PR link, and Rosa's acceptance result. Fresh suggestions remain marked as proposals until accepted. Closed feedback stays in the register to prevent repeated rediscovery.

## Source index

Repository sources are the durable record; conversation links preserve the origin of specific feedback. Historical closeouts establish prior acceptance, not a fresh test result today.

- **S1:** [Current final-polish handover](./Governed_Follow_Through_Closeout_and_Final_Polish_Handover.md), particularly the target experience, acceptance criteria, and governed-follow-through defect closeout.
- **S2:** [Synthetic Gmail and verification closeout](./Synthetic_Documents_Gmail_Closeout_and_Governed_Follow_Through_Handover.md), candidate correction, separate verification, confirmation, and live-animation fallback evidence.
- **S3:** [Phase 3D evidence](./Phase3D_Evidence.md), transition recording, accepted local motion, and remaining posture/cost limitations.
- **S4:** [Weight-trend closeout](./Phase3E8_Closeout_and_Phase3E9_Handover.md), chart and spoken-summary feedback and acceptance.
- **S5:** [Profile and transcript closeout](./Phase3E9_Closeout_and_AnimateTomo_Handover.md), Profile grouping, microchip detail, and default-open transcript.
- **S6:** [Animate Tomo reliability closeout](./AnimateTomo_Reliability_Closeout_and_Demo_Environment_Handover.md) and [motion setup](./Runway_LiveKit_Setup.md).
- **S7:** [Accepted local setup and inbox isolation](./Local_Setup_and_Inbox_Isolation.md).
- **S8:** Current [layout styles](../src/index.css) and [Voice presentation](../src/pages/Dashboard/AssistantPanel.jsx), plus the 1280 × 720 browser view inspected earlier in this task. This planning pass did not restart the app to collect new screenshots.
- **S9:** Current [inbox recovery copy](../server/gmail/documentProcessingFallback.js) and [Inbox UI](../src/pages/Dashboard/CareSidebar.jsx).
- **C1:** [Guide Next Slice Build](https://chatgpt.com/c/6a9f437e-5adc-83e8-8816-dbb79afea645): correction discoverability, approval sequence, card visual feedback, subsequent acceptance, and demo animation startup failure.
- **C2:** [Review Phase 3E8 Architecture](https://chatgpt.com/c/6a90c4ab-9b24-83e8-bb53-348c669ba643): chart actions, point states, unit choice, spoken summary, and Profile request.
- **C3:** [Review Phase 3E9 Decisions](https://chatgpt.com/c/6a91f8c8-d34c-83e8-9093-41818c49d8ab): transcript-open default and Profile acceptance.
- **C4:** [Review handover gaps](https://chatgpt.com/c/6aa31d89-c250-83e8-ae8d-cfe56ace3856): October reminder and visibility-icon reports, fixes, and acceptance.
- **C5:** [Review Animate Tomo Recovery](https://chatgpt.com/c/6a99d1f7-4a6c-83e8-be6a-b4ed70274dd1): start/end clarity and continued local Voice acceptance.

- **S10:** Current [speech provider](../server/voice/openAiVoiceProvider.js), [speech personality instructions](../server/voice/tomoPersonality.js), and [Runway worker](../server/avatar/runwayAvatarAgent.js); installed `@livekit/agents-plugin-runway/src/avatar.ts` requests `gwm1_avatars` (inspected September 14).
- **W1:** [Runway character concepts](https://docs.dev.runwayml.com/characters/concepts/), inspected September 14: stylized characters and maximum session duration.
- **W2:** [Runway LiveKit integration](https://docs.dev.runwayml.com/characters/livekit/), inspected September 14: external speech drives the avatar; configured Runway voice/personality is bypassed.
- **W3:** [LiveKit Runway integration](https://docs.livekit.io/agents/models/avatar/plugins/runway/), inspected September 14: supported integration and voice-setting precedence.


## Character implementation update — September 19

Rosa approved the listening examples and confirmed that semantic paraphrases and real-care applicability are requirements. B2 now connects shared assistant tone to voice delivery and bounded local expressions. P14–P16 have first-slice implementation coverage; they remain open for integrated acceptance and further nuance. See [the delivery report](./TomoCare_Character_B2_Manual_Checks.md) for tests, live fictional checks, limits, and the five minimum checks. Persistent preference learning and direct control of live-avatar emotions are not part of this slice.
