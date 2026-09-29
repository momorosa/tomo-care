# TomoCare demo track closeout and real-care handover

**Closed:** September 29, 2026  
**Owner acceptance:** Rosa explicitly approved all manual tests after recording the end-to-end experience and collecting screenshots.  
**Demo track:** Complete for this checkpoint; no outstanding demo acceptance gate.  
**Real-care track:** Paused at the owner's request. Resume only when Rosa explicitly asks; no automatic restart or new care scope.  
**Release:** `demo-v1.0.0` on `main`. GitHub release notes are the source of truth for the final merge commit and pull request.

This closeout supersedes pending/next-step wording in earlier polish, Journey, Calendar and recording documents. Those documents retain dated implementation and validation history. Completion means acceptance of the bounded demo scope, not production certification or blanket accessibility/provider reliability claims.

## Accepted product story

1. **Source to trusted records:** the allowlisted synthetic Gmail invoice enters review; Rosa inspects the PDF, corrects the candidate invoice number, saves/rechecks, and explicitly verifies before records become trusted.
2. **Trusted records to useful answers:** Chat and Voice share grounded answers, source access, reminders, spending and the three-point verified weight chart. Missing evidence and clarification remain explicit.
3. **Governed follow-through:** source-linked reminders support an editable, review-only appointment-request draft. The one approved demo Calendar action creates a synthetic Librela reminder in the dedicated calendar. A reminder is not a booked appointment; the draft is not sent.
4. **Character and continuity:** responsive layouts, transcript resizing, warm/personal delivery, bounded playful reactions, live/local animation transitions, and seamless local Voice continuation after the provider's five-minute session limit are accepted within the demonstrated scope.

Rosa's September 29 statement is the manual acceptance authority. Earlier five-minute-expiry acceptance remains valid. No new manual/provider session was run during administrative closeout.

## Evidence and supported claims

Rosa retained the original artifacts in `~/Projects/TomoCare_demo_artifacts`: **one MOV recording and 12 PNG screenshots**, totaling **1,077,688,964 bytes** at inventory time. See [artifact inventory](./TomoCare_Demo_Artifact_Inventory.md) for exact original filenames, byte sizes, SHA-256 hashes and evidence mapping. Media stays outside Git and was not uploaded to the public repository or release.

| Evidence | Supported statement | Boundary |
| --- | --- | --- |
| `Tom0_E2E.mov`, `TomoCare_gmailInbox.png`, `Demo_SyntheticPDF.png`, `Verify_Save.png` | Owner recorded and accepted the source-to-review-to-verification experience. | The complete movie was inventoried/hashed, not independently watched during closeout. Human acceptance is attributed to Rosa. |
| `Supabase_document.png` | Recorded database evidence of the source's final state. | A final row alone does not establish the sequence of approval; pair it with the recording. |
| `Supabase_Librela_expenses.png` | Four verified cost rows total **USD 416.50** across May, July and September. | May/July are explicitly preloaded synthetic history; September has separate vial and administration charges. |
| `TomoCare_chat_weight_trend_chart.png`, `supabase_weight_tren_data.png` | Three dated weight measurements: **13.6 → 13.4 → 13.1 kg**. | A descriptive trend, not a diagnosis; seeded history is not evidence of two additional human verification sessions. |
| `Supabase_reminder.png`, `GoogleCal_Reminder.png` | Source-linked September care event, October 19 reminder, October 26 due date and persisted Calendar reference. | SQL shows saved sync state, not a new provider status probe or an appointment booking. |
| `Librela_appt_draft.png` | Editable assistance with the next appointment request. | No sending, delivery or booking claim. |
| `TomoCare_homepage_profile.png`, `TomoCare_homepage_reminder.png` | Accepted product layout and care context. | Not a comprehensive accessibility audit. |

The expense, weight and reminder SQL screenshots were visually inspected during closeout and support the values above. Optional marketing edits, additional fallback clips, and a full portfolio case-study/site rewrite are future presentation work, not blockers to this accepted demo checkpoint. Published claims should retain the synthetic-data and approval boundaries above.

## Final engineering validation

- **859 JavaScript tests passed**, zero failed/skipped: `node --test server/**/*.test.js src/**/*.test.js`.
- **3 Python tests passed**: `PYTHONPATH=agent agent/.venv/bin/python -m unittest discover -s agent/tests`.
- **ESLint passed for all 87 changed JavaScript/JSX files** relative to the pre-polish main baseline `5c57733`.
- **Production build passed**: `npm run build`. Existing LiveKit bundle-size advisory remains; it does not block the build.
- `git diff --check` passed.
- Closeout repaired two older lifecycle test setup assumptions: fixed fixture clocks instead of the changing wall clock, and an explicit real-mode setting for the fully mocked Gmail lifecycle. Also removed an unnecessary regex escape in the model-inspection script. No product behavior, configured model, live data or provider setting changed in those repairs.
- No GitHub Actions workflow existed at closeout; these are local validation results, not hosted CI results.

## Preserved state and replay

The closeout does not reset either database, delete the accepted reminder/Calendar entry, send a message, or modify credentials. The raw artifact folder is retained unchanged. The frozen release is code and documentation; it is not a database or credential backup.

For a later recording, use [receipt-only replay](./TomoCare_Demo_Receipt_Replay.md). Preview first, stop the app and avatar worker before applying, and preserve May/July. **Do not use `demo:reset` unless Rosa explicitly wants the full baseline**, which changes totals/history. `demo:seed-history` is unnecessary for receipt-only replay.

The demo dates are fixed in 2026. After October 19/26, the calendar timing guard can correctly reject a newly created stale reminder. Reassess dates and scope with Rosa before a later live demo; do not silently shift dates, reset data, or weaken timing checks to recreate a past presentation.

## Deferred work

No further implementation starts automatically. Deferred items remain product choices for a future checkpoint:

- Broader expressions and relationship memory; closer live/local voice and posture matching.
- Extraction-model evaluation/migration and expanded provider benchmarking.
- Broader real-care medication, preventive-care, lab/imaging and other lifecycle coverage.
- Production/platform expansion and any accessibility certification beyond the accepted bounded checks.

The cause of the historical Supabase `JWT issued at future` rejection remains unproven. The accepted one-time, read-only recovery for the exact failure remains in place; no credential rotation, clock change or write retry is implied.

## Resume after the pause

1. Read this handover, the [operating brief](./TomoCare_Operating_Brief.md), [roadmap](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md), and [model lifecycle notes](./TomoCare_Model_Lifecycle.md).
2. Confirm current GitHub/main state and any local changes before choosing a new branch. Keep `demo-v1.0.0` as the accepted demo reference.
3. Run `npm run setup:check` for intended private-care work, or `npm run setup:check:demo` for demo work. Recheck provider model availability and lifecycle notices after the pause; do not automatically upgrade or migrate models.
4. Confirm the intended runtime, pet and provider destinations before starting. `npm run dev` uses private-care configuration; `npm run dev:demo` uses demo configuration. The optional demo avatar worker is separate: `npm run dev:demo:avatar`.
5. Review the current real-care state read-only and agree the next bounded product milestone with Rosa before implementation or any care-data mutation. Do not assume care reminders or records are unchanged after the pause.

**Suggested restart request:** “Resume TomoCare's real-care track from the demo closeout handover. First verify the current repo, runtime and provider state read-only, then discuss the next bounded care milestone with me.”
