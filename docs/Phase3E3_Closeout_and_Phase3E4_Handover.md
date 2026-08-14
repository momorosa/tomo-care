# TomoCare Current State: Phase 3E.3 Closeout and Phase 3E.4 Handover

**Prepared:** August 14, 2026

**Owner:** Rosa Choi

**Current branch:** `main`

**Phase 3E.3 merge checkpoint:** `644c86a` — `Merge Phase 3E.3 attention and governed navigation`

**Phase 3E.3 implementation:** `d3810dc` — `feat(phase-3e-3): add governed attention navigation`

**Phase 3E.3 response refinement:** `37a414f` — `feat(phase-3e-3): add governed attention navigation response refinements`

## Purpose

This is the current handover for work after Phase 3E.3. It records what shipped, the evidence Rosa reviewed, the boundaries that must remain intact, and the next bounded slice. At the verified checkpoint, `main` and `origin/main` both pointed to `644c86a`.

The local `.claude/` directory remains intentionally untracked and is not product source.

## Product in one paragraph

TomoCare is a personal, single-user governed AI pet-care assistant for Rosa and Momo. It preserves source documents, separates model-extracted candidate truth from human-verified trusted truth, answers from trusted records, and routes consequential changes through explicit approval. Its durable rules remain: **AI can prepare; human approves** and **LLM interprets; database calculates; citations prove**.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. Current database and persisted action state
3. This handover for settled product decisions and next-slice scope
4. The TomoCare Product Roadmap and Portfolio Checkpoint for accepted sequencing and portfolio scope
5. The TomoCare Operating Brief for durable principles
6. Earlier handovers and phase notes for historical context

When an older document conflicts with current code, tests, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Product-roadmap decision recorded after Phase 3E.3

On August 14, 2026, Rosa accepted a two-track delivery strategy for TomoCare:

- Keep **one product and one codebase**.
- Continue the long-term **real-care track** toward a comprehensive health sidekick for Momo.
- Create a bounded **portfolio track** as a stable, polished checkpoint of the same governed product.
- Use separate, resettable synthetic demo data and demo-safe external destinations rather than preserving an intentionally unverified real invoice or demonstrating against Momo's live care state.
- Finish Phase 3E.4 first, then prioritize the demo environment, risk-weighted verification, bounded vaccine-status capture, verified weight visualization, and Voice/UI recovery polish before freezing portfolio v1.
- Defer complete vaccine and refill lifecycles, annual labs, urinalysis, imaging, and broad medical-document intelligence until after the portfolio checkpoint unless a later bounded contract promotes them.

The full decision, rationale, roadmap order, demo-data policy, and portfolio definition of done are recorded in [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md).

This decision does not change the already bounded Phase 3E.4 contract below. It changes the accepted sequence after Phase 3E.4 and provides a deliberate portfolio finish line inside the real product journey.

## Shipped capability through Phase 3E.3

| Phase | Shipped result |
| --- | --- |
| **0 — Working Brain** | Private source storage, auditable raw text, candidate extraction, trusted materialization, deterministic Librela scheduling, and idempotent Google Calendar sync. |
| **1 — Verification UI** | Side-by-side source review, AI field triage, editable candidate truth, draft/verify flows, and human-controlled promotion to trusted records. |
| **2 — Care Desk** | Gmail intake, care/review/reminder surfaces, post-verification recommendations, persistent reminders, and approval-gated Calendar follow-through. |
| **3A — Grounded Assistant** | Trusted-record retrieval, deterministic answer composition, citations, bounded schedule/spend/weight/medication/timeline coverage, and safety abstention. |
| **3B — Governed Actions** | Shared action ledger, explicit approval lifecycle, atomic trusted writes, retry/recovery behavior, and separate user-initiated Calendar follow-through. |
| **3C — Approved Messaging Foundation** | Exact-message approval, durable workflow state, safe mock delivery, provider boundary, and truthful separation of approval, delivery, and replies. |
| **3D — Conversational Tomo** | Shared Voice/Chat session, bounded semantic interpretation and personality, conversation-centered home, local motion, optional Runway/LiveKit animation, and safe fallbacks. |
| **3E.0a–3E.0e** | Verification eligibility and authorization recovery, Librela reconciliation, Calendar recovery, verified weight materialization, and the golden Librela lifecycle. |
| **3F — Apple Messages** | Server-verified recipient, exact approved message, native editable Messages draft, copy fallback, and truthful handoff intent. Rosa remains the sender. |
| **3E.1a** | Golden Librela-to-Messages lifecycle from trusted records through grounded answer, draft, verified recipient, approval, and native handoff intent. |
| **3E.2** | Shared closed-loop home-medication lifecycle for Simparica and Adequan, including trusted completion, successor scheduling, Calendar follow-through, grounded answers, and idempotency. |
| **3E.3** | Governed attention across qualifying reminders, care actions, and review documents, with deterministic ranking and time windows, natural Chat and Voice summaries, and navigation to the governing TomoCare or Calendar destination. |

## Phase 3E.3 shipped contract

### User outcome

Rosa can ask Tomo what needs attention without memorizing one exact phrase. Tomo can also answer bounded follow-ups for today, tomorrow, this week, and this month.

The guaranteed phrase family includes questions such as:

- What needs my attention?
- Do I need to do anything?
- Anything I need to review or handle?
- What should I take care of next?
- Is anything waiting for me?

Meaning-based interpretation may map additional equivalent language to the same governed intent. Broad prompts such as “What’s new?” and “What do I need to know?” remain ambiguous. Tomo asks whether Rosa wants attention items, recently verified records, or another part of Momo’s care instead of inventing an update.

### Governed sources

The first attention contract uses three independent server-owned sources:

- Supported planned reminders that qualify under deterministic timing rules
- Care actions in `proposed`, `approved`, `executing`, or `outcome_unknown`
- Documents in `needs_review`, using metadata only

A review document is governed workflow state, but its extracted contents remain candidate truth. Tomo may identify the document and open its review record. It may not present candidate contents as verified facts.

If one source is unavailable, Tomo discloses the limitation and still returns supported items from the available sources. If all three are unavailable, Tomo returns an unavailable state rather than a false “nothing needs attention” answer.

### Qualification, timing, and rank

Reminder timing is recalculated from the current care date. Cached labels and model judgment do not establish urgency.

- Home medications qualify when due now or overdue.
- Librela qualifies when its reminder window is open or its due date is overdue.
- Insurance qualifies when filing is due or the final claim window has expired.
- Unknown reminder shapes do not qualify.

Time-window behavior is deterministic:

- **Today:** current overdue, due, pending, and review work
- **Tomorrow:** reminders whose activation date is tomorrow; current actions and review documents are not misrepresented as tomorrow-dated work
- **This week:** current work plus reminders becoming active through Sunday
- **This month:** current work plus reminders becoming active through the last day of the current month

Unbounded questions return current governed work only. Tomo returns no more than five items, ordered by explicit priority, effective date, creation time, and stable record identity.

### Natural answer and Voice behavior

Phase 3E.3 originally returned accurate but mechanical language such as repeated medication names and “scheduled for confirmation during this period.” The refinement now:

- Names each item once
- Uses the exact due date or reminder date
- Explains the expected confirmation or review in plain language
- Keeps the written answer complete
- Gives Voice a complete bounded summary instead of cutting off after two item sentences
- Says when remaining items are listed on screen if the full result exceeds the speech budget

Chat and Voice preserve the same facts, ordering, limitations, and navigation boundary. Presentation may be shorter in Voice, but it cannot change the governed result.

### Governed navigation

An attention item may expose only these typed navigation commands:

- `open_reminder`
- `open_care_action`
- `open_review_document`
- `open_calendar_event`
- `open_calendar_home`

Internal destinations are built from typed record identifiers. A qualifying reminder may open its stored Google Calendar event. Without a stored event URL, Tomo opens Google Calendar generically and does not imply that a specific event exists.

Navigation changes view state or opens an allowlisted destination. It does not create, edit, approve, complete, retry, sync, book, or send anything.

## Phase 3E.3 validation and user evidence

Rosa reported:

- Phase 3E.3 focused tests passed: `107/107`
- Voice composition tests passed: `7/7`
- Full repository regression passed
- Production build succeeded
- Manual testing confirmed that natural paraphrases routed correctly
- Manual testing confirmed exact today, tomorrow, this-week, and this-month results
- Manual testing confirmed that the refined response was accurate, natural, and easier to understand

Phase 3E.3 required no database migration and no new environment variable.

## Current governance boundaries

Preserve these rules:

- Only trusted records may support factual care answers and operational calculations.
- Governed workflow state may support status and navigation without promoting candidate contents to truth.
- Screen text, loose chat memory, and model inference are not authority.
- The model may interpret language; deterministic code decides state, dates, rank, freshness, and idempotency.
- A proposed action is not approved, and an approved action is not necessarily complete.
- A reminder is not a completed treatment, and a target date is not a confirmed appointment.
- Navigation grants no write authority.
- External integrations must report unavailable, stale, failed, or unknown state honestly.
- Character, voice, and personality may change presentation but not facts, medical restraint, or tool authority.

## Enhancement backlog

### Animate Tomo reliability and recovery

Animate Tomo sometimes fails silently and falls back to local voice without lip-sync. The fallback preserves the answer and speech, so this did not block Phase 3E.3.

A later reliability slice should:

- Surface a clear, non-blocking fallback status
- Retain a typed failure reason for diagnosis
- Offer a safe retry without restarting the conversation
- Inspect the Runway worker, LiveKit session, media-track, timeout, and disconnect boundaries
- Preserve uninterrupted local voice when live animation is unavailable

This is a presentation-provider reliability problem. It must not change grounded answers, speech content, action state, or care data.

### Other deferred work

- Stored Inbox question coverage and navigation
- Deeper Recently verified follow-up beyond the existing recent-document list
- Appointment-state aggregation
- Durable Calendar-failure recovery state
- Meaning-based `happy`, `laughing`, and `oops` reactions
- Weight-trend visualization
- Durable conversation history or broad relational memory
- Multi-agent roles without a demonstrated permission, responsibility, or coordination boundary

## Next bounded slice: Phase 3E.4 — Governed Profile Grounding

### User questions

> Tomo, what do you know about Momo?

The same bounded intent should cover direct field questions such as:

- How old is Momo?
- What breed is Momo?
- When is Momo’s birthday?
- Is Momo spayed?
- What is in Momo’s profile?

“How is Momo?” is not automatically a Profile question. It may ask for current health or a medical judgment. Tomo should clarify the intended topic rather than converting it into an identity summary.

### Product objective

Make Tomo’s answer agree with the Profile panel by grounding identity facts in the current `pets` row. Keep those governed fields separate from the versioned relationship profile that gives Tomo harmless personal context about Momo’s personality and family role.

This is the smallest next slice because the Profile panel is already visible and the assistant currently answers “What do you know about Momo?” from a static relationship profile without loading the current pet record. The answer is personable, but identity facts can drift from the product’s server-owned state.

### First-slice source and fields

Use the current `pets` row as the governing profile record. Support only:

- `name`
- `species`
- `breed`
- `birth_date`
- Calculated age
- `sex`
- `spayed_neutered`

Calculate age from `birth_date` and the current TomoCare care date. Do not store or hardcode age. Birthday-boundary behavior must be deterministic and tested.

The current Profile panel also shows Primary clinic and Insurance as static presentation values. Those labels are not part of this grounded contract. Tomo must not claim them from the pet record unless a later slice identifies and models a trusted source.

### Proposed response contract

Add a deliberate `profile_summary` answer with:

```text
profile_fields:
  name
  species
  breed
  birth_date
  age
  sex
  reproductive_status
governing_reference:
  table: pets
  record_id
navigation_targets:
  - kind: open_profile
```

The response should:

1. Read current values from the server-owned pet record.
2. Calculate age deterministically from the current care date.
3. State missing fields plainly rather than filling them from general knowledge or the relationship profile.
4. Keep relationship details clearly separate from governed profile fields.
5. Return no medical conclusion, care recommendation, or inferred current health status.
6. Use the same profile facts in Chat and Voice.
7. Open the existing Profile panel through typed navigation only.

### Relationship-profile boundary

The versioned relationship profile may still add harmless details such as Momo being a beloved ball-catching family queen. It may not:

- Replace a missing `pets` field
- Override a conflicting `pets` value
- Become medical evidence
- Add a diagnosis, treatment conclusion, or current health claim
- Create a database write or profile edit

When governed and relationship details appear in one answer, the governed profile summary remains an unchanged, testable body. Personal color may appear only around it.

### Language behavior

Guarantee deterministic routing for the direct Profile phrase family. Meaning-based interpretation may map additional read-only paraphrases into the same contract.

Ambiguous wellness questions, symptom questions, and requests to change Profile data must not route silently into `profile_summary`. They should use the existing clarification, medical, or governed-action boundary.

### Acceptance tests

- Profile answers use the current `pets` row rather than hardcoded identity facts.
- Age is correct immediately before, on, and after Momo’s birthday.
- Missing birth date produces an honest unknown-age response.
- Missing optional fields remain missing and are not filled from the relationship profile.
- A current `pets` value wins if it differs from a relationship-profile detail.
- “What do you know about Momo?” and direct age, breed, birthday, sex, and spay-status questions route correctly.
- “How is Momo?” asks for clarification or preserves the appropriate health boundary.
- Profile navigation opens the existing Profile panel and calls no mutation endpoint.
- Chat and Voice preserve the same governed fields and limitations.
- Existing attention, medication, Librela, Apple Messages, safety, relationship, and voice regressions remain green.

### Explicitly out of scope

- Editing or correcting the pet profile
- Adding a new profile form or database migration
- Claiming Primary clinic or Insurance from current hardcoded UI labels
- Summarizing Momo’s full medical history
- Inferring present health, pain, urgency, or diagnosis
- Inbox or Recently verified expansion
- Durable relationship memory
- Meaning-based reactions
- Animate Tomo reliability work
- Multi-agent orchestration

### Suggested implementation order

1. Inspect the `pets` schema, current dashboard summary query, Profile panel, and existing `momo_profile` social route.
2. Agree on the `profile_summary` fields, missing-data language, and `open_profile` navigation command.
3. Add a narrow server-side profile loader rather than loading broad trusted context.
4. Add deterministic age calculation using the TomoCare care date.
5. Separate governed profile facts from optional relationship framing.
6. Add the Profile navigation handler without an edit or mutation path.
7. Add focused tests and run the full regression suite before user testing.

## Suggested branch and startup checks

After this documentation reconciliation is committed on `main`:

```bash
git switch main
git pull --ff-only
git switch -c phase-3e-4-governed-profile
git status --short
git log --oneline -5
```

Inspect before implementation:

- `pets` schema and repository queries
- Dashboard summary profile fields
- `CareSidebar.jsx` Profile presentation
- Existing `momo_profile` deterministic and semantic routing
- Relationship-profile boundaries and tests
- Chat/Voice shared answer path
- Typed dashboard navigation introduced in Phase 3E.3

Do not implement until the Profile response schema, source fields, missing-data behavior, relationship boundary, navigation command, and acceptance tests are agreed.

## Validation expectation for Phase 3E.4

Add a focused script such as:

```bash
npm run test:phase3e4
```

Then run the full recursive inventory and production build:

```bash
find server src -type f -name '*.test.js' -print0 | xargs -0 node --test
npm run build
git diff --check
```

Use syntax and ESLint checks for every changed JavaScript file. Stop before commit so Rosa can apply the package, run the checks, and test the Profile answers herself.

## Paste-ready prompt for the next chat

```text
I am continuing TomoCare from the shipped Phase 3E.3 checkpoint.

Current source of truth:
- Phase 3E.3 merge checkpoint: 644c86a — Merge Phase 3E.3 attention and governed navigation
- Phase 3E.3 implementation: d3810dc — feat(phase-3e-3): add governed attention navigation
- Phase 3E.3 response refinement: 37a414f — feat(phase-3e-3): add governed attention navigation response refinements
- Focused tests passed 107/107, Voice composition passed 7/7, the full regression passed, and the production build succeeded.
- Manual testing confirmed natural paraphrase coverage, correct attention windows, governed navigation, and the refined natural response.
- .claude/ remains intentionally untracked and must stay out of delivery packages.

Read docs/Phase3E3_Closeout_and_Phase3E4_Handover.md first and follow docs/TomoCare_Operating_Brief.md.

We are starting Phase 3E.4 — Governed Profile Grounding.

The first bounded question is: “Tomo, what do you know about Momo?” Direct questions about age, breed, birthday, sex, spay status, and the Profile should use the same governed contract.

Before changing code, inspect the current pets schema, dashboard Profile source, existing momo_profile route, relationship profile, shared Chat/Voice path, and Phase 3E.3 typed navigation.

Confirm before implementation:
1. the exact pets fields supported by profile_summary,
2. deterministic age calculation and birthday behavior,
3. honest missing-field language,
4. the boundary between governed pets data and harmless relationship context,
5. the open_profile navigation command,
6. ambiguous health and profile-edit boundaries, and
7. the dedicated Phase 3E.4 test plan.

Do not implement until we agree on that bounded contract. Do not include Profile editing, clinic or insurance modeling, medical inference, Inbox expansion, Recently verified expansion, reactions, avatar reliability work, durable memory, or multi-agent orchestration in this slice.

Use the standard TomoCare delivery when implementation begins: repo-relative ZIP, individual file links, exact file list, validation commands and observed results, migration and environment notes, known limitations, and stop before commit.
```
