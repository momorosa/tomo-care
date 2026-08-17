# TomoCare Current State: Phase 3E.5 Closeout and Phase 3E.6 Handover

**Date:** August 17, 2026

**Current branch:** `main`

**Phase 3E.5 implementation:** `548c2d2` — `feat(phase-3e-5): add risk-weighted verification intelligence`

**Phase 3E.5 merge:** `cfaeb49` — `Merge Phase 3E.5 verification intelligence`

**Prior architecture checkpoint:** `682a228` — `docs: align verification intelligence and multi-agent roadmap`

## Purpose

This is the current handover after Phase 3E.5. It records the shipped Verification Intelligence contract, the validation and manual-review evidence, the remaining governance boundaries, and the bounded Phase 3E.6 contract for making Tomo an explicit manager with Verification Intelligence and Care Operations specialists.

At this checkpoint, local `main` and `origin/main` both point to `cfaeb49`. The local `.claude/` directory remains intentionally untracked and is not product source.

## Source-of-truth order

When implementation, documentation, and persisted state differ, use this order:

1. Current code and passing tests on `main`
2. Current database schema and persisted action or orchestration state
3. This handover for settled Phase 3E.6 scope and current implementation detail
4. [TomoCare Multi-Agent Orchestration Decision and Build Plan](./TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md) for durable agent boundaries
5. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md) for sequence and portfolio scope
6. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md) for durable principles

Earlier phase handovers remain historical evidence. They do not supersede this checkpoint.

## Phase 3E.5 outcome

Phase 3E.5 replaced equal-weight field triage with a bounded Verification Intelligence specialist that combines three kinds of evidence:

1. Current-source comparison performed by a schema-constrained model tool
2. Deterministic date, invoice arithmetic, weight, fingerprint, and materialization checks
3. Up to five recent comparable trusted records

The specialist produces a structured review assessment. It does not promote candidate data, create reminders, call Calendar or Messages, interpret medical significance, or decide that a document is trusted.

Rosa still performs the final verification. The backend verifies that approval refers to the current candidate fingerprint and that every blocking review item has been accepted before trusted materialization can proceed.

## Phase 3E.5 shipped contract

### Historical comparison

- Retrieve no more than five comparable trusted records.
- Require at least three consecutive comparable verified records before describing a value as an established pattern.
- Do not skip a recent missing item to manufacture a pattern.
- Use history only as supporting evidence when the current source is clear and deterministic checks agree.
- Treat fewer than three comparable records as limited history rather than an anomaly.

### Review outcomes

The versioned assessment supports:

- `consistent_pattern`
- `new_or_limited_history`
- `changed_from_pattern`
- `conflict_or_uncertainty`
- `not_captured`
- `manual_review`

Only changed, conflicting, uncertain, or fail-safe manual items block final verification. Consistent and limited-history items remain visible context without requiring field-by-field approval.

### Date, cost, and weight behavior

- Matching document, care-event, and line-item dates become one nonblocking date-consistency result.
- A conflicting line-item date becomes one explicit blocking explanation rather than repeated approvals.
- Invoice arithmetic is deterministic with a one-cent tolerance.
- A calculated line-item total remains distinct from a missing source-paid total.
- Recurring service and medication line items may be grouped only when recent trusted history establishes a valid pattern.
- Weight is compared with the latest verified measurement; a change of at least five percent is a product-attention threshold, not a medical conclusion.
- Displayed monetary values use two decimal places consistently, including whole-dollar values, one-decimal totals, and discounts.

### Source and fail-safe behavior

- A consequential field is not automatically uncertain. A clearly printed date, medication, weight, or amount may be classified as a source match.
- Product concentration remains distinct from administered dose.
- Malformed or unavailable source review fails safely to explicit manual review.
- Missing history prevents a historical-pattern claim but does not invent a conflict.
- Prominent vaccine, annual-wellness, and lab content is acknowledged at the category level as seen but not captured.

The August 3 verified invoice predates the new review contract. Its original audit remains preserved, labeled **Historical review**, and collapsed. It is not silently re-triaged. A newly reviewed unverified document can show the current category-level unsupported-content disclosure.

### Correction and promotion boundary

- Saving edits changes candidate truth only.
- Editing a candidate invalidates the earlier assessment and changes the action to **Save & recheck**.
- The backend requires the current candidate fingerprint and current versioned assessment.
- Accepted blocking paths are validated server-side.
- Vaccine-shaped candidate events cannot materialize through Phase 3E.5.
- The existing human verification action remains the only path from candidate truth to trusted records.

### Persistence and fixture boundary

- The versioned assessment and bounded correction history use the existing `documents.triage_result` JSONB field.
- No database migration was required.
- A wholly fictional Cedar fixture covers comparison, changes, conflicts, unsupported content, and safety behavior.
- The existing August 3 Librela fixture remains a lifecycle regression fixture.
- No detailed preventive-care candidates, reminders, or Calendar entries were introduced.

## Validation evidence

Rosa confirmed:

- Phase 3E.5 focused tests passed after the final currency correction; the focused suite contained 40 tests.
- Phase 3E.0d verified-weight regressions passed.
- Phase 3E.0e Librela lifecycle regression passed.
- ESLint passed for all changed implementation files.
- The production build completed successfully.
- Manual review confirmed that the new summary is more intelligent and does not require repeated confirmation for matching dates.
- The older August 3 audit appears as collapsed historical context.
- Currency presentation is consistent and visually accepted.

The earlier full repository run also passed before the final presentation-only corrections. The final correction changed only VerifyDocs currency presentation and its focused formatter test; the focused and affected regressions were rerun afterward.

## Current architecture after Phase 3E.5

TomoCare now has one shipped specialist boundary but is not yet a shipped multi-agent manager system.

### Shipped specialist

**Verification Intelligence** owns document comparison and review assessment. Its model tool compares the current candidate with the current source. Deterministic services own history retrieval, date agreement, invoice arithmetic, weight comparison, fingerprints, result classification, and promotion validation.

### Existing orchestration foundation

TomoCare already has useful orchestration infrastructure from the governed Librela appointment workflow:

- `orchestration_runs` persists server-owned workflow checkpoints, recovery count, context fingerprints, results, and external-action projection.
- `care_actions` remains the authority for proposal, approval, execution, cancellation, and action outcomes.
- The persisted Librela workflow checkpoints deterministic records, care-planning, and communication handoffs.
- Existing repository methods use optimistic `updated_at` checks and recover active runs rather than repeating completed work.

Those deterministic workflow roles are not themselves evidence that Tomo is a multi-agent manager. Phase 3E.6 must add explicit manager selection, versioned specialist contracts, bounded agent context, permission enforcement, structured handoffs, concise traces, specialist failures, and system-level evals.

### Existing assistant seam

`answerAssistantQuestion` already performs semantic interpretation, builds trusted context, invokes bounded capability services, composes a grounded response, and applies personality afterward. Phase 3E.6 should formalize this seam as the Tomo manager instead of building a second conversational stack.

The existing home-medication action path is the safest initial Care Operations proof because it already:

- distinguishes administration statements from questions and uncertainty;
- supports only Simparica Trio and Adequan;
- requires exactly one current trusted reminder;
- prepares, but does not approve or execute, a `mark_home_medication_given` care action;
- calculates dates and successor reminders deterministically; and
- executes only through the existing approval-gated atomic transaction.

## Next bounded slice: Phase 3E.6 — Tomo Multi-Agent Orchestration Foundation

### User outcome

Tomo should visibly coordinate the correct bounded specialist, return one coherent answer or review result, explain failure or recovery honestly, and never create an alternate path around trusted truth or human approval.

The slice must prove manager-style orchestration through product behavior rather than agent personas or hidden prompt choreography.

### Minimum implementation scope

1. **Versioned specialist contract**
   - Define typed input, typed output, specialist name and version, allowed truth tier, allowlisted tools, timeout, failure result, and evidence identifiers.
   - Reject malformed or permission-violating handoffs before synthesis.

2. **Specialist registry and manager routing**
   - Formalize the existing assistant semantic-planning seam as the Tomo manager.
   - Route only allowlisted intents to `verification_intelligence` or `care_operations`.
   - Refuse irrelevant, ambiguous, unsupported, or medically interpretive delegation.
   - Keep deterministic routing available when the supported intent is already explicit.

3. **Verification Intelligence handoff**
   - Reuse the shipped Phase 3E.5 service rather than rewriting its reasoning.
   - Pass only the current document identifier, candidate fingerprint, bounded source metadata, and authorized review inputs.
   - Return the versioned assessment or typed cached, stale, manual-review, unavailable, or malformed result.
   - Keep the specialist read-only except for its existing review assessment write.

4. **Care Operations Agent**
   - Begin with the existing Simparica and Adequan home-medication path rather than generalizing every care lifecycle at once.
   - Read trusted reminders, administrations, and relevant action state.
   - Determine whether the request is answer-only, ambiguous, ineligible, already handled, or eligible for one governed proposal.
   - Use deterministic medication rules and the existing action-preparation service as restricted tools.
   - Return a structured reconciliation and, only when eligible, a proposed existing `care_action` for Rosa's review.
   - Never infer that medication was administered from a reminder, due date, vague statement, or agent judgment.

5. **Durable orchestration trace**
   - Reuse and extend `orchestration_runs`; do not create another run table.
   - Preserve existing Librela workflow rows and behavior.
   - Record workflow type and version, manager decision, specialist name and version, bounded evidence identifiers, handoff status, pending human decision, failure or recovery status, and final result state.
   - Do not store raw source text, prompts, hidden reasoning, access credentials, or private care narrative in the trace.

6. **Governed action linkage**
   - Keep `care_actions` as the only action ledger.
   - If Phase 3E.6 links home-medication actions to orchestration runs, update the existing database constraint narrowly for the allowlisted action type and preserve the atomic execution contract.
   - Do not let orchestration status replace or override care-action status.

7. **Manager synthesis and visible evidence**
   - Tomo owns the final response and must remain faithful to the specialist result and limitations.
   - Return a concise safe trace summary such as manager decision, specialist used, evidence count, result status, and human-control boundary.
   - Make the trace inspectable in the product without exposing hidden reasoning or private source content.
   - Preserve the same result and approval boundary across Chat and Voice.

8. **Timeout, retry, and recovery**
   - Use typed timeout, unavailable, malformed-result, stale-evidence, partial-result, and permission-denied failures.
   - Repeated identical requests recover or reconcile the active run rather than duplicating specialist work or care actions.
   - Changed evidence supersedes or invalidates the earlier run before new work begins.
   - Tomo explains whether Rosa can retry, review manually, or continue through an existing deterministic fallback.

### Required schema review

The current `orchestration_runs.current_step` constraint is specialized to the existing Librela workflow. Phase 3E.6 must decide whether to extend it with manager and specialist steps or represent the new trace inside the existing compatible state model. Any migration must preserve old rows, the Librela action-sync trigger, active-run uniqueness, and repository recovery behavior.

The current `care_actions.orchestration_run_id` constraint allows only `send_librela_appointment_request`. Link a home-medication proposal only after a narrow migration explicitly permits `mark_home_medication_given`; otherwise keep the initial Care Operations trace read-only and leave the existing care-action proposal unlinked. Do not loosen the constraint generically.

### Evaluation contract

Phase 3E.6 requires tests for:

1. Correct specialist selection for document review and bounded home-medication care operations
2. No specialist call for irrelevant, unsupported, social, or medically interpretive requests
3. Schema-conformant input and output for every specialist
4. Bounded context and allowlisted tool access
5. Verification Intelligence read-only authority and current-fingerprint enforcement
6. Care Operations use of trusted state and deterministic medication rules
7. Zero unapproved trusted-state or external mutation
8. Faithful manager synthesis without invented evidence or hidden specialist failure
9. Timeout, unavailable model, malformed result, stale evidence, partial result, and permission denial
10. Active-run recovery, context-change supersession, retry safety, and no duplicate care action
11. Trace completeness without raw source content, prompts, private narrative, or hidden reasoning
12. Stable Chat and Voice behavior
13. No regression in the persisted Librela workflow, home-medication lifecycle, Verification Intelligence, governed actions, attention, Profile, Calendar, or Messages handoff

### Manual acceptance scenarios

1. A current document review shows that Tomo selected Verification Intelligence and returned its current structured assessment without changing trusted records.
2. “I gave Momo her Simparica today” routes to Care Operations, produces one existing governed proposal, and still requires Rosa's explicit approval before the trusted administration transaction.
3. “When did I last give Momo Simparica?” remains answer-only and creates no proposal.
4. “I may have given Momo Adequan” produces clarification or a safe ambiguous result and no action.
5. A repeated eligible request recovers the same run and care action rather than creating duplicates.
6. Changed candidate or trusted evidence invalidates the earlier run and requires a new assessment.
7. A specialist timeout produces a truthful fallback and no state mutation.
8. The visible trace identifies the manager and specialist boundary without exposing source text or hidden reasoning.

### Explicitly out of scope

- Phase 3E.7 vaccine, annual wellness, senior-lab, or preventive-screening lifecycle
- Lab-result extraction, analyte comparison, medical interpretation, diagnosis, urgency, or treatment advice
- A general-purpose autonomous planner or recursive agent loop
- Peer-to-peer specialist negotiation, an agent swarm, or Agent-to-Agent protocol
- A specialist for Calendar, Messages, arithmetic, date math, database writes, or every module
- New provider delivery, inbound reply interpretation, or autonomous communication
- Weight-trend visualization, avatar recovery, demo environment, synthetic Gmail ingestion, or final portfolio polish
- Broad Inbox, Recently verified, appointment, or Profile expansion

## Phase 3E.6 definition of done

Phase 3E.6 is complete only when:

- Tomo is the explicit manager for the two allowlisted specialist boundaries.
- Verification Intelligence is called through a versioned, permission-checked handoff without weakening Phase 3E.5 governance.
- Care Operations owns one bounded home-medication reconciliation and proposal path while deterministic services retain all calculations and execution.
- Durable runs recover safely and do not duplicate specialist work or care actions.
- The user can inspect a concise trace of manager, specialist, evidence, result, and human-control state.
- Specialist and system-level evals cover routing, permissions, failures, recovery, and zero unapproved mutations.
- Existing lifecycle, Verification, assistant, action, Calendar, Messages, Profile, attention, and Voice behavior remains green.
- Rosa completes the manual acceptance scenarios.
- Documentation and portfolio claims are updated only after the behavior is validated and merged.

## Recommended branch

After the documentation checkpoint is committed on `main`, create:

```bash
git switch -c phase-3e-6-multi-agent-orchestration
git push -u origin phase-3e-6-multi-agent-orchestration
```

## Pasteable opening message for the next chat

```text
We completed and merged TomoCare Phase 3E.5 at cfaeb49. I am now on the phase-3e-6-multi-agent-orchestration branch.

Use docs/Phase3E5_Closeout_and_Phase3E6_Handover.md as the current implementation handover, docs/TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md as the agent-boundary decision, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for sequence, and docs/TomoCare_Operating_Brief.md for durable principles.

We are starting Phase 3E.6 — Tomo Multi-Agent Orchestration Foundation and Care Operations Agent.

First inspect the existing assistant semantic-planning seam, Phase 3E.5 Verification Intelligence service, persisted Librela orchestration workflow, orchestration_runs schema and repository, care_actions constraints, and home-medication action path. Then propose the smallest implementation plan that satisfies the accepted manager, specialist, permission, trace, recovery, and evaluation contract before changing code.

Do not create a parallel action ledger or orchestration table. Reuse the shipped Verification Intelligence capability and existing deterministic services. Begin Care Operations with the bounded Simparica and Adequan home-medication path. Preserve human verification, care-action approval, atomic execution, idempotency, Calendar and Messages boundaries, and truthful failure behavior.

Do not begin Phase 3E.7 preventive care, labs, weight visualization, avatar recovery, demo-environment, synthetic Gmail, or portfolio-polish work in this slice.
```
