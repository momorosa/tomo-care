# TomoCare Product Roadmap and Portfolio Checkpoint

**Decision date:** August 16, 2026

**Owner:** Rosa Choi

**Status:** Accepted product direction

## Decision

TomoCare will remain **one product and one codebase with two release tracks**:

1. **Real-care track:** the long-term, continuously evolving assistant Rosa genuinely uses to manage Momo's care.
2. **Portfolio track:** a bounded, reliable, visually polished release of the same governed product for interviews and portfolio demonstration.

The portfolio release is not a separate product, fork, or simplified mock application. It is a controlled checkpoint inside the real TomoCare journey, using the same architecture and governance model with a separate, resettable demo environment.

## Why this decision

The two purposes have different definitions of success.

| | Real-care track | Portfolio track |
| --- | --- | --- |
| **Primary outcome** | Keep Rosa on top of Momo's care over time | Make TomoCare's value, judgment, architecture, and experience legible in a 10–15 minute review |
| **Time horizon** | Long-term and continuously evolving | Short-term and deliberately finishable |
| **Data** | Momo's real private records | Synthetic, resettable Momo demo data |
| **Priority** | Care usefulness, correctness, and completeness | Narrative clarity, reliability, and demo quality |
| **Release model** | Ongoing product development | Tagged and documented portfolio checkpoint |

Trying to complete the entire long-term health-assistant vision before preparing the portfolio would delay the job-search goal and blur the strongest story. Splitting the products or codebases would create unnecessary drift. The chosen approach preserves one governed foundation while allowing a stable portfolio finish line.

## Shared product foundation

Both tracks retain the same TomoCare principles and architecture:

- Source truth, candidate truth, and trusted truth remain distinct.
- AI can prepare; the human approves.
- LLM interprets; the database calculates; citations prove.
- Planned, proposed, approved, handed off, and completed states are not interchangeable.
- Medical interpretation and consequential action remain bounded.
- Evals express the product's promises and protect them as coverage grows.
- Voice and animation remain presentation layers over the same grounded assistant.
- Agents reason over ambiguity; deterministic services calculate, validate, persist, and execute.
- Tomo remains the user-facing manager; specialists receive bounded context and permissions and return structured handoffs.

The accepted agent architecture and build gates are recorded in [TomoCare Multi-Agent Orchestration Decision and Build Plan](./TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md).

## Long-term real-care north star

The real-care track is a comprehensive health sidekick for Momo. It should eventually help Rosa manage and understand:

- Longitudinal weight trends
- The full Librela lifecycle: source invoice, verification, trusted administration, cost, reminder, appointment request, Calendar follow-through, insurance filing, and completion state
- Home-care lifecycles for Adequan and Simparica Trio, including administration, successor reminders, and later refill or renewal planning
- Vaccine records, clinic-reported status, due dates, reminders, and verified administrations
- Annual laboratory panels, urine tests, imaging, and related medical documents
- Longitudinal results across analytes, units, reference ranges, abnormal flags, specimen types, and comparable test history
- Momo's current health summary and care timeline
- Preparation of questions, concerns, and evidence for annual checkups and other vet visits
- Governed preparation of appointment, medication-renewal, and care follow-up requests

This remains a north star, not the scope required before the portfolio checkpoint. Labs, urinalysis, imaging, and broad clinical-document intelligence require their own carefully governed product phases.

## Portfolio v1 objective

Portfolio v1 should demonstrate three connected product stories rather than maximize feature count.

### 1. Messy source to trusted memory

A synthetic invoice arrives through the demo Gmail workflow. TomoCare extracts candidate information, directs Rosa's attention to meaningful uncertainty, preserves the source, and materializes only human-verified facts.

### 2. Trusted memory to useful intelligence

Tomo answers through Chat and Voice, explains the verified weight trend, identifies what needs attention, distinguishes missing or incomplete state, and shows the governing record or source evidence.

### 3. Intelligence to governed follow-through

Tomo prepares a Librela appointment request from trusted state, Rosa reviews it, and the native Messages handoff preserves Rosa as the sender without claiming delivery or booking.

## Portfolio-readiness sequence

The sequence was refined after Phase 3E.4 shipped. Product improvements that benefit both real care and the portfolio should land before the separate demo environment is finalized. A wholly fictional document fixture will be introduced early for safe testing, while the polished invoice and Gmail demonstration remain later work.

1. **Phase 3E.4 — Governed Profile Grounding · Shipped**
   - Answer bounded Profile questions from the current `pets` row.
   - Calculate age from the TomoCare care date.
   - Keep governed identity separate from harmless relationship context.
   - Open the existing Profile panel through typed, read-only navigation.

2. **Phase 3E.5 — Verification Intelligence Agent · Shipped**
   - Establish TomoCare's first formal specialist-agent contract.
   - Compare the current source and candidate with deterministic checks and up to five recent comparable trusted records.
   - Establish a repeated pattern only after at least three consecutive comparable verified records.
   - Group consistent low-risk fields, surface meaningful changes and conflicts, and acknowledge prominent unsupported content.
   - Preserve human-controlled promotion to trusted truth and enforce current-assessment fingerprints on the backend.
   - Use a wholly fictional fixture for safe tests without completing the demo Gmail workflow.

3. **Phase 3E.6 — Tomo Multi-Agent Orchestration Foundation and Care Operations Agent**
   - Make Tomo the explicit manager that selects specialists and synthesizes their evidence.
   - Expose Verification Intelligence through a typed, read-only specialist handoff.
   - Wrap existing reminder and care-action reconciliation as the Care Operations Agent.
   - Reuse `orchestration_runs` and `care_actions` for durable run and action state.
   - Add permission enforcement, concise traces, timeouts, retries, stale-state handling, and specialist-specific evals.
   - Keep trusted materialization and Calendar or Messages execution behind deterministic server contracts and human approval.

4. **Phase 3E.7 — Preventive Care Lifecycle**
   - Cover vaccines, annual wellness exams, annual senior-lab panels, and bounded preventive screening such as heartworm testing.
   - Extract source-linked candidates and distinguish `due`, `scheduled`, `completed`, and `unknown` state.
   - Deduplicate repeated source entries and require one grouped human review before activating care actions.
   - Reconcile later completion evidence, reminders, dashboard state, grounded answers, and Google Calendar through the existing governed boundaries.
   - Never treat a future reminder as proof of administration or completion.
   - Track senior-lab lifecycle state without interpreting results, analytes, units, reference ranges, or medical significance.

5. **Verified weight-trend visualization**
   - Plot verified measurements only.
   - Preserve source access and trust state for each point.
   - Keep Tomo's explanation consistent with the chart's deterministic data.
   - Avoid medical conclusions about the trend.

6. **Animate Tomo reliability and recovery**
   - Make Runway/LiveKit fallback visible and non-blocking.
   - Offer a safe retry while preserving uninterrupted local voice.
   - Retain a typed failure reason for diagnosis.

7. **Demo environment and resettable synthetic dataset**
   - Keep one application codebase.
   - Use separate demo configuration and data from Momo's live care records.
   - Prefer a separate hosted Supabase demo project for interview reliability.
   - Seed deterministic records and provide one safe reset path.
   - Use a dedicated demo inbox if Gmail ingestion will be shown live.
   - Keep Google Calendar and Apple Messages destinations demo-safe.
   - Display a clear Demo indicator so synthetic and real state cannot be confused.

8. **Synthetic invoice and demo Gmail ingestion**
   - Finalize a clearly labeled `SAMPLE — DEMO DATA` invoice using a fictional clinic and identifiers.
   - Include a realistic Librela visit, weight, costs, insurance-relevant information, and a vaccine-status section.
   - Send it through a dedicated demo-safe inbox and exercise the completed verification path.
   - Prevent the workflow from affecting Momo's live records or external destinations.

9. **Final Voice, animation, and UI polish**
   - Refine listening, thinking, speaking, playback, and idle transitions.
   - Resolve visual inconsistencies, dead ends, and unclear state changes across the end-to-end demo.

10. **Demo evidence and portfolio freeze**
   - Rehearse one deterministic end-to-end path.
   - Capture screenshots and video evidence.
   - Prepare a recorded fallback for provider-dependent moments.
   - Update the case study so shipped behavior and future direction remain distinct.
   - Tag the accepted checkpoint as the portfolio v1 release before returning to broader real-care work.

## Demo data and environment policy

Real Momo records remain appropriate for private product use and validation. Portfolio and interview demonstrations should use synthetic data by default because screenshots and recordings can preserve clinic details, invoice identifiers, insurance information, recipient data, and medical history beyond the live presentation.

The demo environment should therefore be:

- Separate from Momo's live data and provider destinations
- Reproducible from migrations and seed data
- Resettable without affecting real care history
- Safe to demonstrate repeatedly
- Explicitly labeled as demo data
- Governed by the same trust, approval, and abstention rules as the real product

Supabase's documented environment and seed workflows support this direction:

- [Managing environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Seeding a database](https://supabase.com/docs/guides/local-development/seeding-your-database)

## Verification-intelligence and orchestration decision

Human verification remains central, but the interface should become more selective and useful. TomoCare should not equate governance with asking the user to manually confirm every extracted value.

Phase 3E.5 verification improvements now:

- Allocate human attention according to uncertainty and consequence
- Group internally consistent, low-risk administrative fields
- Require deliberate review for fields that affect care state or downstream workflows
- Explain why a field is important
- Surface contradictions, omissions, and unsupported source sections
- Preserve corrections as structured feedback for extraction and normalization improvement

This verification capability is the first justified specialist agent because it has a distinct evidence context, read-only authority, comparison responsibility, failure modes, and eval contract. Phase 3E.6 then makes the handoff explicit and adds a second justified specialist around care-state reconciliation.

The chosen pattern is a small manager-style hybrid system:

- Tomo owns conversation, routing, synthesis, approval guidance, and recovery language.
- The Verification Intelligence Agent owns document comparison and review assessment.
- The Care Operations Agent owns trusted lifecycle reconciliation and proposed next steps.
- Deterministic modules own date math, invoice arithmetic, schema validation, fingerprints, materialization, idempotency, and provider calls.
- Rosa retains promotion and consequential-action approval.

No new agent should be added merely to wrap a module or API. A specialist must make context, responsibility, permission, recovery, and evaluation clearer than the existing architecture.

This work is part of the core governed-AI thesis and has higher portfolio priority than decorative polish.

## Preventive-care boundary for portfolio v1

Portfolio v1 should demonstrate a bounded preventive-care lifecycle for vaccines, annual wellness, annual senior-lab tracking, and a small allowlist of preventive screening. The lifecycle may track due, scheduled, and completed state, but it does not interpret lab results or infer that a future reminder proves completed care.

Allowed claim:

> The latest verified clinic record lists rabies as due on MM-DD-YYYY.

Disallowed claim without a separate trusted administration event:

> Momo received her rabies vaccine.

No preventive-care reminder becomes active unless its date meaning and source state have been verified and Rosa approves the applicable Phase 3E.7 care-action contract.

## Deferred until after portfolio v1

- Medication refill or prescription-renewal lifecycle, unless a trustworthy and very small source rule is identified
- Lab-result interpretation, longitudinal analyte comparison, urinalysis, imaging, and broad medical-document intelligence
- Current-health inference, diagnosis, urgency judgment, or treatment recommendation
- Broad durable relationship memory
- Generic feedback controls that do not lead to source review or a concrete product-learning loop
- Decentralized agent swarms, recursive delegation, or an agent for every module
- Agent-to-Agent protocol inside the current single application unless independently deployed or externally owned agents create a real interoperability need

## Portfolio v1 definition of done

The portfolio checkpoint is ready when:

- The three demo stories work end to end from a resettable synthetic starting state.
- No demo action can affect Momo's live records, clinic contact, Calendar, or inbox.
- Verification directs attention to meaningful uncertainty and does not silently ignore the vaccine section.
- The manager-to-specialist trace makes evidence, approval, and deterministic execution boundaries legible without exposing private content or hidden reasoning.
- Profile, weight, attention, reminders, and the Librela request agree across UI, Chat, and Voice.
- Every factual answer or operational calculation has a governing record or trusted source.
- The Messages experience remains an approved draft handoff and makes no delivery or booking claim.
- Voice and animation failures preserve the answer and provide a visible recovery path.
- The demo has a rehearsed live path and recorded fallback.
- Focused tests, the full regression suite, production build, and manual demo validation pass.
- The case study clearly separates shipped capability, portfolio checkpoint, and long-term north star.

## Immediate next step

Begin **Phase 3E.6 — Tomo Multi-Agent Orchestration Foundation and Care Operations Agent** using the bounded manager, specialist, tool, permission, trace, recovery, and evaluation contract in the current handover and orchestration decision. Reuse the shipped Verification Intelligence capability, `orchestration_runs`, `care_actions`, and existing deterministic lifecycle services rather than creating a parallel action or persistence system.

## Maintenance rule

Update this document when the two-track strategy, portfolio checkpoint scope, demo-data policy, roadmap order, or portfolio definition of done changes. Record ordinary implementation details, branch names, care dates, and slice-level validation in the latest Current State and Handover document.
