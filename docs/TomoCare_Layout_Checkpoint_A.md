# Layout checkpoint A — Audit and design proposal

**Date:** September 14, 2026
**Baseline:** `5316a2c`, `final-voice-animation-ui-polish`
**Status:** Proposal approved by Rosa; A1–A3 implemented September 19, 2026. Rosa completed the [manual checks](./TomoCare_Layout_A_Manual_Checks.md) and accepted the enhancements with one compact-menu alignment refinement, now implemented and awaiting visual confirmation. The findings below preserve the September 14 audit baseline.

[Open the visual proposal](./TomoCare_Layout_Proposal.html) · [Consolidated polish register](./TomoCare_Final_Polish_Register.md)

## What was inspected

Started the isolated demo UI/API without resetting or importing documents. Checked the existing verified fictional invoice, profile, Voice/Chat, transcript, and a single weight question through the actual UI. The current demo contains one verified weight reading; a multi-point chart and an editable candidate invoice were not available in this state. No record verification, reminder creation, message sending, microphone recording, or Runway session was performed.

Browser observations used the Codex in-app browser at 1440 × 900, 1280 × 720, 1024 × 768, 390 × 844, and 1280 × 600 CSS pixels. Measurements below are DOM geometry after resizing settled, supported by screenshots in the task. Dialog observations used the actual shipped `PostVerifyActionsModal` with fictional props in a temporary local fixture, including 390 × 600. That fixture exercised presentation only, with no care-service callbacks. It is removed after the audit.

This is a focused audit, not a claim of comprehensive accessibility or browser compatibility. Native browser 200% zoom, assistive-technology speech, contrast measurement, Reduced Motion, the operating-system keyboard on phones, and Safari/Chrome PDF rendering still need their implementation acceptance checks.

## Confirmed findings

| Finding | Evidence and user impact | Register | Proposed treatment / size |
| --- | --- | --- | --- |
| **L01 — Competing fixed panel widths** | At 1280 × 720: navigation 190, care 360, Tomo 210, transcript 520px. The center of Animate Tomo is covered by the ready-status element. At 1024 × 768, Tomo is only 110.16px wide and controls crowd or clip. At 1440 × 900, Tomo is 370px; controls are visible but the portrait remains tightly cropped. | P01/P03/P13 | **First slice, M:** budget space for each content area; reduce care/navigation width before sacrificing Tomo or evidence; move controls into a stable layout. |
| **L02 — Mobile care drawer is displaced and nearly transparent** | At 390 × 844, the drawer starts at x=120 and ends at x=450. Its close button starts at x=393, beyond the visible window. The absolute drawer retains grid column 2 and adds a 60px inset, accounting for the extra offset. Its translucent desktop background lets Tomo and the underlying text show through. | P02/P06 | **First slice, shared M:** anchor to the correct containing area, use an opaque surface, and keep close/navigation reachable. Avoid counting this again as a separate full redesign. |
| **L03 — Transcript covers speech controls** | At 390 × 844 with care details closed, the open transcript occupies y≈313–844. The speaking button at y=730–786 is underneath the transcript body. The transcript must be closed to reveal it. | P01/P02/P03 | **First slice, shared M:** reserve a separate control area; stack compact character and evidence on narrow screens. |
| **L04 — Responsive icon controls lose accessible names** | At 390px, the browser accessibility tree exposes four unnamed navigation buttons and unnamed Voice/Chat buttons. Navigation text is hidden by CSS below 1100px, while its tooltip is only set by the separate manually collapsed state. Mode labels use `hidden sm:inline` without an independent accessible name. | P06 | **First slice, S within it:** give every control a stable accessible name regardless of visual label visibility; retain useful visible cues/tooltips. |
| **L05 — Short window pushes speaking controls below the fold** | At 1280 × 600 the page is 693px tall. The speaking button extends to y=638. The home grid's 620px minimum plus the header forces outer-page scrolling. This is reachable by scrolling, but violates the intended always-available conversation control area. | P02 | **First slice, shared M:** use available viewport height for the shell and deliberate internal content scrolling; compact the portrait on short windows. |
| **L06 — Chart display choice resets across modes** | Selected kg in Chat, switched to Voice, and reopened the transcript. The same answer and record were retained, but lb became selected again. `VerifiedWeightTrendChart` owns its display choice in component-local state, so remounting resets it. Multi-point selection persistence was not tested. | P04 | **Companion fix, S–M:** preserve the existing turn's unit/selection state through panel and mode changes, without adding durable conversation storage. |
| **L07 — Narrow verification workspace compresses useful content** | At 390 × 844, the queue, PDF and working panel are stacked inside a fixed-height workspace. The PDF frame is only about 130px tall and the working panel's header consumes most of its card. “Saved to records” wraps over three lines. The verified audit view was inspected; candidate correction still needs a planned fixture/rehearsal. | P02/P12 | **Separate verification slice, M:** compact/collapse the queue, allocate useful source/review space, and reflow header/actions. Rehearse correction before acceptance. |
| **L08 — Next-step dialog lacks height and keyboard containment** | In the shipped-component fixture, opening confirmation leaves focus on the background trigger; Tab reaches another background control; Escape leaves the dialog open. In next steps at 390 × 600, the dialog is 741px tall, extending from y=-70.5 to 670.5; “Not now” is below the window and the overlay has no scroll container. Other dialog implementations also have no local focus/Escape handling, but were not exercised in this fixture. | P02/P06 | **Separate dialog slice, M:** bounded body scrolling, reachable header/footer actions, initial focus, focus containment/return, and appropriate Escape behavior. Verify each actual dialog state before closing this finding. |

Sizes include focused implementation and validation, are provisional, and overlap within the first slice. Do not add each row as an independent estimate.

## Behaviors to preserve and limits of the evidence

- The runtime badge accurately displayed Demo data. Existing verified documents remained read-only.
- Transcript content and its evidence link survived the inspected Voice/Chat transition. The explicit transcript-close choice was retained until reopened. Unit choice did not survive (L06).
- The single-reading weight response explicitly said a trend could not be established. The chart offered the verified source and lb/kg controls. No multi-reading trend was fabricated for this audit.
- At 1440 × 900 and 1280 × 720, the inspected home did not create horizontal page overflow. That alone does not prove usable controls: L01 occurs without page overflow.
- The embedded source PDF appeared blank in the in-app browser. This is an **unresolved browser/viewer observation**, not proof that the PDF is unreadable or that ingestion failed. The current component has no explicit open-source fallback. Check it in the supported browser and consider an “Open PDF” path as a separate recovery improvement; do not reopen the accepted isolation work on this evidence alone.
- Editing, verification confirmation with real app state, the appointment draft, long field values, busy/failed dialog states, and 200% zoom remain specific acceptance coverage. Source inspection suggests shared dialog risks; it does not substitute for testing those states.

## Recommended arrangement

The governing rule is to reserve useful space for both Tomo and evidence, then adapt care details. Keep the transcript open by default, preserve explicit panel choices, and avoid resizing the character into a sliver.

| Window class | Proposed arrangement | Tradeoff |
| --- | --- | --- |
| **Wide laptop, around 1360px and above** | Labeled navigation around 176px; care details around 320px; remaining space shared by Tomo and the transcript. At 1440, an illustrative equal split leaves 472px each. Cap very wide transcript lines. | Care details become slightly narrower; Tomo and evidence both gain useful balance. |
| **Laptop, around 1200–1359px** | Compact navigation 72px; care details 320px; Tomo and transcript share the remainder. At 1280, each gets 444px rather than 210/520. Keep a single primary state and controls in their own space. | Navigation uses compact presentation with stable accessible names and discoverable labels. |
| **Compact laptop, around 860–1199px** | Navigation 72px; care details initially closed and opened on demand as a temporary overlay. At 1024 with details closed, Tomo and transcript each get 476px. | Care details temporarily cover part of the workspace. Use a clear close path, opaque background, focus return, and retain context on dismissal. If speech is active, provide access to its stop control within the overlay. |
| **Narrow / phone** | Full-width workspace with compact labeled navigation, smaller Tomo above the transcript, and a speech dock outside the transcript. Open care details in a fitted overlay. | Tomo is smaller so evidence remains readable. No three-column squeeze or transcript over the microphone. |
| **Short windows and zoomed layouts** | Compact the portrait; keep the dock and close controls visible. Let content sections scroll deliberately rather than imposing a tall desktop minimum on the whole page. | Less decorative vertical space; no hidden primary control. |

Exact breakpoints are implementation parameters to validate against measured minimum content widths, not a requirement to use the current media-query boundaries. Overlay behavior must preserve the underlying conversation and entered values. A responsive default must not silently overwrite an explicit choice; reopening/resizing should restore the user's intended state when space permits.

The visual proposal is a proportional sketch. Its controls only select illustrations; it does not implement navigation, microphone, provider, care overlay, or chart behavior. It uses the existing Tomo still and a clearly fictional example. Month-name dates in the sketch remain a proposed display convention.

## Delivery slices and acceptance

1. **A1 — Home layout and essential controls (M, split if discovery during implementation warrants it).** L01–L05: panel budgets, compact/narrow behavior, opaque correctly placed drawer, persistent speech controls, and responsive control names. Validate Chat and Voice together. No voice identity/provider change.
2. **A2 — Evidence continuity (S–M).** L06: preserve units and selected evidence in the mounted conversation across layout/mode transitions. Keep the source facts unchanged.
3. **A3 — Verification and dialogs (two M slices if needed).** L07 and L08: responsive source/review workspace, then shared dialog behavior with each consumer checked. Keep correction distinct from approval. Prepare candidate-state fixtures before any demo reset is scheduled.

For each slice Codex supplies the actual findings repaired, focused regression/build results as relevant, screenshots at changed sizes, and remaining limits. Rosa reviews the resulting interaction and receives these minimum checks narrowed to the delivered slice:

- **A1:** At the agreed laptop width, open care details and transcript together; both evidence and Tomo remain useful. Then narrow/shorten the window and start/stop one Voice turn with the transcript open. Open/close care details by keyboard and verify visible focus and understandable controls.
- **A2:** Select kg and a chart point where available; switch Voice/Chat and close/reopen the transcript. The same turn, units, selected evidence, and source remain available.
- **A3:** In prepared demo/fixture state, reach every invoice correction and dialog action at the short/narrow size. Tab stays within an open modal, Escape behaves appropriately, and focus returns on close. Saving a correction still does not approve it.

**Product decision:** Rosa approved this responsive arrangement and all implementation slices, including the smaller character above evidence on phones. She requested encouragement to perform careful PDF verification on a larger screen. Implementation is ready for her interaction acceptance; approval of the proposal is not recorded as acceptance of the finished build.

## Implementation pointers

- `src/index.css`: home grid sizing (around 78), Voice/transcript allocation (408–427), transcript overlay (672), responsive care drawer (1206–1233), mobile transcript (1293).
- `src/pages/Dashboard/CareSidebar.jsx`: navigation labels and care-drawer structure.
- `src/pages/Dashboard/AssistantPanel.jsx`: mode labels (around 747–760), Voice stage, dock, and transcript mounting.
- `src/pages/Dashboard/VerifiedWeightTrendChart.jsx`: local display/selection state (10–11).
- `src/pages/VerifyDocs/VerifyDocs.jsx`, `VerifyHeader.jsx`, `SourcePreviewPanel.jsx`, `WorkingPanel.jsx`: source/review layout and header.
- `src/pages/VerifyDocs/PostVerifyActionsModal.jsx`: confirmation/next-step modal presentation.
- `src/pages/Dashboard/CareActionDialog.jsx`, `LibrelaAppointmentMessageDialog.jsx`: additional dialog consumers requiring acceptance checks.
