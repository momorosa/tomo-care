# TomoCare Current State: Phase 3E.2 Closeout and Phase 3E.3 Handover

**Prepared:** August 13, 2026

**Owner:** Rosa Choi

**Current branch:** `main`

**Phase 3E.2 merge checkpoint:** `93e9308` — `Merge Phase 3E.2 home medication lifecycle`

**Phase 3E.2 slice:** `53c9b35` — `test(phase-3e-2): prove home medication closed loop`

## Purpose

This is the current-state handover for starting Phase 3E.3 in a new working session. It captures the product and governance decisions shipped through Phase 3E.2, the verified repository checkpoint, the boundaries that must not regress, and the agreed next slice. The Phase 3E.2 merge hash above is the code checkpoint reviewed before this documentation-only reconciliation on `main`.

The repository was back on `main`, the Phase 3E.2 merge was present on `origin/main`, the test suite passed, and the production build succeeded. The local `.claude/` directory was intentionally left untracked and is not part of the product source.

## Product in one paragraph

TomoCare is a personal, single-user governed AI pet-care assistant for Rosa and Momo. It preserves source documents, separates model-extracted candidate truth from human-verified trusted truth, answers from trusted records with citations, and routes consequential changes through explicit approval. The durable rules remain: **AI can prepare; human approves** and **LLM interprets; database calculates; citations prove**.

## Source-of-truth hierarchy

Use these sources in this order:

1. Current code and tests on `main`
2. Current database and persisted action state
3. This handover for settled product decisions and next-slice scope
4. The TomoCare Operating Brief for durable principles
5. Earlier phase notes for historical context only

If an older note conflicts with current code, tests, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Shipped capability through Phase 3E.2

Phase numbering identifies capability families; delivery order has not always been strictly numeric.

| Phase | Shipped result |
| --- | --- |
| **0 — Working Brain** | Private source storage, auditable raw text, candidate extraction, trusted materialization, deterministic Librela scheduling, and idempotent Google Calendar sync. |
| **1 — Verification UI** | Side-by-side source review, AI field triage, editable candidate truth, draft/verify flows, and human-controlled promotion to trusted records. |
| **2 — Care Desk** | Gmail intake, care/review/reminder surfaces, post-verification recommendations, persistent reminders, and approval-gated Calendar follow-through. |
| **3A — Grounded Assistant** | Trusted-record retrieval, deterministic answer composition, citations/evidence, bounded schedule/spend/weight/medication/timeline coverage, and safety abstention. |
| **3B — Governed Actions** | Shared action ledger, explicit approval lifecycle, atomic trusted writes, retry/recovery behavior, and separate user-initiated Calendar follow-through. |
| **3C — Approved Messaging Foundation** | Exact-message approval, durable workflow state, safe mock delivery, provider boundary, and truthful separation of approval, delivery, and replies. |
| **3D — Conversational Tomo** | Shared Voice/Chat session, bounded semantic interpretation and personality, conversation-centered home, local motion, optional Runway/LiveKit animation, and safe fallbacks. |
| **3E.0a** | Post-verification recommendation eligibility hardening plus production-like Gmail and Calendar authorization recovery. |
| **3E.0b** | Librela trusted-state reconciliation and repair of the August 3 care state. |
| **3E.0c** | Honest Calendar recovery for Librela and insurance workflows; internal reminder state survives Calendar failure. |
| **3E.0d** | Trusted August 3 weight materialization, grounded weight answers and trend, latest profile weight, and bounded evidence-card presentation. |
| **3E.0e** | Golden Librela lifecycle and idempotency proof from trusted state through completion and the next governed state. |
| **3F — Apple Messages** | Server-verified recipient, exact approved message, native editable Messages draft, copy fallback, and truthful handoff intent. Rosa remains the sender. |
| **3E.1a** | Golden Librela-to-Messages lifecycle from trusted records through grounded answer, draft, verified recipient, approval, and native handoff intent. |
| **3E.2** | Shared closed-loop home-medication lifecycle for Simparica and Adequan, including trusted completion, successor scheduling, Calendar follow-through, dashboard state, grounded answers, and idempotency. |

## Phase 3E.2 shipped contract

Phase 3E.2 proved that home medications share a governed lifecycle rather than being one-off UI actions.

### Supported medications and settled rules

| Medication | Route | Cadence | Preferred weekday |
| --- | --- | --- | --- |
| Simparica | Oral chewable | 30 days | Monday |
| Adequan | Subcutaneous injection | 56 days | Monday |

Keep Adequan at 56 days unless a later verified care-plan change authorizes a different rule.

The dashboard wording remains **Mark as given**. That label does not constrain a later chat or voice interface. Natural language such as “I gave Simparica,” “I administered Adequan,” or Tomo asking whether the medication was given may map to the same governed action contract. The important boundary is not the exact phrase: Tomo must identify the intended medication and event, show or speak the proposed change, obtain explicit confirmation, and let the server perform the trusted write.

### Closed-loop behavior

For either supported home medication, an approved confirmation must:

1. Revalidate the current trusted reminder and medication state.
2. Record the administration once.
3. Complete the governing reminder once.
4. Create or reuse exactly one cadence-based successor reminder.
5. Return the persisted result for safe retries instead of duplicating state.
6. Preserve honest Calendar state and allow the existing governed Calendar follow-through.
7. Make the updated state available to the dashboard and grounded assistant.

The trusted internal write is atomic. External Calendar failure must not erase or misrepresent the completed internal care action. Repeated confirmation or retry must not create duplicate administrations, completed reminders, successors, Calendar events, or action outcomes.

Librela behavior is outside the Phase 3E.2 mutation boundary and must remain unchanged.

## Messaging strategy and truthful state

TomoCare does not currently use Twilio for live clinic delivery. The earlier Twilio work remains useful architectural evidence, but the account was closed after the product chose a native Apple Messages handoff for its real single-user need.

The current contract is:

- Tomo prepares the exact message from trusted state.
- The server owns and verifies the recipient; the client sees masked recipient details.
- Rosa explicitly approves the reviewed message.
- TomoCare opens an editable native Messages draft on the Mac.
- Rosa makes the final send decision.
- `messages_handoff_requested` does not mean sent, delivered, received, or booked.
- A later sent state requires explicit owner reporting or a future trusted delivery source.

Do not reopen provider delivery or inbound reply interpretation inside Phase 3E.3.

## Current governance boundaries

Preserve these behaviors across all new work:

- Only trusted records may support factual care answers and operational calculations.
- Screen text, loose chat memory, candidate extraction, and model inference are not authority.
- The model may interpret user language; deterministic code decides state, schedules, freshness, rank, and idempotency.
- Citations and deep links must point to the governing record or source.
- A proposed action is not an approved action; an approved action is not necessarily complete.
- A reminder is not a completed treatment, and a target date is not a confirmed appointment.
- Navigation is not authorization to create, change, complete, approve, sync, book, or send anything.
- External integrations must report unavailable, stale, failed, or unknown state honestly.
- Character, voice, and personality may change presentation but not facts, urgency, medical restraint, or tool authority.

## Operational state

- Phase 3E.2 introduced no database migration and no new environment variable.
- Existing Gmail, Google Calendar, OpenAI, Supabase, Apple Messages, voice, and optional avatar setup remains in force.
- Keep secrets, OAuth tokens, private PDFs, recipient details, and `.env` contents out of source control, handovers, screenshots, and chat.
- Apple Messages recipient configuration remains server-owned.
- `.claude/` remains untracked and excluded from delivery packages.

## Verified Phase 3E.2 closeout

Rosa reported the following at the final merged checkpoint:

- Phase 3E.2 tests passed.
- Required regression tests passed.
- Syntax and ESLint checks passed.
- Production build succeeded.
- Before this documentation-only reconciliation, `main` and `origin/main` pointed to `93e9308`.

The Phase 3E.2 feature commit remains `53c9b35` on `phase-3e-2-home-medication-lifecycle` and its remote branch.

## Next slice: Phase 3E.3 — Attention and Governed Navigation

### User question

> Tomo, what needs my attention?

### Product objective

Give Rosa one reliable, grounded view of actionable work across TomoCare, then guide her to the exact governed place where she can inspect or act. The answer must be useful without pretending that navigation itself completed anything.

### First-slice governed sources

Use only three server-owned sources in the first slice:

- Planned reminder rows that deterministically qualify as due, overdue, or expired under their reminder-type rules
- Care actions in `proposed`, `approved`, `executing`, or `outcome_unknown` state
- Documents whose current stored status is `needs_review`

A document awaiting verification is governed workflow state, but its extracted contents are still candidate truth. Tomo may identify the document, explain that it needs review, and open its review record. Tomo must not summarize candidate contents as verified facts.

Calendar is navigation metadata attached to a qualifying reminder, not a separate attention source in this slice. A persisted event URL may open the specific event. Without one, Tomo may open Google Calendar generically and must not imply that an event exists.

The current Calendar error and reauthorization state lives in browser memory and disappears after refresh. Phase 3E.3 must not present that transient state as durable recovery work. Persisting Calendar failures is a separate future slice.

Defer appointment-state aggregation and recently verified follow-up until the first attention contract is proven. Do not infer attention items from visual prominence, raw inbox text, candidate extraction, or model judgment.

### Attention response contract

Add a deliberate `attention_summary` answer type with structured `attention_items`. Do not force pending actions or review documents into the existing verified-citation presentation.

Each item should use this bounded shape:

```text
id
kind: reminder | care_action | document_review
state
priority
title
reason
effective_date
governing_reference: table + record id + optional source document id
navigation_targets: one or more allowlisted navigation commands
```

The response should also report the availability of the three supported sources. A failed source is `unavailable`, not an empty result.

Use these navigation command types only:

- `open_reminder`
- `open_care_action`
- `open_review_document`
- `open_calendar_event`
- `open_calendar_home`

Internal destinations should be constructed from typed record identifiers. External Calendar navigation may use only the persisted Google Calendar event URL or the existing Google Calendar home constant.

### Deterministic qualification and priority

Recompute reminder timing from the current care date on every question rather than trusting cached `details_json.timing_state`.

- Home medications qualify when `due_now` or `overdue`.
- Librela qualifies when the reminder window has passed or the due date is overdue.
- Insurance qualifies when filing is due now or the final claim window has expired.
- Unknown or unsupported reminder shapes do not qualify and must not receive model-inferred urgency.

An explicit attention window is a bounded exception for planned reminders. The
deterministic planner may also include a supported reminder whose activation
date falls within the requested future window:

- **Today:** current overdue, due, pending, and review work
- **Tomorrow:** scheduled reminders whose activation date is tomorrow; current
  pending actions and review documents are not presented as tomorrow-dated work
- **This week:** current work plus reminders becoming active from today through
  Sunday
- **This month:** current work plus reminders becoming active from today through
  the final day of the current month

Unbounded attention questions continue to return current governed work only;
they do not pull every future reminder into the answer. The model may interpret
the phrase, but deterministic date code calculates and applies the window.

Rank qualifying items in this order:

1. Care action with an unknown outcome
2. Care action interrupted in `executing`
3. Overdue or expired reminder
4. Approved care action awaiting completion or recovery
5. Due-now reminder, including a Librela reminder window that has opened
6. Proposed care action awaiting review
7. Document awaiting verification

Within one rank, use the earliest effective date, then the oldest relevant creation timestamp, then record ID as the stable final tie-breaker. Return no more than five attention items.

### Required answer behavior

The first vertical slice should:

1. Build a server-owned attention model from supported governed sources.
2. Query the three sources independently so one failure does not erase the others.
3. Apply the deterministic qualification and priority contract above without model-inferred urgency.
4. Explain in plain language why each returned item needs attention.
5. Reference the governing reminder, care action, or review document accurately.
6. State when a supported source is unavailable instead of treating it as empty.
7. Return a clear no-attention answer when no supported item qualifies.
8. Preserve the same grounded result across Chat and Voice; only presentation may differ.

The written answer and structured payload may include up to five items. Voice may speak a shorter summary, but it must preserve the same leading facts, ordering, limitations, and navigation boundary.

### Language and clarification behavior

The user must not need to memorize one exact command. Deterministic routing
should guarantee a bounded family of action-oriented paraphrases, including:

- What needs my attention?
- Do I need to do anything?
- Anything I need to review or handle?
- What should I take care of next?
- Is anything waiting for me?

Meaning-based interpretation may map additional semantically equivalent
phrasing to the same governed intent. Broad overview prompts such as “What’s
new?” or “What do I need to know?” are not automatically equivalent to
actionable work because they may refer to recent verified information or a
specific care topic. Tomo should ask whether Rosa wants attention items,
recently verified records, or a specific part of Momo’s care rather than
inventing an update or returning only a dead-end unsupported response.

When a question remains unsupported, Tomo should preserve the limitation and
offer bounded next choices. Clarification must not infer a diagnosis, medical
recommendation, urgency, care fact, or authorization to act.

### Governed navigation behavior

From an attention item, Tomo may open:

- The Reminders drawer focused on the governing reminder
- The existing approval or recovery dialog for the governing care action
- `/review/:docId` for a document awaiting verification
- The stored Google Calendar event when a persisted event URL exists
- Google Calendar generically when no event URL exists

Navigation commands may change only client view state or open an allowlisted destination. They must not call a mutation endpoint. When opening Calendar generically, Tomo must not imply that a specific event exists. Any create, change, completion, approval, retry, sync, booking, or communication action must continue through its existing governed contract.

### Suggested implementation order

1. Add a server-side attention aggregator over reminders, care actions, and document-review rows.
2. Extend the pending-action repository query to include `outcome_unknown`.
3. Normalize reminder timing by type and apply the deterministic rank and five-item maximum.
4. Add the `attention_summary` response contract, governing references, and per-source availability.
5. Add typed, allowlisted navigation commands and the smallest client handlers.
6. Connect Chat and Voice through the existing shared assistant path.
7. Add black-box integration tests and regressions before expanding coverage.

### Proposed acceptance tests

- Each supported reminder type appears only when its deterministic timing rule qualifies it.
- `proposed`, `approved`, `executing`, and `outcome_unknown` actions appear with the correct reason and rank.
- A `needs_review` document appears from document metadata only; candidate extraction is never presented as trusted fact.
- Mixed-source rank, tie-breakers, and the maximum of five are deterministic and testable.
- Each item has a reason, valid governing reference, and allowlisted navigation target.
- One unavailable source is disclosed while available sources still return items.
- All unavailable sources return an unavailable answer, not a false no-attention answer.
- No qualifying items returns an honest no-attention response.
- Stored Calendar URL opens the specific event; missing URL opens Calendar generically with accurate wording.
- Browser-session Calendar failure is not returned as durable recovery state after refresh.
- Navigation produces no care-record, approval, reminder, document, appointment, message, or Calendar mutation.
- Repeated questions and repeated navigation requests remain idempotent.
- Chat and Voice preserve the same facts, ordering, governing references, limitations, and action boundaries.
- Action-oriented paraphrases route to the same governed attention intent without requiring one exact sentence.
- “What’s new?” and “What do I need to know?” receive a bounded clarification question rather than an invented summary.
- Today, tomorrow, this-week, and this-month windows use deterministic care dates and do not change spending or other historical range semantics.
- A tomorrow-only answer includes scheduled reminders only and says why current pending actions and review documents are not treated as tomorrow-dated work.
- Existing Librela, Simparica, Adequan, Apple Messages, Phase 3B, and Phase 3D voice tests remain green.

### Explicitly out of scope

- Proactive push notifications or autonomous outreach
- Automatic approval, completion, retry, sync, booking, or sending
- Inbound clinic reply interpretation
- Live Twilio delivery
- Durable conversation history or broad relational memory
- New medical judgment or inferred urgency
- Durable Calendar-failure persistence or reauthorization state
- Appointment-state aggregation
- Recently verified follow-up aggregation
- Meaning-based `happy`, `laughing`, or `oops` reactions
- Weight chart redesign
- Multi-agent orchestration

Meaning-based reactions remain harmless presentation work for a later slice. Phase 4 should not begin until a real role, permission, context, or coordination boundary makes a separate agent clearer than the current modular architecture.

### Enhancement backlog captured during Phase 3E.3 user testing

- **Animate Tomo reliability and recovery:** Investigate cases where the Runway/LiveKit lip-sync path silently fails and Tomo falls back to local voice. Preserve uninterrupted audio fallback, but surface a clear non-blocking status, retain a typed failure reason for diagnosis, and offer a safe retry without restarting the conversation. This is deferred from Phase 3E.3 because the governed attention result remains available and the fallback works.

## Suggested branch and startup checks

Create the next branch from current `main`:

```bash
git switch main
git pull --ff-only
git switch -c phase-3e-3-attention-navigation
git status --short
git log --oneline -5
```

Before changing code, inspect:

- Assistant intent routing, trusted-context loading, planning, answer composition, and citations
- Shared Chat/Voice request path
- Reminder repositories, presentation models, and dashboard card routes
- `care_actions` pending/recovery state, including the missing `outcome_unknown` query coverage
- Document review state and `/review/:docId`
- Persisted reminder Calendar metadata and the transient browser-only Calendar error state
- Existing internal navigation handlers and external Calendar links
- Phase 3B, 3D, 3E.0, 3F, 3E.1a, and 3E.2 tests

Confirm the reconciled attention schema, qualification rules, priority matrix, source availability behavior, maximum result count, and navigation surface before implementation.

## Validation expectation for Phase 3E.3

Add a dedicated script such as `npm run test:phase3e3`, then run it with the relevant existing regressions. At minimum, preserve:

```bash
npm run test:phase3e3
npm run test:phase3e2
npm run test:phase3e1a
npm run test:phase3f
npm run test:phase3e0e
npm run test:phase3b
npm run test:phase3d-voice
npm run build
```

Use narrower syntax or ESLint checks for changed files during development, then the repository's normal final lint command if one exists. Do not claim production readiness until the relevant tests and build pass and the resulting state has been inspected.

## Delivery protocol

At the end of Phase 3E.3:

1. Provide a repository-ready ZIP with repo-relative paths.
2. Provide individual links for every changed or added file.
3. List exact files to add or replace.
4. List the exact validation commands and results.
5. State migrations, environment changes, and known limitations explicitly.
6. Stop before commit so Rosa can apply, test, commit, and merge.

Do not include `.env`, OAuth material, private records, `.claude/`, generated build output, or dependency folders.

## Paste-ready prompt for the new Phase 3E.3 chat

```text
I am continuing TomoCare from the shipped Phase 3E.2 checkpoint.

Current source of truth:
- Phase 3E.2 merge checkpoint: 93e9308 — Merge Phase 3E.2 home medication lifecycle
- Phase 3E.2 slice: 53c9b35 — test(phase-3e-2): prove home medication closed loop
- All Phase 3E.2 tests and regressions passed, and the production build succeeded.
- The documentation-only reconciliation was committed on main after that code checkpoint.
- .claude/ is intentionally untracked and must stay out of the delivery.

Read docs/Phase3E2_Closeout_and_Phase3E3_Handover.md first and treat it as the current product handover. Also follow docs/TomoCare_Operating_Brief.md.

We are starting Phase 3E.3 — Attention and Governed Navigation.

The first bounded user question is: “Tomo, what needs my attention?”

Please inspect the current repository and verify the reconciled contract in the handover against the implementation seams before changing code. The first slice is limited to:
- deterministically qualifying reminders;
- care actions in proposed, approved, executing, or outcome_unknown state;
- documents in needs_review state, using metadata only;
- typed navigation to the reminder, care-action, or review surface;
- stored-event or generic Calendar navigation attached to a qualifying reminder.

Calendar errors are currently browser-session state and are not a durable attention source. Appointment aggregation and recently verified follow-up are deferred.

Before implementation, confirm:
1. the attention-item schema and attention_summary answer type,
2. reminder-type qualification rules,
3. deterministic priority and tie-breakers,
4. independent source availability behavior,
5. the maximum of five items,
6. governing-reference and typed-navigation contracts, and
7. the dedicated Phase 3E.3 black-box test plan.

Do not implement until we agree on that bounded contract.

Preserve these rules:
- trusted facts and governed workflow state must remain distinguishable;
- LLM interprets, database calculates, governing references prove;
- no model-inferred urgency;
- navigation is not write authority;
- Chat and Voice must preserve the same facts and boundaries;
- no proactive notifications, automatic approvals/writes, inbound reply interpretation, live Twilio work, durable broad memory, reactions, weight-chart redesign, or multi-agent orchestration in this slice.

When we do implement, use the standard TomoCare delivery: repo-relative ZIP, individual file links, exact file list, validation commands/results, migration and environment notes, known limitations, and stop before commit.
```
