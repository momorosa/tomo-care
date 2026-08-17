# TomoCare Current State: Phase 3E.4 Closeout and Phase 3E.5 Handover

**Prepared:** August 16, 2026

**Owner:** Rosa Choi

**Current branch:** `phase-3e-5-verification-intelligence`

**Phase 3E.4 documentation checkpoint:** `1690eb1` — `docs: close Phase 3E.4 and define Phase 3E.5`

**Phase 3E.4 merge checkpoint:** `3276dbe` — `Merge Phase 3E.4 governed profile grounding`

**Phase 3E.4 implementation:** `7d1834f` — `feat(phase-3e-4): add governed profile grounding`

## Purpose

This is the current handover after Phase 3E.4. It records the shipped governed Profile contract, Rosa's validation evidence, the accepted Phase 3E.5 contract, and the decision to build TomoCare as a small governed manager-style multi-agent system beginning with the Verification Intelligence Agent.

At the verified Phase 3E.4 merge checkpoint, `main` and `origin/main` both pointed to `3276dbe`. The closeout and original Phase 3E.5 handover were then recorded at `1690eb1`. The local `.claude/` directory remains intentionally untracked and is not product source.

## Product in one paragraph

TomoCare is a personal, single-user governed AI pet-care assistant for Rosa and Momo. It preserves source documents, separates model-extracted candidate truth from human-verified trusted truth, answers from trusted records, and routes consequential changes through explicit approval. Its durable rules remain: **AI can prepare; human approves** and **LLM interprets; database calculates; citations prove**.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. Current database and persisted action state
3. This handover for settled Phase 3E.5 decisions and next-slice scope
4. The TomoCare Multi-Agent Orchestration Decision and Build Plan for agent boundaries and phased implementation
5. The TomoCare Product Roadmap and Portfolio Checkpoint for accepted sequencing and portfolio scope
6. The TomoCare Operating Brief for durable principles
7. Earlier handovers and phase notes for historical context

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

1. Phase 3E.5 — Verification Intelligence Agent
2. Phase 3E.6 — Tomo Multi-Agent Orchestration Foundation and Care Operations Agent
3. Phase 3E.7 — Preventive Care Lifecycle for vaccines, annual wellness, annual senior-lab tracking, and bounded preventive screening
4. Verified weight-trend visualization
5. Animate Tomo reliability and recovery
6. Separate demo environment and resettable synthetic dataset
7. Final synthetic invoice and demo-safe Gmail ingestion
8. Final Voice, animation, and end-to-end UI polish
9. Demo evidence and portfolio freeze

A wholly fictional document fixture will be created early for safe Phase 3E.5 tests. That fixture is not the finished visual demo invoice and does not require the live demo Gmail path.

This sequence lets verification, vaccine, weight, and recovery improvements benefit Momo's real-care experience. It also avoids stabilizing demo seeds and polished provider flows before the underlying schema and review behavior settle.

## Next bounded slice: Phase 3E.5 — Verification Intelligence Agent

### User problem

The current VerifyDocs experience preserves human verification, but some recommendations feel too rudimentary. Treating every field as equally important makes the system look less intelligent and asks Rosa to spend attention where the consequence of an error may be low.

At the same time, prominent source content can be ignored without a useful explanation. Governance should direct human attention to uncertainty and consequence, not merely add confirmation work.

### Accepted product objective

Make verification more selective, understandable, and useful by comparing the current document with deterministic checks and recent comparable trusted history while preserving the distinction between source truth, candidate truth, and trusted truth.

Phase 3E.5 should improve how TomoCare prioritizes and explains review. It must not silently verify uncertain care facts, materialize candidate data, or use model confidence as authority.

### Inspection completed before contract approval

The current extraction, triage, VerifyDocs, draft, verification, materialization, error, and fixture seams were inspected before this contract was accepted. The inspection found:

1. Triage currently sees the current source and extraction but not recent trusted history.
2. Existing accepted and fail-open paths are primarily browser-enforced; backend approval needs a current assessment and candidate-fingerprint check.
3. Editing can leave cached triage stale, and the dirty save-and-verify path can skip reassessment.
4. Draft and trusted materialization are conceptually separate and must remain so.
5. Deterministic arithmetic and date-consistency checks are not yet first-class review evidence.
6. Prominent unsupported source sections can disappear from review without explanation.
7. Current field enumeration and response validation are too limited for the agreed outcome contract.
8. A generic materializer can accept vaccine-shaped events, so Phase 3E.5 must explicitly prevent vaccine materialization.
9. The legacy August 3 fixture is useful for regression but should not be extended into the new historical-comparison fixture.

### Accepted comparison and review contract

The Verification Intelligence Agent may compare the current invoice with up to the five most recent comparable trusted records. An established pattern requires at least three consecutive comparable verified records. History may reduce review burden only when the current source is clear, deterministic checks agree, and the comparison is semantically valid.

The accepted outcomes are:

1. **Consistent pattern** — current evidence agrees with deterministic checks and an established trusted pattern; group as nonblocking confirmation.
2. **New or limited history** — current evidence may be clear, but history is insufficient to establish a pattern; show as a light review item.
3. **Changed from pattern** — a comparable value differs from recent trusted history; show the old and new values and why the difference matters.
4. **Conflict or uncertainty** — source, extraction, units, dates, history, or deterministic checks disagree or remain ambiguous; require deliberate review.
5. **Not captured** — a prominent source section is outside the current extraction contract; acknowledge it and explain the boundary.
6. **Manual review** — the system cannot safely classify the item; keep it explicit and blocking.

These are qualitative consequence-and-uncertainty categories, not model-confidence scores. The complete agent, tool, permission, handoff, and roadmap decision is recorded in [TomoCare Multi-Agent Orchestration Decision and Build Plan](./TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md).

### Accepted attention rules

- Matching invoice and line-item dates become one deterministic consistency result rather than repeated approvals.
- The source reviewer classifies source support and ambiguity only. A field's downstream consequence does not make clear source evidence uncertain or create an automatic human-confirmation requirement.
- Repeated low-risk administrative values, such as an unchanged nurse office visit charge, may be grouped when the current source is clear and at least three recent comparable trusted records establish the pattern.
- A repeated product description such as `10 mg/ml solution vial` may be grouped as a consistent Librela product pattern. It must not be described as the administered dose unless the source states an administered dose.
- Medication or service identity, administration date, dose when stated, weight, totals, and any field that can change scheduling or trusted care state receive deliberate treatment when uncertain or changed.
- Invoice arithmetic is deterministic with a one-cent tolerance. A calculated line-item check remains separate from a missing source `paid` total.
- Weight is compared with the latest verified measurement. A change of at least five percent is an attention threshold for review, not a medical conclusion. Unit, date, duplicate, and source conflicts also require review.
- Missing values remain missing. Contradictions display both pieces of evidence. Unreadable content remains explicit.
- Prominent vaccine, annual-checkup, reminder, and lab sections are acknowledged as not captured when outside the current schema.
- Verified documents created under older triage rules preserve their audit history but label and collapse it as a historical legacy review rather than presenting it as current Verification Intelligence.
- Explanations use plain language: what changed or could not be confirmed, the evidence compared, and why Rosa's attention is requested. They do not diagnose or judge clinical urgency.

### Accepted safety and state boundary

- Triage may prioritize and explain; it does not verify.
- No candidate fact becomes trusted without Rosa's explicit save-and-verify action.
- Model confidence alone never authorizes promotion or a downstream action.
- Missing or unsupported source content is disclosed rather than invented.
- Deterministic checks establish invoice arithmetic, date agreement, fingerprints, schema validity, and other expressible rules.
- Saving a draft updates candidate truth only.
- Editing candidate truth invalidates the prior assessment.
- A dirty Save and verify path saves, reruns assessment, and requires the current result before promotion.
- Final backend verification checks the current candidate fingerprint and review state.
- A bounded correction record may be stored inside the versioned triage result; no new migration is required for the initial slice.
- Vaccine and preventive-care details remain outside Phase 3E.5 materialization and belong to Phase 3E.7 after the orchestration foundation.
- Lab interpretation and longitudinal lab comparison remain post-demo work.
- No Gmail, Calendar, Messages, or care-state action is added to this read-and-review slice.

### Out of scope

- Vaccine-status extraction or materialization; that belongs to Phase 3E.7
- Complete preventive-care reminder and completion lifecycle; that belongs to Phase 3E.7
- Verified weight chart
- Animate Tomo reliability work
- Demo Supabase project and reset tooling
- Finished synthetic visual invoice and live demo Gmail ingestion
- Lab-result interpretation, longitudinal analyte comparison, urinalysis, imaging, or broader medical interpretation
- Autonomous verification or automatic promotion to trusted truth
- Formal Tomo manager routing or Care Operations Agent implementation; those belong to Phase 3E.6

### Accepted fixture and validation plan

Add one wholly fictional fixture for the new historical-comparison contract. Keep the legacy August 3 fixture unchanged as regression-only coverage. No private clinic, invoice, recipient, insurance, or care identifier may enter fixtures, logs, packages, or demo evidence.

The implementation test plan covers:

- schema and prompt conformance for the six accepted outcomes and evidence-bearing explanations;
- historical retrieval bounded to five records and pattern establishment after three consecutive comparable matches;
- date consistency, one-cent arithmetic tolerance, missing paid total, weight delta, unit, and duplicate checks;
- consistent, limited-history, changed, conflict, not-captured, and manual-review decisions;
- stale-assessment invalidation, candidate fingerprint enforcement, and explicit verification as the only promotion boundary;
- triage unavailable, malformed response, partial source, unreadable content, and history-retrieval failure paths;
- existing Librela, cost, weight, reminder, post-verification, and legacy-fixture regression behavior; and
- manual proof that Rosa can understand what changed, what stayed consistent, what was not captured, and why her approval is requested.

## Following bounded slice: Phase 3E.6 — Tomo Multi-Agent Orchestration Foundation

After Phase 3E.5 is shipped and accepted, Phase 3E.6 will make Tomo the explicit manager, expose Verification Intelligence through a typed read-only specialist contract, and wrap existing reminder and care-action reconciliation as the Care Operations Agent.

Phase 3E.6 will reuse `orchestration_runs` for durable run state and `care_actions` for governed action state. Calendar, Messages, materialization, date math, arithmetic, validation, and idempotency remain deterministic restricted tools. Specialists may return assessments or proposed actions; they may not directly promote trusted truth or execute consequential mutations.

## Opening message for the next working session

```text
I am continuing TomoCare from the shipped Phase 3E.4 checkpoint.

Current checkpoint:
- 1690eb1 — docs: close Phase 3E.4 and define Phase 3E.5
- 3276dbe — Merge Phase 3E.4 governed profile grounding
- 7d1834f — feat(phase-3e-4): add governed profile grounding

I am on branch phase-3e-5-verification-intelligence.

Please read:
- docs/Phase3E4_Closeout_and_Phase3E5_Handover.md
- docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md
- docs/TomoCare_Operating_Brief.md
- docs/TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md
- README.md

We are starting Phase 3E.5 — Risk-Weighted Verification Intelligence.

Before changing code, inspect the extraction inputs, AI triage prompt and schema, VerifyDocs UI, draft and verification boundaries, trusted materialization, error handling, and current fixtures.

The Phase 3E.5 contract is accepted. Implement only the Verification Intelligence Agent slice described in the handover and architecture decision. Do not begin Phase 3E.6 orchestration or vaccine/lab materialization in this slice.
```
