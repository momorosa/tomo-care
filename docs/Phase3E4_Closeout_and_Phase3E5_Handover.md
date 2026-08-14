# TomoCare Current State: Phase 3E.4 Closeout and Phase 3E.5 Handover

**Prepared:** August 14, 2026

**Owner:** Rosa Choi

**Current branch:** `main`

**Phase 3E.4 merge checkpoint:** `3276dbe` — `Merge Phase 3E.4 governed profile grounding`

**Phase 3E.4 implementation:** `7d1834f` — `feat(phase-3e-4): add governed profile grounding`

## Purpose

This is the current handover after Phase 3E.4. It records the shipped governed Profile contract, Rosa's validation evidence, the revised portfolio-readiness sequence, and the inspection-first boundary for Phase 3E.5.

At the verified checkpoint, `main` and `origin/main` both pointed to `3276dbe`. The local `.claude/` directory remains intentionally untracked and is not product source.

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

## Shipped capability through Phase 3E.4

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
| **3E.3** | Governed attention across qualifying reminders, care actions, and review documents, with deterministic ranking and time windows, natural Chat and Voice summaries, and typed navigation. |
| **3E.4** | Governed Profile answers from the current `pets` record, deterministic age, honest missing-data behavior, warm relationship context kept outside care truth, question-aware clarification, and typed read-only Profile navigation. |

## Phase 3E.4 shipped contract

### Governed source and fields

The current `pets` row is the governing record for bounded Profile identity. Phase 3E.4 supports:

- `name`
- `species`
- `breed`
- `birth_date`
- Age calculated from `birth_date` and the current TomoCare care date
- `sex`
- `spayed_neutered`, presented as reproductive status

Age is never stored or hardcoded. Birthday-boundary behavior is deterministic. Missing values remain missing and are not filled from model knowledge, screen text, or the relationship profile.

Primary clinic and Insurance remain presentation-only labels because Phase 3E.4 did not identify a governed source for them.

### Relationship-profile boundary

The versioned relationship profile may add harmless warmth about Momo's personality and family role. It cannot provide, replace, correct, or override governed identity or medical facts.

The final response should feel natural for a pet parent while keeping the authority boundary clear. Relationship context does not need a clinical disclaimer inserted into ordinary language when the response can remain truthful without sounding mechanical.

### Question awareness

Direct identity questions route to the governed Profile answer. Broad wellbeing language such as “How is Momo?” is not silently converted into a Profile question or a medical conclusion.

When TomoCare cannot determine current wellbeing from the bounded record, Tomo asks what aspect Rosa means and offers supported areas such as weight trend, reminders, recent verified records, or care history. Clarification language refers to Rosa's actual question rather than introducing a word she did not use.

### Shared Chat and Voice behavior

Chat and Voice use the same governed result. Voice may be shorter, but it cannot omit a necessary limitation, change the facts, or turn relationship context into evidence.

### Governed navigation

Phase 3E.4 adds the typed command:

- `open_profile`

It opens the existing Profile panel. It grants no authority to edit the pet record or change care state.

## Phase 3E.4 validation and user evidence

Rosa reported that:

- The initial Phase 3E.4 focused suite passed `128/128`
- The affected regression suite passed `115/115`
- The full repository suite passed `494/494`
- The production build succeeded
- The final language and question-awareness refinement passed all automated checks
- The production build also succeeded after the refinement
- Manual testing confirmed the expected governed fields, navigation, missing-data behavior, and shared interaction path
- Manual testing confirmed that Tomo now responds more naturally and accurately to the question Rosa actually asked

Phase 3E.4 required no database migration. An optional local Runway duration setting was operational configuration only and was not part of the committed slice.

## Current governance boundaries

Preserve these rules:

- Only trusted records may support factual care answers and operational calculations.
- Candidate extraction may guide review but cannot become trusted truth without explicit verification.
- Screen text, loose chat memory, and model inference are not authority.
- The model may interpret language; deterministic code decides care state, dates, calculations, and idempotency.
- A reminder is not a completed treatment, and a target date is not a confirmed appointment.
- A proposed action is not approved, and an approved action is not necessarily complete.
- Navigation grants no write authority.
- Character, voice, and relationship context may change presentation but not facts, medical restraint, or tool authority.
- External integrations must report unavailable, stale, failed, or unknown state honestly.

## Revised portfolio-readiness sequence

After Phase 3E.4, Rosa accepted a revised order that improves the real product before finalizing the demo environment:

1. Phase 3E.5 — Risk-weighted verification intelligence
2. Bounded vaccine-status capture
3. Verified weight-trend visualization
4. Animate Tomo reliability and recovery
5. Separate demo environment and resettable synthetic dataset
6. Final synthetic invoice and demo-safe Gmail ingestion
7. Final Voice, animation, and end-to-end UI polish
8. Demo evidence and portfolio freeze

A representative synthetic or sanitized document fixture may be created early for safe tests. That fixture is not the finished visual demo invoice and does not require the live demo Gmail path.

This sequence lets verification, vaccine, weight, and recovery improvements benefit Momo's real-care experience. It also avoids stabilizing demo seeds and polished provider flows before the underlying schema and review behavior settle.

## Next bounded slice: Phase 3E.5 — Risk-Weighted Verification Intelligence

### User problem

The current VerifyDocs experience preserves human verification, but some recommendations feel too rudimentary. Treating every field as equally important makes the system look less intelligent and asks Rosa to spend attention where the consequence of an error may be low.

At the same time, prominent source content can be ignored without a useful explanation. Governance should direct human attention to uncertainty and consequence, not merely add confirmation work.

### Product objective

Make verification more selective, understandable, and useful while preserving the distinction between source truth, candidate truth, and trusted truth.

Phase 3E.5 should improve how TomoCare prioritizes and explains review. It must not silently verify uncertain care facts, materialize candidate data, or use model confidence as authority.

### Required inspection before contract approval

Before changing code, inspect:

1. PDF and text extraction inputs and normalized candidate shape
2. Current AI triage prompt, response schema, and deterministic validation
3. VerifyDocs field rendering, grouping, badges, recommendations, and editing
4. Draft save and save-and-verify boundaries
5. Materialization into trusted events, costs, facts, labs, and weight measurements
6. Current fixture coverage and whether private source content appears in tests
7. Error, unreadable, partial-extraction, and unsupported-section behavior
8. Any feedback or correction data already persisted

### Decisions to settle before implementation

Agree on:

1. The review categories and what each category permits
2. How consequence and uncertainty combine without creating a false numerical precision
3. Which fields always require deliberate review because they affect care state or downstream workflows
4. Which low-risk administrative fields may be grouped for efficient review
5. How missing, contradictory, unreadable, and unsupported content is surfaced
6. What recommendation explanations say and how technical they should be
7. Whether corrections should be recorded beyond the existing candidate update
8. The synthetic or sanitized fixture boundary
9. The exact focused, regression, build, and manual test plan

### Proposed safety boundary

Until the contract is approved, preserve these defaults:

- Triage may prioritize and explain; it does not verify.
- No candidate fact becomes trusted without Rosa's explicit save-and-verify action.
- Model confidence alone never authorizes promotion or a downstream action.
- Missing or unsupported source content is disclosed rather than invented.
- Deterministic checks should be used where invoice arithmetic or required-field rules can be expressed reliably.
- A field affecting medication identity, administration date, dose, weight, cost totals, scheduling, or later action state should not be silently de-emphasized.
- Vaccine details remain outside Phase 3E.5 materialization and belong to the next bounded slice.
- No Gmail, Calendar, Messages, or care-state action is added to this read-and-review slice.

### Out of scope

- Vaccine-status extraction or materialization
- Complete vaccine reminder and administration lifecycle
- Verified weight chart
- Animate Tomo reliability work
- Demo Supabase project and reset tooling
- Finished synthetic visual invoice and live demo Gmail ingestion
- Annual labs, urinalysis, imaging, or medical interpretation expansion
- Autonomous verification or automatic promotion to trusted truth

### Validation direction

The final test plan should cover at least:

- High-consequence uncertain fields receive deliberate review
- Low-risk consistent fields can be grouped without being mislabeled as trusted
- Contradictions and deterministic arithmetic mismatches are surfaced
- Missing or unreadable values remain explicit
- Unsupported prominent sections are acknowledged without fabricated extraction
- User corrections persist through the existing governed path
- Save draft does not materialize trusted records
- Save and verify remains the only promotion boundary
- Existing Librela, cost, weight, reminder, and post-verification behavior does not regress
- No private care record or identifier is added to fixtures, logs, or packages

No implementation should begin until the current seams are inspected and Rosa agrees to the bounded contract.

## Opening message for the next working session

```text
I am continuing TomoCare from the shipped Phase 3E.4 checkpoint.

Current checkpoint:
- 3276dbe — Merge Phase 3E.4 governed profile grounding
- 7d1834f — feat(phase-3e-4): add governed profile grounding

I am on branch phase-3e-5-verification-intelligence.

Please read:
- docs/Phase3E4_Closeout_and_Phase3E5_Handover.md
- docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md
- docs/TomoCare_Operating_Brief.md
- README.md

We are starting Phase 3E.5 — Risk-Weighted Verification Intelligence.

Before changing code, inspect the extraction inputs, AI triage prompt and schema, VerifyDocs UI, draft and verification boundaries, trusted materialization, error handling, and current fixtures.

First, help me confirm the review categories, consequence and uncertainty model, always-review fields, low-risk grouping, missing and contradictory data behavior, explanation language, fixture boundary, and test plan. Do not implement until we agree on the contract.
```
