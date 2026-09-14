# TomoCare — Consolidated polish register

**Prepared:** September 13, 2026  
**Status:** Draft for Rosa's review; priorities, sizes, and proposed designs are not yet accepted.  
**Baseline:** Accepted setup/inbox isolation merge `5c57733`, on `final-voice-animation-ui-polish`.  
**Current activity:** Planning only. The app, API, and animation worker have been stopped. No polish implementation has begun.

## Purpose and evidence

Keep the remaining polish work, previously accepted feedback, and new suggestions in one place. Preserve the original product concerns without treating every historical issue as an unresolved bug.

This register consolidates the current handover, earlier closeout documents, and the recent conversations reviewed for this task. It is not a claim that every historical conversation or screenshot has been audited. Rosa's own notes are the next reconciliation input.

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
| P08 | **Refine local-to-live and live-to-local visual continuity.** Local clips and Runway use different poses; the posture change is a recorded limitation. | Recorded limitation; reproduce on the intended setup before changing it. [S3] | P2; conditional on live animation being included | M provisional | In an explicit live session, start, speak, finish, and end without double faces, an unnecessary cover flash, or controls jumping. Improve the transition with the existing character and media; do not promise perfect pose matching or create a new avatar. |
| P09 | **Protect the improved local motion sequence.** Earlier loop resets, purple flickers, and face overlaps were already improved and accepted. | Regression audit, not a request to rebuild local motion. [S3, S6] | P2 | S audit | Idle → acknowledgment → listening → thinking follows the intended sequence without unnecessary restarts; held frames are stable; Reduced Motion uses the still path. Close with no change if it passes. |
| P10 | **Validate animation failure, expiry, and retry presentation.** Distinguish an intentional end from a failure and preserve local audio exactly once. | Regression audit of shipped reliability work. [S1, S6] | P1 for fallback behavior; live-specific rehearsal conditional on P07 | S–M audit | Exercise start/end and one controlled transient failure or existing test fixture. One clear user-driven recovery is available; the existing answer continues once locally, without replay, resynthesis, or automatic retry. Do not disrupt the provider solely to generate a failure. |
| P11 | **Make inbox recovery language more useful.** The missing PDF dependency produced a message mentioning OCR, and the UI exposed `populate_raw_text` as a processing stage. | Fresh recommendation grounded in this task's failure screenshot and current copy. The dependency defect itself is closed. [S7, S9] | P2 | S | Recovery explains what was saved, what has not happened, and the next useful action. It does not imply that an unreadable scan is the confirmed cause of a general processing failure. Keep technical detail secondary and preserve diagnostic access. |
| P12 | **Unify presentation details along the accepted path.** Dates, spacing, button sizing, visual hierarchy, and icons should read consistently. | Audit from the handover; fresh suggestion to prefer unambiguous displayed dates such as “Sep 7, 2026,” subject to Rosa's choice. [S1] | P2 | M audit; individual fixes S–M | Apply the agreed display convention across the rehearsed surfaces; no ambiguous or contradictory dates, raw icon names, truncated field titles, or avoidable button-label wrapping. Preserve underlying dates, units, source values, and calculations. |
| P13 | **Reduce repeated status messaging.** The inspected Voice view showed readiness in several places while the stage was crowded. | Fresh recommendation; visual hierarchy concern, not a proven contradiction between states. [S8] | P2 | S | One primary Voice state and any separate animation state are easy to distinguish. Remove redundant visible copy only where it improves clarity; retain accessible announcements and necessary recovery text. Coordinate with P01/P03 rather than adding a second state system. |
| P14 | **Optional meaning-based reactions: happy, laughing, oops.** Use existing assets only for harmless presentation cues. | Recorded optional direction, not a committed requirement. [S1, S3] | P3 | M–L; split by reaction if selected | Rosa approves the specific harmless triggers; reactions never imply medical reassurance or action success, alter an answer, interrupt speech, loop unexpectedly, or override Reduced Motion. Default recommendation: defer until the essential path is accepted. |

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
| Runway cost/credit measurement and broader latency benchmarking | Keep in the evidence/evaluation backlog. Prior timing was one sample, not a service-level claim. Do not invent a cost or performance target here. |
| Broader Inbox/Recently verified assistant coverage, appointment aggregation, Calendar navigation, preventive/lab intelligence, or new care actions | Separate product capability slices after the portfolio checkpoint unless Rosa reprioritizes them. |
| Durable conversation history, production hosting, authentication, multi-user support | Separate product/platform work. |
| Deleting the old unprocessed synthetic copy from private care | Separate optional cleanup decision. The isolation checkpoint is accepted and stays closed. No cleanup is part of this register. |

## Fresh perspective and proposed sequence

**Recommendation: prioritize readable evidence and visible human control, then animation finish.** The strongest product story is how Rosa reviews and changes candidate information, sees the trusted result, and decides what happens next. A squeezed transcript or unclear confirmation harms that story more than the absence of an extra character reaction.

1. **Reconcile this register and choose the presentation constraints.** Add Rosa's missing notes, decide supported sizes and whether live animation is optional for the intended demonstration. Resolve P07 as a small investigation early so it cannot turn into an open-ended provider task.
2. **Checkpoint A — Layout and evidence access.** P01/P02, plus P04/P06 checks and any directly related P12 fixes. Start with the known crowded laptop view. Provisional implementation size: M–L only if multiple surfaces need changes; split after the initial inspection.
3. **Checkpoint B — Voice state and interaction continuity.** P03/P13, with P09/P10 regression checks. Provisional size: M if concrete issues reproduce; do not rewrite accepted lifecycle behavior just to produce a change.
4. **Checkpoint C — Complete journey and recovery copy.** Rehearse P05 and finish selected P11/P12 issues. Provisional size: S–M for copy/local fixes; escalate any functional defect separately.
5. **Checkpoint D — Optional live-animation finish.** P08 only if P07 and the presentation decision justify it. Provisional size: M with existing assets. Defer P14 unless explicitly selected after the essential path is accepted.

These checkpoints overlap in verification but should not duplicate implementation work. Accessibility and the existing governance boundaries apply to every checkpoint. No total delivery estimate is committed until Rosa has reviewed gaps and concrete failures have been separated from passing audits.

## Minimum manual checks proposed for later implementation checkpoints

These are future acceptance guides, not instructions to restart the app now. Each delivery should narrow this list to what actually changed and identify any step that writes demo data. Use the isolated demo for write-producing rehearsals; the exact reset remains an explicitly scheduled preparation step.

| Checkpoint | Minimum checks Rosa would receive |
| --- | --- |
| A — Layout | 1. Open care details and the transcript at the agreed laptop width. 2. Inspect a chart and invoice dialog at the agreed narrow/short size. 3. Reach the main actions and close/reopen panels by keyboard. Expect readable evidence, usable controls, and sensible focus. |
| B — Voice | 1. Ask one short question and observe listening → thinking → speaking → ready. 2. Stop/replay/mute as specified for the changed control. 3. Switch Voice/Chat and reopen the transcript. Expect one answer, no duplicate audio, and the same evidence. |
| C — Journey | After planned demo preparation: 1. Correct/recheck the invoice; verify that saving alone does not approve it. 2. Explicitly verify and see confirmation before next actions. 3. Create the existing reminders and inspect October Attention and the editable review-only draft. These steps intentionally write demo records. |
| D — Animation | 1. Explicitly start animation and speak once. 2. End it and confirm local Voice still works. 3. Review one controlled failure/fallback supplied by Codex. Expect truthful status and one recovery choice without duplicate speech. Any paid provider exercise is bounded in advance. |

Codex owns focused automated regression checks, lint/build where relevant, and an explicit report of unverified behavior. Rosa owns product acceptance and can explore beyond the minimum. At handoff, state who owns the running server and its active environment.

## Decisions and gaps for Rosa's review

- **Missing feedback:** add the original observation or desired behavior; a screenshot or earlier conversation reference is useful when available. Match an existing ID where possible.
- **Presentation sizes:** proposed starting checks are 1440 × 900, 1280 × 720, 1024 × 768, and 390 × 844 CSS pixels, plus a short-window and zoom check. These are proposed coverage points, not a promise of full support at every size.
- **Narrow-layout preference:** retain transcript-open by default; decide whether care details overlay, reflow, or share space when both panels are open. No layout choice has been implemented.
- **Live animation:** choose a complete local Voice/motion demo with optional live enhancement, or make live animation a required presentation criterion with its extra dependency. Recommendation: keep it optional.
- **Display conventions:** decide whether date wording should become unambiguous month-name text; preserve the accepted lb/kg choice.
- **Character reactions:** recommendation is to defer P14. Any selected reactions need an explicit trigger list.

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
