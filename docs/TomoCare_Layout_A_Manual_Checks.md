# Layout A — Delivery and manual acceptance

**Delivered:** September 19, 2026 · `final-voice-animation-ui-polish`  
**Status:** Accepted by Rosa on September 19, 2026, including A1–A3 and both compact-sidebar icon-alignment refinements.
[Audit and approved proposal](./TomoCare_Layout_Checkpoint_A.md) · [Polish register](./TomoCare_Final_Polish_Register.md)

## Start here

From the TomoCare repository, run `npm run dev:demo`, then open http://localhost:5173 in your usual browser. Confirm the **Demo data** badge. No reset is needed for the layout checks below. The existing verified invoice can be used for PDF and read-only review checks.

Use your normal laptop window, a shorter window, and a narrow phone-sized window. Suggested reference sizes are 1440 × 900, 1280 × 600, 1024 × 768, and 390 × 844. Exact pixel matching is optional for your first product review. Also try 200% browser zoom.

## Minimum checks for this delivery

| Check | What to do | Pass when |
| --- | --- | --- |
| **1. Home layout and care details** | Keep the transcript open; resize wide → compact → phone. Open Momo, Reminders, Inbox, and Recently verified. Close and reopen care details. | Tomo and evidence have useful space; phone navigation is understandable; care details are opaque and fit onscreen; close is reachable. Compact layouts start with care details closed on a fresh load. Resizing preserves an explicit open/closed choice. |
| **2. Voice controls and continuity** | With the transcript open, start and stop one short Voice turn. Switch Voice → Chat → Voice. During playback, open care details on a narrow window and use Stop there. | Speech controls remain reachable, with one control set. The same conversation remains; opening care details does not restart the answer. Judge perceived ease and comfort here, including the smaller Tomo on phones. |
| **3. Evidence state** | Ask “How has Momo’s weight changed?” Select kg. Switch Voice/Chat and close/reopen the transcript. Where there are multiple readings, choose an older point first. | The same answer, units, selected reading, and source remain. The enriched demo now has three readings before a full reset; the fixture below remains available for isolated checks. |
| **4. PDF and verification workspace** | Open the existing invoice from Recently verified. Compare wide and narrow layouts. Expand/collapse Documents on a narrow window; use Open PDF. | The PDF is readable in your browser, source and fields are usable side by side on a laptop, and the narrow page scrolls through useful-sized sections. Larger-screen guidance feels helpful. The verified record remains read-only. |
| **5. Corrections and dialogs** | Open the fixture below. Edit Invoice, save its correction, then inspect all three dialogs. At a short/narrow size use Tab, Shift+Tab, Escape, and the visible dismissal actions. Edit the appointment draft and resize. | The correction field is obvious and its save label fits. The fixture remains unverified. Focus stays inside a modal and returns to its opener; idle Escape dismisses; footer actions are reachable; draft text survives resizing. |

### Safe fixtures for check 5 and multi-point evidence

While the development server is running, open:

http://localhost:5173/tests/browser/layout-fixtures.html

These use the actual UI components with fictional inputs and local-only callbacks. They do not create records, reminders, appointments, or service requests. A “saved” confirmation is a presentation fixture, not a database operation. The page is a development entry point, not included in the production build.

- Select kg and the August point, then click **Toggle chart mounting** twice. Both selections should remain.
- Click **Edit**, change Invoice, then **Save correction & recheck**. The fixture status must still say unverified. This exercises presentation; it does not simulate the backend AI recheck.
- **Open verification confirmation** → **Continue to next steps** → **Not now**. Check both confirmation and next-step views.
- **Open care date dialog** and **Open appointment draft**. Check field entry, scrolling, keyboard containment, and dismissal.
- Optional busy-state check: select **Simulate busy dialog** before opening a dialog. In the next-step/busy view, Escape and dismissal must not interrupt the pending operation. Reload the fixture to clear this deliberately permanent simulated state.

Please report the check number, browser/window size, what happened, and what you expected. Screenshots are useful for spacing or clipping. Core product acceptance is these five checks; additional voice identity, expressive animation, and journey feedback belongs in the existing four-track register.

## Implementation delivered

- **A1 / L01–L05:** 176px labeled navigation on wide windows, 72px compact navigation, 320px care panel, balanced Tomo/transcript allocation; compact care details become a fitted opaque modal. Phones get labeled horizontal navigation and a small portrait above the transcript. Speech controls occupy their own area and move inside the active care overlay so playback remains controllable. Icon controls retain accessible names.
- **A2 / L06:** units and selected chart evidence belong to the mounted conversation session. Switching mode or remounting the transcript preserves them; clearing the session clears this presentation state. Canonical figures and calculations are unchanged.
- **A3 / L07–L08:** verification uses desktop columns, a collapsible compact queue, and a scrolling narrow layout with a 460px source panel. Larger-screen guidance and an Open PDF fallback support careful review. Correction labels and actions remain readable. Shared native dialogs bound scrolling, contain and restore focus, and respect each flow’s busy-state dismissal guard.

## Validation evidence and limits

- Dashboard and verification regression suite: **161 passed, 0 failed**.
- ESLint passed for every changed JavaScript/JSX file and the fixture. Production build passed; the existing LiveKit chunk-size warning remains.
- At **1280 × 600**, measured widths are 72 / 320 / 444 / 444px for navigation / care / Tomo / transcript. Page height equals the 600px viewport; the microphone is uncovered and ends at y=551.
- Home checked at 1280 × 720, 1024 × 768, 390 × 844, 320 × 568, and 640 × 450. Care overlays fit, have one microphone control set, and return focus on Escape. Labels remain present on phones after collapsing the desktop sidebar.
- At **1440 × 900**, verification source and working panels are approximately 624 × 703 and 446 × 703px. At **1024 × 768**, the queue collapses and source/fields stay side by side. At **390 × 844**, the source is 460px tall, review fields flow beneath it, and there is no horizontal page overflow.
- Actual demo weight answer retained kg through Voice/Chat and transcript reopening. The fictional two-point fixture retained kg and the August selection after chart unmount/remount.
- At **390 × 600**, the next-step modal fits within y=10–590; Not now is fully visible at y=539–577. Confirmation, care-date, and appointment-draft fixtures exercised focus/Escape; busy dismissal remained blocked. Draft text and candidate input survived resizing. Correction fixture saving left its status unverified.
- No care records were changed, no demo reset/import was performed, and no microphone recording, outbound message, or Runway session was started for this implementation validation.
- The embedded PDF still appears blank in the Codex in-app browser, as in the original audit. The URL-backed Open PDF fallback is present. Actual PDF rendering in Safari/Chrome remains a user-browser check, not a claimed pass.
- Actual microphone/playback, native 200% browser zoom, phone software-keyboard behavior, assistive-technology speech, full contrast/Reduced Motion acceptance, and every error/recovery state have not been revalidated in this layout pass. These limits do not close the broader Voice, Animation, Journey, or accessibility register items.

## Manual review follow-up — September 19

Rosa reported liking all the enhancements after completing the manual check. Her only requested refinement was the compact menu button: its separate rounded hover/focus box and off-axis icon distracted from the otherwise aligned navigation rows.

The compact menu now spans the full header row, uses square row edges and the same hover color as the navigation items, and centers on their icon axis. The header keeps its existing height and divider. Checked automatic compact mode at 1280px and manually collapsed mode at 1440px: menu and navigation targets are each 71px wide inside the 72px rail, and both icon centers are x=35.5px. Keyboard focus covers the full menu row. Build and focused lint pass. This records Rosa’s product review; it does not imply every broader accessibility/browser limit above was independently re-tested.

Rosa confirmed the menu alignment fix and noticed the bottom approval/verification shield was still off-axis. The footer now centers its icon in automatic compact and manually collapsed sidebars. Label hiding targets the label explicitly, so it cannot accidentally hide the shield. Browser geometry confirms the shield and all five upper icons share x=35.5px in the 72px rail at 1280px automatic compact and 1440px manually collapsed widths. Build and focused lint pass.

**Final product acceptance — September 19:** Rosa confirmed the footer refinement with “Looks good to me!” Layout checkpoint A is accepted. The documented validation limits remain; later Voice, Animation, and Journey checkpoints are separate.
