# TomoCare Current State: Phase 3E.6 Closeout and Phase 3E.7 Handover

**Date:** August 24, 2026

**Current branch:** `main`

**Phase 3E.6a implementation:** `0e02ca0` — `feat(phase-3e-6a): add governed manager verification handoff`

**Phase 3E.6b implementation:** `985a429` — `feat(phase-3e-6b): add governed care operations handoff`

**Phase 3E.6c implementation:** `b30ea6d` — `feat(phase-3e-6c): add product-visible orchestration trace`

**Phase 3E.6 merge:** `f1ed179` — `Merge Phase 3E.6 multi-agent orchestration`

## Purpose

This handover records the shipped Tomo manager, Verification Intelligence and Care Operations specialist contracts, durable orchestration and recovery behavior, product-visible trace, validation evidence, and the bounded opening contract for Phase 3E.7.

At this checkpoint, local `main`, `origin/main`, and `origin/HEAD` point to `f1ed179`. The completed Phase 3E.6 feature branch still exists locally and remotely until this documentation checkpoint is committed and pushed.

## Source-of-truth order

When implementation, documentation, and persisted state differ, use this order:

1. Current code and passing tests on `main`
2. Current database schema and persisted `orchestration_runs`, `care_actions`, events, and facts
3. This handover for the accepted Phase 3E.7 opening contract and current implementation detail
4. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md) for sequence and portfolio scope
5. [TomoCare Multi-Agent Orchestration Decision and Build Plan](./TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md) for durable manager, specialist, and tool boundaries
6. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md) for durable product principles

Earlier phase handovers remain historical evidence. They do not supersede this checkpoint.

## Phase 3E.6 outcome

Phase 3E.6 made Tomo the explicit user-facing manager of a small governed multi-agent system. Tomo selects only registered specialists, validates their versioned contracts and permissions, gives them bounded evidence and restricted tools, and synthesizes one truthful result while preserving the existing human approval boundaries.

The shipped specialists are:

- **Verification Intelligence:** compares current document candidates with source support, deterministic checks, and bounded trusted history; returns a structured assessment; and never promotes candidate truth.
- **Care Operations:** reconciles trusted Simparica and Adequan reminder, administration, and action state; returns an answer, clarification, ineligible result, recovered result, or one existing governed proposal; and never approves or executes that proposal.

Database materialization, date calculations, fingerprints, idempotency, care-action execution, Calendar, and Messages remain deterministic server responsibilities.

## Shipped manager and specialist contract

### Versioned registry and routing

- The Tomo manager selects only allowlisted specialist names and versions.
- Inputs and outputs are schema-validated before specialist work or synthesis.
- Each specialist declares its allowed truth tier, tools, timeout, result states, and evidence boundary.
- Unsupported, malformed, stale, unavailable, timed-out, or permission-denied work returns a typed safe result.
- Social, unsupported, and medically interpretive requests do not create an unbounded specialist path.

### Verification Intelligence handoff

- The existing Phase 3E.5 service is reused rather than reimplemented.
- The handoff preserves current-candidate fingerprints and stale-assessment protection.
- Source text and candidate payloads remain behind restricted review tools rather than entering the durable trace.
- A current completed assessment may be recovered without repeating specialist work.
- Source-review failure still becomes explicit manual review and never weakens the human verification gate.

### Care Operations handoff

- The first bounded domain covers only Simparica Trio and Adequan home-medication state.
- Definite administration statements with a supported medication and date may prepare one existing `mark_home_medication_given` proposal.
- Questions remain answer-only and create no proposal.
- Uncertain statements such as “I may have given Momo Adequan” ask for clarification and change nothing.
- Missing medication or date details are carried only as bounded session context across Chat and Voice.
- Repeated matching requests recover the existing run and proposal rather than duplicating work.
- Changed trusted evidence supersedes or invalidates the earlier run before new work proceeds.
- Approval and atomic execution remain outside the specialist and inside the existing governed action path.

## Durable trace and product-visible explanation

Phase 3E.6 reuses `orchestration_runs` as the durable run record and `care_actions` as the only governed action ledger. No parallel orchestration or action table was introduced.

The product now shows a collapsed **How Tomo handled this** explanation across VerifyDocs, Chat, and Voice. Its visual sequence makes the system boundary legible:

1. Tomo manager selected a bounded specialist.
2. The named specialist and version completed, recovered, or returned a typed limit.
3. A bounded number of evidence references were checked.
4. The specialist returned an answer, clarification, or proposal-ready result.
5. The human-control section explains what remains unchanged or requires Rosa's approval.

The trace may also disclose safe reuse when a matching completed run prevents repeated specialist work. It does not expose prompts, raw source text, hidden reasoning, credentials, private narrative, or unrestricted tool activity.

## Human-control boundary

Phase 3E.6 does not authorize agents to:

- promote candidate truth to trusted records;
- approve or execute a care action;
- infer medication administration from a reminder, due date, or uncertain statement;
- write directly to Calendar or Messages;
- bypass deterministic validation, stale-state checks, or idempotency;
- diagnose, interpret medical significance, recommend treatment, or change dosage; or
- create additional specialists outside the registry.

Rosa remains responsible for document verification, care-action approval, Calendar synchronization, and the final native Messages send decision.

## Validation evidence

Rosa confirmed the final Phase 3E.6 state after the product-visible trace refinement:

- Phase 3E.6c tests passed: 37
- Phase 3E.6b tests passed: 118
- Phase 3E.6a tests passed: 25
- Phase 3E.5 verification regressions passed: 42
- Phase 3E.4 governed-assistant regressions passed: 98
- ESLint completed successfully for the requested changed-file checks.
- The production build completed successfully.
- Voice and Chat manual testing passed for definite administration, missing-date clarification, and uncertain “may have” language.
- The visible trace correctly showed manager, Care Operations specialist, bounded evidence, result state, safe reuse when applicable, and human control.
- Phase 3E.6 was committed, pushed, merged, and confirmed on `origin/main` at `f1ed179`.

No Phase 3E.6 database migration, environment-variable change, or provider setup was required.

## Current architecture after Phase 3E.6

### Tomo manager

Owns the user conversation, deterministic intent seam, specialist selection, structured synthesis, approval guidance, and recovery language. The manager does not become a second calculation, persistence, or action engine.

### Verification Intelligence specialist

Owns document comparison and review assessment within its current-source, deterministic-check, and bounded-history contract. It remains read-only with respect to trusted truth.

### Care Operations specialist

Owns bounded reconciliation of trusted care state and preparation of an eligible existing proposal. It does not own approval, execution, or provider delivery.

### Deterministic services

Own dates, arithmetic, schemas, fingerprints, database materialization, optimistic concurrency, idempotency, action execution, Calendar, and Messages.

### Human authority

Owns promotion to trusted truth and every consequential action approval.

## Next phase: Phase 3E.7 — Preventive Care Lifecycle

Phase 3E.7 will turn clinic-reported future-care information into source-linked candidates and an accountable lifecycle without confusing a due date, reminder, scheduled appointment, or completed administration.

The full phase may cover:

- vaccines;
- annual wellness exams;
- annual senior-lab lifecycle state; and
- a small allowlist of preventive screening such as heartworm testing.

The lifecycle distinguishes `due`, `scheduled`, `completed`, and `unknown`. It must deduplicate repeated source entries, require grouped human review, reconcile later trusted completion evidence, and use the existing Care Operations, reminder, dashboard, grounded-answer, and Calendar boundaries. Senior-lab tracking covers lifecycle state only and does not interpret analytes, values, units, ranges, trends, or medical significance.

## First bounded slice: Phase 3E.7a — Verified Preventive Status Capture

### User outcome

When a clinic document states that rabies is due on a future date, VerifyDocs should capture that statement as a source-linked candidate, help Rosa verify its meaning, and allow Tomo to answer from the resulting trusted status fact without claiming that Momo received a vaccine.

Allowed after verification:

> The latest verified clinic record lists rabies as due on February 10, 2027.

Disallowed without a separate trusted administration event:

> Momo received her rabies vaccine.

### Typed candidate contract

Begin with a strict rabies-status pilot using a structured candidate such as:

```json
{
  "care_kind": "vaccine",
  "care_item": "rabies",
  "lifecycle_state": "due",
  "target_date": "2027-02-10",
  "date_meaning": "clinic_reported_due_date",
  "source_context": "Rabies vaccine due: 02/10/2027"
}
```

The exact persisted schema should follow the existing `facts` conventions after current schema inspection. The status should materialize as a source-linked verified fact, not as a completed vaccine event, administration event, reminder, or Calendar entry.

### Minimum implementation scope

1. Add a bounded `preventive_care_candidates` extraction structure for clinic-reported rabies status.
2. Normalize only allowlisted item, lifecycle state, date meaning, and valid calendar date values.
3. Add every candidate field to Verification Intelligence source comparison.
4. Block promotion when item, state, target date, or date meaning is missing, conflicting, or unclear.
5. Present the candidate as one grouped preventive-status review in VerifyDocs.
6. Materialize a verified, source-linked `preventive_care_status` fact only after the current document assessment and Rosa's verification.
7. Keep materialization idempotent for the same document and preventive item.
8. Extend Tomo's existing vaccine lookup to distinguish clinic-reported due status from verified administration evidence.
9. Cite the governing fact and source document in the grounded answer.
10. Prove that no reminder, care action, Calendar entry, or completed-administration claim is created by this slice.

### Architecture responsibilities

| Responsibility | Owner |
| --- | --- |
| Produce candidate truth from the document | Document extractor |
| Confirm source support, state, date, and date meaning | Verification Intelligence |
| Approve promotion to trusted truth | Rosa |
| Validate and materialize one trusted status fact | Deterministic server contract |
| Read the trusted fact and answer faithfully | Tomo manager |
| Prepare or activate preventive reminders | Deferred Care Operations slice |

### Required tests

Phase 3E.7a should prove:

1. A clear “Rabies vaccine due” statement becomes one normalized candidate.
2. A future due date is never converted into vaccine administration or completion.
3. Ambiguous, invalid, conflicting, or unsupported candidate values block promotion.
4. Candidate edits invalidate the earlier Verification Intelligence assessment.
5. VerifyDocs groups the preventive-status review and preserves the source context.
6. Approved materialization is source-linked, verified, and idempotent.
7. Repeated documents or repeated approval do not create duplicate status facts.
8. Tomo answers the latest verified clinic-reported status with citations.
9. Tomo does not claim a last administration date from a due-status fact.
10. No care action, reminder, Calendar entry, or external call occurs.
11. Phase 3E.5 Verification Intelligence and Phase 3E.6 manager/specialist behavior remain green.

### Manual acceptance scenarios

1. A fictional review document containing “Rabies vaccine due: 02/10/2027” shows one grouped preventive-status candidate.
2. Rosa can inspect the source wording, lifecycle state, date meaning, and target date before verification.
3. After verification, Tomo answers “When is Momo's rabies vaccine due?” using the clinic-reported due status and source citation.
4. Asking “When did Momo receive her rabies vaccine?” does not convert the due-status fact into administration evidence.
5. No preventive reminder, care action, or Calendar entry appears after status verification.

### Explicitly out of scope for Phase 3E.7a

- General vaccine administration extraction
- Annual wellness, senior-lab, and heartworm-screening candidates
- Reminder activation, scheduling, Calendar sync, or completion reconciliation
- Care Operations proposal or action execution for preventive care
- Lab result extraction or interpretation
- Medical significance, urgency, diagnosis, treatment, or dosage guidance
- Broad preventive-care planning or autonomous follow-up
- Weight visualization, avatar recovery, demo-environment work, synthetic Gmail completion, or final portfolio polish

## Phase 3E.7a definition of done

Phase 3E.7a is complete only when:

- a clear clinic-reported rabies status becomes one typed source-linked candidate;
- Verification Intelligence validates the candidate against the current source;
- Rosa performs one grouped review before trusted promotion;
- only a verified preventive-status fact materializes;
- Tomo answers due-status questions from that fact with citations;
- administration, completion, reminder, action, and Calendar claims remain separate and absent;
- repeated work is idempotent;
- affected Verification Intelligence and orchestration regressions remain green;
- ESLint and the production build pass; and
- Rosa completes the manual acceptance scenarios.

## Recommended branch

After this documentation checkpoint is committed and pushed on `main`, delete the completed Phase 3E.6 branch and create:

```bash
git switch -c phase-3e-7a-verified-preventive-status
git push -u origin phase-3e-7a-verified-preventive-status
```

## Pasteable opening message for the implementation checkpoint

```text
We completed and merged TomoCare Phase 3E.6 at f1ed179. I am now on the phase-3e-7a-verified-preventive-status branch.

Use docs/Phase3E6_Closeout_and_Phase3E7_Handover.md as the current implementation handover, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for sequence and portfolio scope, docs/TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md for durable manager and specialist boundaries, and docs/TomoCare_Operating_Brief.md for durable principles.

We are starting Phase 3E.7a — Verified Preventive Status Capture.

First inspect the current extractor, Verification Intelligence field and source-review contracts, VerifyDocs grouped review, trusted facts schema and verified-weight materialization pattern, document approval route, vaccine lookup answer, citations, and affected tests. Then confirm the smallest repo-relative implementation plan before changing code.

Begin with clinic-reported rabies status only. Preserve care item, lifecycle state, target date, date meaning, source context, and document provenance. Materialize a verified preventive-status fact only after Rosa verifies the current source and candidate.

Never treat a clinic due date or reminder section as proof of vaccine administration or completion. Do not create a preventive reminder, care action, Calendar entry, general vaccine extractor, annual-wellness candidate, senior-lab candidate, heartworm-screening candidate, or lab interpretation in this slice. Reuse the Phase 3E.6 manager and Verification Intelligence boundaries and keep deterministic services responsible for validation, materialization, and idempotency.
```
