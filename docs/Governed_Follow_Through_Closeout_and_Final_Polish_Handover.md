# TomoCare Current State: Governed Follow-Through Closeout and Final Polish Handover

**Closeout date:** September 10, 2026

**Current branch:** `main`

**Implementation commit:** `1fd08a7` — `feat(demo): add governed follow-through`

**Merged to main:** `077daa7` — `Merge governed follow-through demo checkpoint`

**Completed slice:** Governed Follow-Through Demo Checkpoint

**Next bounded slice:** Final Voice, Animation, and End-to-End UI Polish

## Purpose

This handover closes the final functional checkpoint in the TomoCare portfolio demonstration and defines the smallest presentation-focused slice before evidence capture and portfolio freeze.

The portfolio path now demonstrates the complete governed loop: an exact fictional source enters through a bounded Gmail contract, AI proposes candidate truth, Rosa corrects and verifies it, TomoCare materializes source-linked trusted records, the shared product surfaces explain what needs attention, and Tomo prepares useful follow-through without claiming that an external action occurred.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. The hosted demo database and Rosa's accepted manual reset, intake, verification, follow-through, and replay results
3. This handover for the next bounded slice
4. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md)
5. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md)
6. [Demo Environment Setup and Reset](./Demo_Environment_Setup_and_Reset.md)
7. [Synthetic Documents/Gmail Closeout and Governed Follow-Through Handover](./Synthetic_Documents_Gmail_Closeout_and_Governed_Follow_Through_Handover.md)
8. Current migrations, schema references, and earlier handovers for implementation history

When an older document conflicts with current code, tests, migrations, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Shipped result

### Verified source creates eligible follow-through

- The follow-through begins only after the manifest-owned fictional invoice has been corrected, explicitly verified, and materialized through the shared product path.
- The verified September 7, 2026 Librela administration is the trusted basis for the next Librela reminder.
- The verified invoice is the governing source for the insurance reminder.
- Demo mode uses the generic label **Pet insurance** rather than a real provider name.
- No reminder or draft is created from candidate truth alone.

### Internal reminder actions remain governed and idempotent

- Rosa explicitly chooses **Create Librela reminder** and **Remind me to file insurance claim** from the existing post-verification action experience.
- The Librela reminder is scheduled for October 19, 2026, with the next injection due around October 26, 2026.
- The insurance reminder is scheduled for October 7, 2026.
- Repeating either action returns the existing governing state rather than creating duplicate reminders or actions.
- Existing real-care reminder, action, reconciliation, and eligibility contracts remain unchanged.

### Dashboard, Attention, Chat, and Voice share the same truth

- Dashboard and Attention surface the scenario-derived reminders from the same persisted records.
- Chat and Voice explain the same reminder status, dates, and governing evidence.
- Attention supports today, tomorrow, this week, this month, named calendar months, and calendar years through deterministic date ranges.
- Asking **What needs my attention in October?** resolves to October 1–31, 2026 and includes both the October 7 insurance reminder and October 19 Librela reminder.
- A semantic interpretation cannot silently discard the named-month constraint.

### Appointment follow-through stops at an honest review boundary

- Tomo prepares one editable Librela appointment-request draft from the verified injection and reminder state.
- The draft identifies the trusted fictional clinic by name but exposes no phone number, address, recipient URI, or launch destination.
- The message includes the verified September 7 injection date and the cadence-based October 26 due date.
- Demo mode labels the experience **Review-only demo draft** and explains that nothing can be sent.
- Rosa may edit or copy the message, but the draft cannot be approved, handed off, or marked sent from demo mode.
- The UI renders the intended visibility icon rather than the literal Material Symbol name.

### External execution remains closed

- Demo Calendar and Messages actions fail closed before provider access.
- No real or fictional live recipient is configured or stored.
- The browser receives no clinic contact or launch URI for this path.
- TomoCare does not claim that the request was approved, sent, delivered, received, or booked.
- Review and copy are useful internal outcomes, not simulated provider success.

### Reset and replay remain deterministic

- Reset removes the message-derived Librela and insurance reminders and their related governed action and orchestration state.
- Reset remains limited to manifest-derived identifiers, relationships, and the one exact removable Storage object.
- It does not list or sweep broad prefixes, delete the retained Gmail source, or affect real-care state.
- Replaying the source after reset returns the same logical trusted and follow-through state.

## Validation evidence

Rosa confirmed on September 10, 2026:

- `npm run test:demo-follow-through` passed all 147 tests;
- `npm run test:phase3e3` passed all 138 tests;
- `npm run test:demo-environment` passed all 32 tests;
- ESLint passed for every changed JavaScript file;
- the production build succeeded;
- the Librela and insurance actions each produced one reminder;
- Dashboard, Attention, Chat, and Voice agreed on the resulting work;
- the exact October attention question returned the October reminders;
- the appointment request displayed as an editable review-only draft with no live destination;
- the visibility icon rendered correctly;
- repeated actions did not create duplicates;
- Calendar and Messages remained blocked; and
- reset and replay restored the expected logical scenario.

The first manual run exposed two defects before merge. Named-month Attention accepted the language but discarded the future calendar range, and the appointment dialog's `visibility` symbol was missing from the restricted Material Symbols request. Both were corrected, covered by regression tests, rebuilt, and manually accepted before commit `1fd08a7` and merge `077daa7`.

No database migration, environment-variable change, new provider, real recipient, live Calendar destination, or live Messages destination was added.

## Portfolio value now demonstrated

The three connected portfolio stories are functionally complete:

1. **Messy source to trusted memory:** a bounded synthetic Gmail source becomes editable candidate truth and then source-linked trusted records only after human correction and approval.
2. **Trusted memory to useful intelligence:** Dashboard, Attention, Chat, and Voice explain the same verified care state, weight history, evidence, and required work.
3. **Intelligence to governed follow-through:** TomoCare creates explicitly requested internal reminders and prepares an editable clinic-request draft while preserving the difference between reviewed work and external execution.

This completes the strongest end-to-end proof of the TomoCare thesis:

> AI can prepare; human approves.

The next work should make this existing behavior easier to understand and demonstrate. It should not add another product capability before the portfolio checkpoint is captured.

## Current intentional boundaries

- The demo uses one manifest-owned fictional Gmail message, one PDF, one pet, one clinic, and one scenario.
- Calendar and Messages have no live demo destination.
- The appointment draft remains review-only and cannot prove sending, delivery, response, or booking.
- Live animation remains optional and provider-dependent; static media, local motion, and local Voice remain the accepted fallback.
- The current local motion language covers idle, acknowledgment, listening, and thinking. Meaning-based `happy`, `laughing`, and `oops` reactions remain presentation work only.
- Broader Inbox, Recently verified, appointment aggregation, preventive lifecycle, laboratory intelligence, and other real-care expansion remain separate later slices.
- Portfolio screenshots, recordings, final case-study updates, and release tagging have not started.

## Revised near-term sequence

1. **Final Voice, Animation, and End-to-End UI Polish**
2. **Demo Evidence, Case Study, and Portfolio Checkpoint Freeze**
3. **Broader preventive and health-intelligence work as later bounded Real-Care slices**

## Next bounded slice: Final Voice, Animation, and End-to-End UI Polish

### User problem

The three portfolio stories now work, but a successful interview demonstration depends on more than functional correctness. Voice state changes, local motion, optional live animation, drawers, transcripts, review dialogs, recovery messages, and responsive layouts must read as one intentional experience. Any visual break, abrupt transition, dead end, clipping issue, or ambiguous state can distract from the governance story Rosa needs to present.

The next slice should polish only the existing portfolio path. It should not add new care intelligence, sources, records, actions, destinations, or providers.

### Product decision for portfolio v1

Treat polish as a governed product-quality pass over the three accepted demo stories, not as a redesign.

Use the existing Tomo character, local motion assets, optional Runway animation, Voice and Chat transcript, care navigation, verification flow, Attention results, reminder actions, and review-only appointment draft. Improve continuity and clarity where the current experience makes a state change or next step difficult to understand.

Meaning-based character reactions may be added only when they are deterministic, harmless, and presentation-only. They must never change facts, medical restraint, answer type, action status, or tool authority.

### Target experience

1. Reset produces the accepted baseline and the app enters the demo in a stable, presentation-ready state.
2. The source-to-memory path has clear transitions between Inbox, review, correction, recheck, verification, confirmation, and trusted evidence.
3. The trusted-memory path makes Chat and Voice state changes legible without hiding citations, charts, limitations, or the shared transcript.
4. Listening, thinking, speaking, playback, and idle transitions feel continuous across local motion and optional live animation.
5. Starting, ending, failing, and retrying live animation remain visibly distinct while local Voice continues once.
6. The follow-through path moves clearly from post-verification actions to Dashboard and Attention, then to the editable review-only appointment draft.
7. Dialogs, drawers, controls, icons, focus order, scrolling, and narrow layouts remain usable throughout the complete journey.
8. The user can always understand what happened, what is waiting, what can be done next, and what TomoCare will not do.

### Smallest technical decisions

#### Preserve current architecture

Do not redesign the application shell or replace the current Voice, animation, transcript, navigation, verification, assistant, reminder, or draft contracts. Fix presentation seams in the components that already own them.

#### Treat state continuity as the primary polish target

Use the existing typed Voice and avatar states as the source of truth. Transitions and motion should reflect `idle`, `listening`, `thinking`, `speaking`, live-ready, intentional ending, and bounded failure states without introducing a second state machine.

#### Keep local fallback complete

Static media, local motion, transcript, and local audio must remain sufficient to demonstrate the story when Runway or LiveKit is unavailable. Provider-dependent animation may improve the presentation but cannot become required for comprehension or completion.

#### Polish the accepted demo path first

Prioritize defects observed while rehearsing the three exact portfolio stories. Do not use this slice for general component-library work, broad visual redesign, or unrelated cleanup.

#### Add presentation contracts where regressions would be costly

Protect important transitions, responsive states, accessible labels, icon loading, scroll behavior, reduced motion, and fallback behavior with focused tests. Keep factual and operational behavior under the existing regression suites.

### Acceptance criteria

1. The three accepted demo stories can be completed from a fresh reset without a visual dead end or unclear next step.
2. Voice visibly distinguishes idle, listening, thinking, speaking, and playback completion.
3. Local motion transitions do not flash, restart unnecessarily, loop unintentionally, or cover the transcript and evidence.
4. Optional live animation starts and ends intentionally, and typed failure or session-expiry states retain one clear retry or local-only path.
5. A live-animation failure never suppresses, replays, resynthesizes, or duplicates the grounded answer or local audio.
6. Voice and Chat continue to share one session transcript, and the transcript remains usable with citations, weight charts, Attention cards, and review content.
7. Inbox, VerifyDocs, Dashboard, Attention, Profile, reminder, and appointment-draft surfaces use consistent hierarchy, spacing, controls, dates, icons, and state language along the demo path.
8. Drawers and dialogs fit supported desktop and narrow layouts without clipped primary actions, inaccessible close controls, hidden evidence, or trapped scrolling.
9. Keyboard focus, control names, status announcements, contrast, and Reduced Motion behavior remain accessible.
10. Meaning-based reactions, if included, are deterministic and presentation-only and cannot alter a factual answer, safety boundary, care state, or external authority.
11. Demo mode remains visibly labeled and cannot access real records, contacts, Calendar, or Messages destinations.
12. Existing source, candidate, trusted, reminder, action, assistant, reset, idempotency, and provider-boundary behavior remains unchanged.
13. Focused presentation tests, affected regressions, ESLint, the production build, and manual rehearsal pass.

### Manual acceptance path

1. Reset the demo twice and begin from the accepted baseline.
2. Run the exact synthetic Gmail intake and verify the expected Inbox transition.
3. Review the invoice, make the invoice-number correction, recheck it, and explicitly verify it.
4. Inspect the confirmation and trusted evidence in Dashboard, Chat, and Voice.
5. Ask for the weight trend and confirm the chart, citations, transcript, and spoken summary remain usable.
6. Create the Librela and insurance reminders and confirm their state in Dashboard and Attention.
7. Ask **What needs my attention in October?** in Chat and Voice.
8. Prepare, edit, and copy the review-only Librela appointment request without exposing or executing a destination.
9. Exercise local Voice across idle, listening, thinking, speaking, stop, replay, mute, transcript collapse, and Chat switching.
10. Start and intentionally end Animate Tomo when available.
11. Exercise one typed animation failure or recorded fallback and confirm local Voice continues exactly once.
12. Repeat the path at the agreed desktop and narrow widths and with Reduced Motion enabled.
13. Confirm no real-care record, source, contact, Calendar, Messages destination, or provider state changes.

### Explicitly out of scope

- New document types, demo messages, scenarios, pets, clinics, insurers, or source fixtures
- New trusted record types, care intelligence, medical interpretation, reminders, or action categories
- Database migrations, schema changes, data backfills, or reset-scope expansion
- New AI, Voice, animation, Calendar, messaging, or extraction providers
- Live demo Calendar or Messages configuration
- Automatic messaging, delivery tracking, reply interpretation, or appointment booking
- A visual rebrand, new Tomo character, new avatar model, or general design-system rebuild
- Broad assistant coverage for Inbox, Recently verified, appointments, or other visible product areas
- Portfolio screenshots, video recording, scripted narration, case-study production, or release tagging
- Broader preventive, laboratory, imaging, medication-refill, or Real-Care expansion

## Recommended branch

After this closeout is reviewed, committed, and pushed on `main`, create:

```bash
git switch -c final-voice-animation-ui-polish
git push -u origin final-voice-animation-ui-polish
```

## Pasteable opening message for the next implementation chat

```text
We completed the Governed Follow-Through Demo Checkpoint and merged it to main at 077daa7. The feature commit is 1fd08a7.

Use docs/Governed_Follow_Through_Closeout_and_Final_Polish_Handover.md as the current implementation handover, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for the accepted portfolio sequence, docs/TomoCare_Operating_Brief.md for durable product and governance principles, docs/Demo_Environment_Setup_and_Reset.md for the environment contract, and current code and tests as implementation truth.

We are beginning the bounded Final Voice, Animation, and End-to-End UI Polish slice.

Rehearse the three existing portfolio stories from a fresh reset. Improve only the Voice and animation transitions, responsive behavior, visual consistency, accessibility, recovery clarity, and interaction continuity required to make those stories presentation-ready. Reuse the current Voice, local-motion, optional live-animation, transcript, navigation, verification, Attention, reminder, and review-only draft contracts.

Keep local Voice and static/local-motion fallback complete when live animation is unavailable. Any meaning-based reaction must be deterministic, harmless, and presentation-only. Preserve the current source, candidate, trusted, action, reset, idempotency, and provider boundaries.

Do not add care capabilities, source types, trusted records, reminders, action categories, providers, destinations, database changes, medical intelligence, autonomous behavior, a visual rebrand, portfolio capture, case-study production, or release tagging in this slice.
```
