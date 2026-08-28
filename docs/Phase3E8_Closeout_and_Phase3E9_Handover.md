# TomoCare Current State: Phase 3E.8 Closeout and Phase 3E.9 Handover

**Closeout date:** August 28, 2026

**Current branch:** `main`

**Phase 3E.8 implementation:** `238576d` — `feat(phase-3e-8): add verified weight trend`

**Phase 3E.8 merge:** `3d33b25` — `Merge Phase 3E.8 verified weight trend`

**Next bounded slice:** Phase 3E.9 — Governed Profile Detail and UI Refinement

## Purpose

This handover records the shipped Phase 3E.8 verified weight-trend contract, automated and manual validation, accepted product refinements, current boundaries, revised portfolio sequence, and the opening contract for the bounded Phase 3E.9 Profile enhancement.

Phase 3E.8 is merged and pushed to `main`. The local `.claude/` directory and `tomo-care-phase-3e-7a-start.zip` remain intentionally untracked and are not product source.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. Current database and persisted care state
3. This handover for the settled Phase 3E.9 contract and next-slice scope
4. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md) for accepted sequencing and portfolio scope
5. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md) for durable product and governance principles
6. [TomoCare Multi-Agent Orchestration Decision and Build Plan](./TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md) for manager, specialist, deterministic-tool, and approval boundaries
7. Earlier handovers for historical context

When an older document conflicts with current code, tests, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Phase 3E.8 shipped result

When Rosa asks Tomo about Momo's weight trend, TomoCare now returns one grounded result with:

- the complete deterministic narrative;
- a typed, versioned `verified_weight_trend` visualization payload;
- a responsive chart built from the complete verified history in the requested range;
- latest, lowest, and highest verified summary values;
- a source-linked interactive point for every plotted fact;
- an expandable newest-first evidence list capped at ten recent verified sources; and
- concise Voice speech that leads with the latest verified weight and measured change.

The chart and speech do not replace the written answer or evidence. They are additional presentations of the same trusted facts.

## Shipped architecture

### One server-owned verified presentation contract

`server/assistant/weightTrendPresentation.js` owns the ordered verified point set and deterministic summary. It accepts only verified weight facts with valid dates and numeric values, preserves stable date-plus-fact-ID ordering, keeps duplicate-date facts traceable, and returns every qualifying point in the requested range.

The payload keeps kg canonical and includes deterministic lb display values. `answerComposer.js` uses that same presentation for the narrative and citations rather than calculating a separate chart interpretation.

No browser text parsing, model-generated chart data, extraction change, historical backfill, database migration, provider change, or new agent was introduced.

### Full chart history and concise evidence remain separate

The chart receives the complete verified point history. `citationPresentation.js` continues to limit only the visible evidence drawer to the ten newest sources. The presentation cap does not affect chart points, deterministic calculations, Voice speech, or source traceability.

### Shared Chat and Voice presentation

`AssistantPanel.jsx` renders the typed chart inside the shared assistant turn used by Chat and the Voice transcript. Both surfaces therefore receive the same factual visualization payload and source actions.

`spokenAnswer.js` recognizes the typed weight visualization and composes a short deterministic spoken answer from it. The spoken form states the latest verified weight, latest date, number of verified readings, start of the period, measured overall change, and factual direction. It does not truncate after a warm opening or qualitative headline. The full answer remains visible on screen.

If the typed payload is absent or inconsistent, Voice falls back to the existing bounded written-answer behavior rather than manufacturing a summary.

## Accepted product and visual decisions

- Every plotted point is verified, source-linked, and keyboard accessible.
- The chart uses the complete requested history even when more than ten evidence cards exist.
- Kg remains the canonical calculation unit. The chart starts with lb as the primary display for Rosa's U.S. context and provides a visible lb/kg selector.
- Changing the display unit does not change point geometry, ordering, calculations, or source identity.
- Purple means a verified reading. A white ring means the currently selected reading. The chart includes a direct key for both states.
- Highest and lowest are communicated through labeled summary cards and accessible text rather than a third unexplained point color.
- Selecting a point or summary card updates a highlighted detail panel with a reduced-motion-safe transition.
- The verification-record action occupies its own row so it remains readable in the narrow Voice transcript and wider Chat panel.
- Container-based responsiveness follows the chart's available width instead of the browser viewport.
- One verified reading is presented as one reading, not a trend. Duplicate dates and tied values remain separate traceable facts.
- No goal weight, ideal range, warning zone, risk score, prediction, diagnosis, treatment advice, or clinical interpretation appears.

## Validation and acceptance evidence

Rosa's local validation of the initial Phase 3E.8 implementation reported:

- `57`, `23`, `49`, `99`, and `332` passing Node tests across the requested suites;
- `3` passing Python tests; and
- a successful production build.

After the chart UI refinement, Rosa reported that all requested tests passed, the production build succeeded, and manual testing confirmed the responsive action row, clear point states, more visible selection behavior, and lb/kg display choice.

The final Voice refinement was validated with:

- `71/71` Phase 3E.8 tests;
- `102/102` Voice regression tests;
- a passing syntax check for the changed spoken-answer module; and
- manual confirmation from Rosa that the final weight-trend speech was concise, complete, and useful.

Manual testing also confirmed:

- the chart and narrative agree;
- the chart shows all 12 verified readings while the visible source list remains capped at ten;
- verification records open from selected points;
- the chart remains usable in Chat and the narrow Voice transcript;
- the selected-state and point meanings are understandable without inference;
- lb can be the primary display without changing kg-canonical calculations; and
- Tomo creates no action and makes no medical claim from the trend.

## Phase 3E.8 boundaries that remain in force

- Only verified weight facts may support the chart, narrative, summary, and speech.
- The chart is returned only for the supported `weight_trend` answer.
- Trusted weight facts cannot be edited or deleted from this surface.
- No proactive alert, target range, medical interpretation, or cross-domain health intelligence is created.
- Weight is not correlated with Librela, other medication, labs, diet, activity, pain, or symptoms.
- No provider, model, prompt, extraction, database schema, or external-action behavior changed.
- Source traceability and existing human approval boundaries remain intact.

## Revised near-term sequence

1. **Phase 3E.9 — Governed Profile Detail and UI Refinement**
2. **Animate Tomo reliability and recovery**
3. **Separate resettable demo environment and synthetic dataset**
4. **Synthetic veterinary documents and demo-safe Gmail intake**
5. **Final Voice, animation, and end-to-end UI polish**
6. **Demo evidence, case study, and portfolio checkpoint freeze**
7. **Broader preventive and health-intelligence work as later bounded Real-Care slices**

Phase 3E.9 is intentionally inserted before Animate Tomo recovery. It closes a small Profile consistency gap discovered during Phase 3E.8 manual testing, requires no migration or provider work, and should settle before synthetic demo data and final UI polish are stabilized.

## Next bounded slice: Phase 3E.9 — Governed Profile Detail and UI Refinement

### User problem

Momo's microchip number is important, difficult to remember, and useful during travel, clinic, and identification workflows. The `pets` table already stores `microchip_id`, but the governed Phase 3E.4 Profile allowlist does not select, normalize, display, or answer from it.

The Profile drawer also presents identity, verified-care summary, reminders, clinic, and insurance in one undifferentiated list. The next slice should improve this hierarchy without turning the drawer into a general Profile editor or broad redesign.

### Accepted outcome

After Phase 3E.9:

1. Momo's stored microchip number appears in the Profile drawer under a clear Profile-details group.
2. Rosa can ask Tomo directly for Momo's microchip number in Chat or Voice.
3. Tomo answers only from `pets.microchip_id` and states honestly when it is missing or the Profile source is unavailable.
4. Broad Profile summaries do not automatically volunteer or speak the microchip identifier.
5. The drawer separates governed Profile details from the existing care overview and supports long identifiers without truncation or layout pressure.
6. Existing Profile navigation, care dates, reminders, portrait, and relationship-language boundaries remain unchanged.

### Governed data contract

`public.pets.microchip_id` is the only new governed field in this slice. It is an existing nullable `text` column. Phase 3E.9 requires no database migration.

The implementation should:

- add `microchip_id` to the explicit `PROFILE_SELECT` allowlist;
- normalize it as trimmed text without guessing, reformatting, or validating against one country's identifier convention;
- add it to the Profile field and optional-missing contracts;
- preserve the existing `pets` row as the governing reference;
- carry it through the dashboard care summary;
- add a bounded `microchip_id` Profile focus to deterministic and semantic routing; and
- compose direct, missing, and unavailable answers without using relationship memory or screen text as authority.

The implementation must continue to reject `select("*")` and broad pets-row exposure.

### Product and privacy decisions

- Show the full stored identifier in Rosa's private real-care Profile because the purpose is retrieval, not masking.
- Use only synthetic microchip identifiers in automated fixtures, screenshots, portfolio evidence, and demo data.
- Do not log, add to orchestration traces, or include the identifier in unrelated citations or telemetry.
- Do not volunteer the microchip number in broad Profile answers or routine Voice speech.
- Preserve the exact stored value. Do not infer country, manufacturer, registration status, or ownership from the number.
- Keep primary clinic and insurance as their current presentation-only labels. Phase 3E.9 does not create a governed source for them or let Tomo answer from them.

### Minimum visual refinement

- Preserve the existing portrait and identity summary.
- Add a small **Profile details** group for governed identity fields, including the microchip number.
- Add a separate **Care overview** group for latest verified care, last Librela, active reminders, and the existing presentation-only labels.
- Allow long identifiers to wrap or use a readable tabular treatment without shrinking adjacent labels.
- Show an honest `Not recorded` state when `microchip_id` is null.
- Keep the current drawer width, navigation model, dark visual system, and responsive behavior.
- Do not add editing, a copy-to-clipboard control, new tabs, a modal, or a full Profile redesign in the minimum slice.

### Required tests

Phase 3E.9 should prove:

1. The Profile repository selects the prior allowlisted fields plus `microchip_id`, never `*`.
2. Normalization preserves a valid stored identifier, trims surrounding whitespace, and keeps missing values null.
3. A missing microchip marks the Profile partial without affecting required identity fields.
4. Local and semantic planners route direct microchip questions to `profile_summary` with `profile_focus = microchip_id`.
5. Direct Chat and Voice answers return the governed identifier and no unrelated Profile or relationship facts.
6. Missing and unavailable states do not guess from source documents, conversation memory, or screen text.
7. Broad Profile summaries and spoken answers do not volunteer the microchip identifier.
8. Profile-edit requests remain behind the existing governance boundary and do not mutate `pets`.
9. The dashboard care summary carries only the bounded normalized field set.
10. The Profile drawer shows the exact value or `Not recorded`, keeps long values readable, and preserves existing navigation and care-summary content.
11. Fixtures, logs, traces, and package contents contain no real microchip number.
12. Existing Profile, assistant, semantic routing, Voice, dashboard accessibility, and production-build checks remain green.

### Manual acceptance scenarios

1. Open Momo's Profile and confirm the stored microchip number is visible under Profile details.
2. Confirm the identifier is readable at the current drawer width and does not compress labels or overflow.
3. Ask in Chat and Voice, “What is Momo's microchip number?” and confirm both use the stored `pets` value.
4. Ask a broad Profile question and confirm Tomo does not automatically recite the identifier.
5. Validate the null state with synthetic data and confirm the UI and Tomo say it is not recorded rather than guessing.
6. Confirm Profile navigation, latest verified care, last Librela, reminders, portrait, and relationship language still work.
7. Confirm no Profile edit, trusted-state write, external action, or provider call occurs.

### Explicitly out of scope

- Database schema changes or a separate identity table
- Profile editing, microchip registration, ownership changes, or verification workflows
- Copy-to-clipboard, export, wallet, QR code, or travel-document automation
- Primary-clinic or insurance source governance
- Additional pet identifiers, multi-pet support, or household identity modeling
- Medical interpretation or new health facts
- New extraction behavior or document backfill
- Relationship-memory expansion
- Animate Tomo recovery or broader Voice polish
- Demo environment, synthetic-document production, or Gmail demo work

## Phase 3E.9 definition of done

Phase 3E.9 is complete only when:

- `microchip_id` flows through one explicit governed Profile read contract;
- direct Chat and Voice questions use the governed `pets` value;
- broad Profile summaries do not volunteer the identifier;
- missing and unavailable states remain honest;
- the Profile drawer has clear Profile-details and Care-overview grouping;
- long identifiers remain readable at the supported drawer widths;
- existing Profile navigation and care-summary behavior remain intact;
- no Profile editing, migration, provider, or broader identity scope is added;
- affected Profile, assistant, Voice, dashboard, accessibility, and build checks pass; and
- Rosa completes the manual acceptance scenarios.

## Recommended branch

After this documentation checkpoint is committed and pushed on `main`, create:

```bash
git switch -c phase-3e-9-governed-profile-detail
git push -u origin phase-3e-9-governed-profile-detail
```

## Pasteable opening message for the next implementation chat

```text
We completed and merged TomoCare Phase 3E.8 at 3d33b25. I am now on the phase-3e-9-governed-profile-detail branch.

Use docs/Phase3E8_Closeout_and_Phase3E9_Handover.md as the current implementation handover, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for the accepted sequence and portfolio scope, docs/TomoCare_Operating_Brief.md for durable product and governance principles, and docs/TomoCare_Database_Schema_Reference.md for the existing pets.microchip_id column.

We are starting Phase 3E.9 — Governed Profile Detail and UI Refinement.

First inspect the existing Profile repository allowlist, governed normalization and missing-state contract, deterministic and semantic Profile routing, answer composition, Voice shortening, dashboard care summary, CareSidebar Profile drawer, accessibility tests, and affected regressions. Then walk me through the smallest architecture and product decisions before preparing code.

Add only pets.microchip_id to the governed Profile read contract. Support direct Chat and Voice questions, keep the identifier out of broad Profile speech, show it under a clear Profile-details group, separate the existing Care overview visually, and preserve long-identifier readability and honest missing states.

Do not add Profile editing, clipboard actions, schema changes, new extraction behavior, clinic or insurance governance, multi-pet identity, relationship-memory expansion, medical interpretation, Animate Tomo recovery, demo-environment work, or provider changes in this slice.
```
