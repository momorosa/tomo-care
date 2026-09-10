# TomoCare Current State: Synthetic Documents/Gmail Closeout and Governed Follow-Through Handover

**Closeout date:** September 10, 2026

**Current branch:** `main`

**Gate 1:** `8d53bc5` — `feat(demo): add allowlisted synthetic Gmail intake`

**Gate 2:** `308b681` — `feat(demo): add governed invoice review flow`

**Gate 3:** `11626e7` — `feat(demo): complete trusted invoice replay gate`

**Merged to main:** `ceba812` — `Merge synthetic documents and demo Gmail intake`

**Completed slice:** Synthetic Veterinary Documents and Demo-Safe Gmail Intake

**Next bounded slice:** Governed Follow-Through Demo Checkpoint

## Purpose

This handover closes the first complete synthetic source-to-trusted-memory story in TomoCare and defines the smallest safe follow-through story for the portfolio checkpoint.

The shipped path uses the real TomoCare architecture rather than a parallel demo importer: an exact fictional invoice enters through a narrowly allowlisted Gmail query, is preserved in private demo Storage, becomes editable candidate truth, receives bounded Verification Intelligence review, requires a visible human correction and separate verification, and materializes into source-linked trusted records used by Dashboard, Chat, and Voice.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. The hosted demo database and Rosa's accepted manual reset/intake/replay result
3. This handover for the next bounded slice
4. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md)
5. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md)
6. [Demo Environment Setup and Reset](./Demo_Environment_Setup_and_Reset.md)
7. [TomoCare Database Schema Reference](./TomoCare_Database_Schema_Reference.md) and the migration chain
8. Earlier handovers for historical context

When an older document conflicts with current code, tests, migrations, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Shipped result

### One exact synthetic source boundary

- Demo mode builds its own narrow Gmail query instead of running the broad real-care query.
- The server validates the authenticated inbox, direct sender, recipient, subject prefix, attachment filename, PDF type, and manifest-owned content hash.
- The sender and mailbox identities remain server-only configuration and are not copied into demo records or browser responses.
- The accepted PDF is visibly labeled `SAMPLE — DEMO DATA` and uses a fictional clinic, patient, identifiers, treatment, and costs.
- The source is stored at one deterministic private demo key.

### Candidate truth remains untrusted

- The exact invoice produces one deterministic candidate containing the September 7, 2026 visit, Librela administration, 13.1 kg weight, four cost items totaling $177.00, and clinic-reported Rabies status.
- Receipt wording does not become Rabies administration evidence.
- The candidate intentionally omits invoice number `HVC-DEMO-090726` so the demo contains one consequential, understandable human-correction moment.
- Verification Intelligence points to the missing value in the source.
- Selecting **Save correction & recheck** changes candidate truth and reruns review without approving or materializing anything.
- The attention card itself opens the focused editor, while **Keep as shown** remains an explicit alternative.

### Verification is a separate human decision

- **Verify and add to care record** remains separate from editing and rechecking.
- A confirmation state appears before optional next actions.
- Only the accepted current candidate fingerprint can be promoted.
- Stale, incomplete, conflicting, or unaccepted review state remains blocked.

### Trusted materialization uses the shared product path

Explicit verification creates or updates only the existing source-linked contracts:

- one verified Librela injection on September 7, 2026;
- one verified 13.1 kg weight fact;
- four verified cost items totaling $177.00;
- the corrected invoice number in the verified document candidate;
- one explicit clinic-reported Rabies status attached to the preventive-status evidence set; and
- no receipt-derived Rabies administration event or preventive reminder.

The demo does not seed the final trusted result directly and does not use a demo-only approval path.

### Derived product reads agree

Manual acceptance confirmed:

- Dashboard recognizes September 7 as the newest verified Librela care event.
- Chat answers the September 7 Librela event, 13.1 kg weight, four cost items, and clinic-reported Rabies status from trusted evidence.
- Voice returns the same grounded facts rather than a separate voice-specific interpretation.
- Evidence remains linked to the verified source document.

### Duplicate and replay behavior is bounded

- Rechecking the inbox skips the existing verified document.
- The same source cannot create duplicate documents, Storage objects, candidates, events, weights, costs, or clinic-status provenance.
- Reset deletes only frozen manifest IDs, rows linked to the exact intake document, relationship-derived action records, and the one exact Storage object.
- Reset does not list or sweep the demo prefix and never deletes the retained Gmail source.
- Consecutive resets restore the same baseline.
- The retained email can replay the same logical source-to-memory result after reset.

### External and presentation boundaries remain intact

- Calendar is not configured in demo mode and remained blocked during acceptance.
- Messages has no demo recipient and cannot claim sent, delivered, received, or booked.
- Live animation was unavailable during the accepted run. TomoCare displayed **Live animation couldn't start** and preserved local Voice, which is the designed recovery behavior.
- Animation availability does not alter the answer, evidence, trusted state, or action authority.

## Validation evidence

Rosa confirmed on September 10, 2026:

- the Gate 3 aggregate suite passed with 145 tests;
- the demo-environment suite passed with 30 tests;
- the Phase 3E.7a regressions passed with 49 Node tests and 3 Python checks;
- syntax and ESLint checks passed;
- the production build succeeded;
- Gmail intake, correction, recheck, explicit verification, confirmation, and trusted materialization worked manually;
- Dashboard, Chat, and Voice returned the agreed trusted evidence;
- duplicate inbox checking created no duplicate state;
- Calendar remained unlinked;
- reset and source replay completed successfully; and
- live-animation failure preserved an honest notification and working local Voice.

No database migration, new provider, real recipient, or demo Calendar/Message destination was added.

## Portfolio value now demonstrated

The shipped story shows more than document extraction. It demonstrates a transferable governed-AI pattern:

1. isolate an allowed source;
2. preserve immutable source truth;
3. let AI propose editable candidate truth;
4. focus human attention on consequential uncertainty;
5. keep correction separate from approval;
6. materialize only approved facts with provenance;
7. ground multiple product surfaces in the same trusted state; and
8. make duplicate, provider, and recovery boundaries visible.

This is the portfolio's strongest end-to-end evidence for TomoCare's source truth → candidate truth → trusted truth model.

## Current intentional boundaries

- Only one manifest-owned fictional Gmail message and PDF are accepted in demo mode.
- The five reset-baseline documents remain metadata-only provenance anchors.
- The invoice flow does not expand vaccine, wellness, laboratory, diagnostic, urgency, or treatment intelligence.
- Calendar and Messages remain unavailable as live demo destinations.
- Live animation remains optional and provider-dependent; local Voice is the accepted fallback.
- Final responsive, motion, transition, visual-consistency, screenshot, recording, case-study, and release-tag work remains incomplete.

## Revised near-term sequence

1. **Governed Follow-Through Demo Checkpoint**
2. **Final Voice, Animation, and End-to-End UI Polish**
3. **Demo Evidence, Case Study, and Portfolio Checkpoint Freeze**
4. **Broader preventive and health-intelligence work as later bounded Real-Care slices**

## Next bounded slice: Governed Follow-Through Demo Checkpoint

### User problem

The portfolio can now show how a source becomes trusted memory, but the story still needs one clear answer to: “What does TomoCare help me do next?” The next slice should demonstrate useful follow-through while preserving the distinction between an internal reminder, a reviewed draft, an external handoff, delivery, and a booked appointment.

The demo must not require a real clinic, phone number, Calendar, or Messages destination. A technically live send is not necessary to prove the product judgment; a visible, governed review boundary is more faithful to the portfolio thesis.

### Product decision for portfolio v1

Use the existing **draft-and-review path with a recorded fallback**. Do not configure a live demo Messages recipient.

This choice:

- avoids introducing personal recipient information or a potentially real destination;
- keeps the demo deterministic and repeatable;
- preserves the shipped meaning of prepared, reviewed, handed off, sent, delivered, received, and booked;
- focuses the portfolio story on governance rather than provider setup; and
- leaves a future exact self-destination contract possible if live handoff later proves essential.

Calendar remains disabled. A blocked external destination is successful evidence when the product explains the boundary and preserves useful internal work.

### Target experience

Starting from the verified synthetic invoice:

1. Rosa sees a confirmation that the document is part of trusted care history.
2. TomoCare offers the already eligible **Create Librela reminder** and **Remind me to file insurance claim** actions.
3. Rosa creates each internal reminder with an explicit action.
4. Dashboard and Attention show the resulting governed work once, with source-linked evidence and no duplicate action.
5. Chat and Voice can explain what needs attention and why.
6. Tomo can prepare one appointment-request preview from the verified Librela state.
7. The preview remains editable and clearly unsent.
8. Demo mode offers review or copy fallback only and explains that no clinic destination is configured.
9. Calendar and native Messages execution remain blocked before provider access.
10. Reset removes the message-derived reminders, actions, previews, and related orchestration state, then replay produces the same logical result.

### Smallest technical decisions

#### Reuse existing internal actions

Use the existing Librela reminder and insurance-claim reminder routes and idempotency contracts. Do not create demo-only reminder tables, fake completion, or a general scenario-action simulator.

#### Review-only communication boundary

Reuse the existing appointment-request preparation and human-review model. In demo mode, expose an explicit unavailable-destination state and safe copy fallback without constructing or opening a live recipient URI.

Do not store a fictional number that could resolve to a real person. Do not reuse Momo's real clinic contact.

#### Shared Attention, Chat, and Voice truth

The created reminders and any prepared draft must enter the same Attention and grounded-assistant contracts used by real care. UI, Chat, and Voice should agree on status, due date, source, and required human step.

#### Idempotency and reset

Repeated action selection should reuse or update the governing reminder/action rather than duplicate it. Extend the existing manifest-derived reset relationship only when a new persisted row is genuinely created by this scenario.

#### External execution remains closed

Do not open Calendar or Messages provider authority for this slice. The runtime boundary must reject execution before any provider call, and the user-facing state must explain that the reviewed work remains inside TomoCare.

### Acceptance criteria

1. The follow-through starts only from the verified manifest-owned invoice.
2. One Librela reminder and one insurance reminder can be created through existing governed routes.
3. Each reminder retains the verified invoice or derived Librela event as governing evidence.
4. Repeated creation does not duplicate reminders or actions.
5. Attention surfaces the resulting work with a direct path to its governing state.
6. Chat and Voice explain the same reminder status and due dates from trusted records.
7. The appointment-request preview is editable, explicitly unsent, and grounded in the verified Librela event.
8. No real or fictional live recipient is stored or exposed.
9. Demo Calendar and Messages execution fail closed before provider access.
10. The UI presents blocked execution as an intentional demo boundary, not an unexplained error.
11. Reset removes the message-derived reminders, actions, handoffs, and orchestration records without broad deletion.
12. Post-reset replay produces the same logical follow-through state.
13. Real-care reminder, Calendar, Messages, action, Chat, Voice, and reset behavior remains unchanged.
14. Focused tests, affected regressions, syntax checks, ESLint, production build, and manual acceptance pass.

### Manual acceptance path

1. Reset and replay the accepted synthetic invoice through verification.
2. Create the Librela reminder from the confirmation/action experience.
3. Create the insurance-claim reminder.
4. Confirm each appears once in Dashboard and Attention.
5. Ask Chat and Voice what needs attention and confirm both explain the same records.
6. Prepare the Librela appointment-request preview.
7. Edit and review the draft without marking it sent.
8. Exercise the unavailable Calendar and Messages paths and confirm the product explains both boundaries.
9. Repeat the reminder and draft actions and confirm no duplicates.
10. Reset twice and confirm the original baseline returns.
11. Replay the source and follow-through once and confirm the same logical end state.

### Explicitly out of scope

- A live demo clinic, phone number, email recipient, Calendar, or Messages destination
- Native Messages launch, actual send, delivery, reply interpretation, or appointment booking
- Fake provider success, fake delivery receipts, or fake booked state
- General-purpose demo action simulation
- A second document, scenario, pet, clinic, or insurer
- New reminder categories, medical intelligence, care recommendations, or preventive lifecycle
- Automatic action creation from candidate or verified truth
- Final animation, Voice, responsive, transition, or visual polish
- Screenshots, recording, narration, case-study production, release tag, or portfolio freeze

## Recommended branch

After this closeout is reviewed, committed, and pushed on `main`, create:

```bash
git switch -c governed-follow-through-demo-checkpoint
git push -u origin governed-follow-through-demo-checkpoint
```

## Pasteable opening message for the next implementation chat

```text
We completed Synthetic Veterinary Documents and Demo-Safe Gmail Intake across Gates 1–3 and merged it to main at ceba812.

Use docs/Synthetic_Documents_Gmail_Closeout_and_Governed_Follow_Through_Handover.md as the current implementation handover, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for the accepted portfolio sequence, docs/TomoCare_Operating_Brief.md for durable product and governance principles, docs/Demo_Environment_Setup_and_Reset.md for the environment contract, and current code, migrations, and tests as implementation truth.

We are beginning the bounded Governed Follow-Through Demo Checkpoint.

Carry the verified manifest-owned invoice into the existing eligible Librela reminder, insurance-claim reminder, Attention, Chat, Voice, and appointment-request preview contracts. Use a review-only or copy-fallback communication path in demo mode. Keep the preview editable and explicitly unsent, and keep Calendar and native Messages execution blocked before provider access.

Reuse the real product's reminder, action, assistant, orchestration, idempotency, and reset architecture. Preserve exact source evidence and truthful states across UI, Chat, and Voice. Extend manifest-derived reset relationships only for persisted rows genuinely created by this scenario.

Do not configure or store a real or fictional live recipient; reuse Momo's real clinic, Calendar, or Messages destination; add providers; fake send, delivery, reply, or booking; add another document or scenario; automatically create actions; expand medical intelligence; begin final animation/UI polish; capture portfolio evidence; update the case study; or tag a release.
```
