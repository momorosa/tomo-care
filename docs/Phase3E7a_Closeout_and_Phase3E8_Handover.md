# TomoCare Current State: Phase 3E.7a Closeout and Phase 3E.8 Handover

**Closeout date:** August 27, 2026

**Phase 3E.7a implementation:** `74e65b9` — `feat(phase-3e-7a): add verified preventive status capture`

**Phase 3E.7a merge:** `40cd59e` — `Merge Phase 3E.7a verified preventive status capture`

**Next bounded slice:** Phase 3E.8 — Verified Weight-Trend Visualization

## Purpose

This handover records the shipped Rabies evidence foundation, the real-document and automated validation evidence, accepted limitations, the revised portfolio sequence, and the opening contract for the verified weight-trend visualization.

Use these documents in priority order:

1. `docs/TomoCare_Operating_Brief.md` for durable product and governance principles
2. `docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md` for the accepted two-track sequence and portfolio boundary
3. This handover for the current shipped state and Phase 3E.8 implementation contract
4. `docs/Phase3E7a_Verified_Rabies_Evidence.md` for the detailed Rabies candidate, materialization, recovery, and private manual-test contract
5. `docs/Phase3E0d_Product_Handover.md` for the original verified-weight foundation and deferred chart requirements

At this checkpoint, local `main`, `origin/main`, and `origin/HEAD` point to `40cd59e`.

## Phase 3E.7a outcome

Phase 3E.7a proves one real preventive-evidence flow end to end without creating a general preventive-care system:

1. Veterinary receipts and official Rabies certificates can arrive through Tomo's dedicated Gmail inbox.
2. Tomo stores the source PDF and readable source text before trusting extracted fields.
3. Candidate vaccine evidence keeps administration, clinic-reported next due, explicit clinic status, and product expiration as different meanings.
4. Verification Intelligence compares the candidate with the current source and trusted history.
5. Rosa can correct the clinical organization and other supported candidate fields before approval.
6. A server-only transaction materializes certificate-backed Rabies administration and clinic-reported preventive status as separate trusted records.
7. Agent Tomo answers administration, due-date, and certificate questions from the corresponding trusted event, fact, and document.
8. No preventive reminder, Calendar action, insurance action for a vaccination certificate, or medical interpretation is created.

The foundation is future-ready for additional vaccine types, but only `rabies` may materialize in the shipped slice.

## Shipped trust distinctions

| Source statement | Candidate meaning | Trusted result after approval | Never means |
|---|---|---|---|
| Official certificate administration date | `administration` / `administered_on` | Verified vaccine event linked to the certificate | A receipt reminder or inferred treatment |
| Clinic's next-due date | `next_due` / `clinic_reported_next_due` | Verified preventive-care status fact | A reminder, appointment, or Tomo-calculated schedule |
| Explicit clinic status | Clinic-reported status | Status field inside the trusted preventive fact | A status inferred from today's date |
| Product or vial expiration | Product metadata | Metadata on the verified administration evidence | Momo's vaccine expiration or next-due date |
| Receipt vaccine line or reminder | Source-visible unsupported content | Remains candidate/source context unless separately supported | Certificate-backed administration |

## Architecture after Phase 3E.7a

### Gmail and document recovery

- Gmail intake accepts varied receipt, invoice, vaccine, certificate, and otherwise-unknown PDF filenames from the dedicated veterinary inbox.
- Transport sender identity remains separate from clinical organization provenance.
- An `ingested` document can retry on the next explicit **Check inbox** action without duplicating reviewed or verified work.
- Readable source text and candidate truth survive structured-extraction or review interruption.
- The dashboard names the failed file, explains the processing stage in user language, and offers direct recovery actions.

### Verification recovery and correction

- Source comparison has a bounded deadline inside the specialist deadline.
- A comparison timeout produces a persisted fail-safe assessment in which every field remains untrusted.
- Verify Docs offers **Retry AI review**, **Continue with manual review**, and **Review later** for the timeout state.
- Every unverified document with saved candidate data also offers **Recheck with AI**.
- Rechecking does not approve fields or materialize trusted records.
- Saving a correction invalidates the stale assessment while preserving accepted fields only when their value and risk state remain unchanged.

### Trusted materialization

- `supabase/migrations/202608260001_materialize_verified_vaccine_evidence.sql` owns validation, deduplication, provenance accumulation, and trusted writes.
- Certificate-backed administration materializes as a verified vaccine event.
- Clinic-reported due/status materializes as a verified `preventive_care_status` fact.
- Matching receipt and certificate due dates accumulate provenance without duplicating the fact.
- Conflicting trusted due dates block rather than silently selecting a source.

### Grounded Agent Tomo behavior

- “When was Rabies given?” reads the certificate-backed verified event.
- “When is Rabies due?” reads the clinic-reported preventive fact.
- “Show the Rabies certificate” reads the verified certificate document.
- Citations expose the verified clinical organization and source PDF.
- Due dates, product expiration, and the current date cannot manufacture administration or medical status.

## Validation and acceptance evidence

### Automated validation

The final delivery workspace observed:

- Phase 3E.7a: 49 Node tests passed
- Phase 3E.7a Python extraction: 3 tests passed
- Phase 3E.5 regressions: 51 tests passed
- Phase 3E.6a regressions: 26 tests passed
- Phase 3B regressions: 323 tests passed
- Focused manual-recheck presentation tests: 11 passed
- ESLint: passed
- JavaScript syntax checks: passed
- Production build: successful

Rosa applied the final packet locally and reported that all requested tests passed and the production build succeeded before commit `74e65b9`.

### Private real-document acceptance

Rosa confirmed the following with private Momo records:

- The official Rabies certificate entered review through Gmail.
- The separate veterinary receipt was eventually preserved and made reviewable after receipt-recovery corrections.
- The incorrect sender-derived clinic value could be corrected to the clinical organization printed in the source.
- The final extracted receipt fields were accurate enough for line-by-line human approval.
- Agent Tomo answered Rabies administration and next-due questions from trusted evidence.
- Existing weight, latest Librela, and spending answers remained correct.
- The vaccination certificate did not offer an insurance-claim reminder or other unrelated post-verification action.
- No preventive reminder, Calendar action, message, appointment, or medical interpretation was created.

The browser-level **Recheck with AI** control could not be exercised after the correction because all available real documents were already verified. Automated coverage proves its visibility boundary, loading label, handler wiring, verified-document exclusion, and no-auto-promotion language. Browser validation is deferred until the first new unverified or synthetic document and does not reopen trusted records solely for testing.

## Accepted Phase 3E.7a limitations

- Only Rabies may materialize.
- Bordetella, Leptospirosis, DA2PP/DHPP, and other vaccine mentions remain source-visible but uncaptured.
- Annual wellness and annual-lab lifecycle state are not created.
- Lab results, analytes, units, ranges, trends, and medical significance are not interpreted.
- Preventive reminders, Care Operations proposals, Calendar actions, completion reconciliation, travel submission, and HOA submission are not implemented.
- Image-only PDFs still require a later OCR contract.
- Public portfolio media must not use the private real documents or their extracted identifiers.

## Roadmap decision after Phase 3E.7a

Rosa accepted the following revised order on August 27, 2026:

1. Phase 3E.8 — Verified Weight-Trend Visualization
2. Animate Tomo reliability and recovery
3. Separate resettable demo environment
4. Synthetic veterinary documents and demo-safe Gmail intake
5. Final Voice, animation, and end-to-end UI polish
6. Portfolio evidence and checkpoint freeze
7. Broader preventive lifecycle expansion as bounded Real-Care work after the portfolio checkpoint, unless Rosa explicitly reprioritizes it

This is an intentional scope decision, not abandonment of preventive care. Phase 3E.7a establishes reusable vaccine evidence, review, provenance, and trusted-record foundations. Additional vaccines, annual wellness, annual-lab lifecycle state, preventive screening, reminders, and completion reconciliation remain part of the Real-Care north star.

The revised order gives Rosa immediate value from already-verified longitudinal weight history and strengthens the portfolio's trusted-memory story before demo data is stabilized.

## Next bounded slice: Phase 3E.8 — Verified Weight-Trend Visualization

### User outcome

When Rosa asks Tomo about Momo's weight trend, the answer should include:

- the existing grounded narrative;
- a compact visual chart of the complete verified history in the requested date range;
- the latest, lowest, and highest verified values without medical interpretation; and
- source access for every plotted point.

The chart should help Rosa understand overall direction and recent movement without replacing the narrative or implying that a trend is healthy, unhealthy, concerning, or clinically meaningful.

### Existing foundation to reuse

The required trusted-data path already exists:

- `server/assistant/trustedContext.js` loads `verifiedWeightFacts` from trusted `facts` rows.
- `server/assistant/queryPlanner.js` routes `weight_trend`, `weight_change`, and `last_weight` to verified weight facts.
- `server/assistant/answerComposer.js` orders the requested facts chronologically and calculates first, latest, high, low, overall change, and recent direction deterministically.
- `server/assistant/citations.js` enriches every weight fact with display values, source document, verification state, and source-PDF access.
- `src/pages/Dashboard/AssistantPanel.jsx` renders the narrative and evidence disclosure in both Chat and the Voice transcript.
- `src/pages/Dashboard/citationPresentation.js` limits only the visible evidence cards to the ten newest sources; it does not limit Tomo's calculation input.

No new weight extraction, trusted table, database migration, model, provider, agent, or medical reasoning is required.

### Typed presentation contract

Phase 3E.8 should return one deterministic visualization payload for a `weight_trend` answer instead of making the browser parse narrative text or infer chart points from generic display strings.

Recommended shape:

```json
{
  "schema_version": 1,
  "type": "verified_weight_trend",
  "unit": "kg",
  "points": [
    {
      "fact_id": "synthetic-fact-id",
      "fact_date": "2026-01-15",
      "value_kg": 15.4,
      "value_lb": 33.95,
      "doc_id": "synthetic-document-id"
    }
  ],
  "summary": {
    "first_fact_id": "synthetic-fact-id",
    "latest_fact_id": "synthetic-fact-id",
    "low_fact_id": "synthetic-fact-id",
    "high_fact_id": "synthetic-fact-id",
    "overall_change_kg": 0
  }
}
```

The final implementation may refine field names, but it must preserve these meanings and derive the narrative, chart, and summary from the same ordered verified facts.

### Minimum implementation scope

1. Extract a deterministic shared weight-trend presentation builder from the existing trusted-fact calculations.
2. Return a versioned visualization payload only for supported verified weight-trend answers.
3. Include every valid verified point in the requested date range, even when more than ten citations exist.
4. Render a responsive chart beside or immediately below the narrative in Chat and the Voice transcript.
5. Keep the newest-first list of up to ten evidence cards unchanged as the concise audit view.
6. Make every chart point keyboard and screen-reader accessible and connect it to the corresponding verified source action.
7. Preserve kg as the canonical plotting unit and show lb as secondary display information.
8. Handle zero, one, duplicate-date, and same-value point sets honestly without manufacturing a trend line.
9. Preserve the existing medical-restraint language and proposed-action boundary.
10. Add focused server contract, chart-presentation, accessibility, and Chat/Voice regression tests.

### Product and visual decisions

- Show the chart only for the supported `weight_trend` response, not every answer that mentions weight.
- Use the requested range; an unbounded trend question uses the complete lifetime verified history.
- Order the horizontal axis chronologically from oldest to newest.
- Use a measured visual scale with explicit date and weight labels; do not exaggerate small changes through unlabeled cropping.
- Identify latest, high, and low points through accessible labels rather than color alone.
- Do not add goal weight, ideal range, warning zones, BMI, diagnoses, or veterinary thresholds.
- Do not hide the existing narrative or evidence list behind the chart.
- Prefer a small native SVG presentation within the existing design system unless inspection finds a compelling accessibility or maintenance reason for a dependency.

### Required tests

Phase 3E.8 should prove:

1. Only verified weight facts with valid dates and numeric values become points.
2. Chronological order is stable and duplicate dates remain traceable as separate facts.
3. The complete requested history is returned even when the evidence drawer displays only ten recent cards.
4. Summary IDs and numeric changes match the same facts used by the narrative.
5. Zero points return the existing no-trusted-data answer and no chart.
6. One point returns an honest single-reading presentation without claiming a trend.
7. Same-value points do not manufacture upward or downward movement.
8. The chart appears for `weight_trend` and not unrelated grounded answers.
9. Every point has an accessible label and a route to its governing source when available.
10. Chat and Voice transcripts render the same factual chart payload.
11. Existing weight narrative, citations, evidence-card cap, Voice, assistant, and Phase 3E.7a regressions remain green.

### Manual acceptance scenarios

1. Ask “Tell me about Momo's weight trend.”
2. Confirm the narrative and chart use the same first, latest, high, low, and overall-change values.
3. Confirm the chart plots the complete trusted history while the disclosure still shows at most ten recent verified sources.
4. Inspect the latest, high, low, and at least one middle point and open the correct source PDF or verification record.
5. Confirm the chart remains understandable with keyboard navigation, screen-reader labels, and without relying on color alone.
6. Ask the same question through Voice and confirm the transcript shows the same chart and narrative while speech remains concise.
7. Confirm Tomo does not call the change healthy, unhealthy, concerning, or medically meaningful.
8. Confirm no action, reminder, Calendar entry, message, or trusted-record write is created.

### Explicitly out of scope for Phase 3E.8

- New weight extraction or historical backfill
- Editing or deleting trusted weight facts
- Goal weight, ideal range, veterinary thresholds, alerts, or proactive notification
- Diagnosis, risk scoring, treatment advice, or clinical interpretation
- Correlation with Librela, medications, labs, activity, symptoms, or diet
- Predictive modeling or future-weight projection
- Additional vaccines or broader preventive-care lifecycle work
- Animate Tomo recovery
- Demo environment, synthetic documents, or Gmail demo work
- General-purpose charting framework or dashboard analytics suite

## Phase 3E.8 definition of done

Phase 3E.8 is complete only when:

- the chart and narrative derive from one deterministic verified-fact contract;
- the complete requested weight history is plotted independently of the ten-card evidence limit;
- every plotted point remains traceable to its trusted fact and source document;
- zero-, one-, duplicate-date, and same-value states are truthful;
- Chat and Voice transcripts share the same visual payload;
- accessible text and evidence alternatives remain available;
- no medical interpretation or consequential action is introduced;
- affected assistant, weight, citation, Voice, and Phase 3E.7a regressions pass;
- ESLint and the production build pass; and
- Rosa completes the manual acceptance scenarios.

## Recommended branch

After this documentation checkpoint is committed and pushed on `main`, delete the completed Phase 3E.7a branch and create:

```bash
git switch -c phase-3e-8-verified-weight-trend
git push -u origin phase-3e-8-verified-weight-trend
```

## Pasteable opening message for the next implementation chat

```text
We completed and merged TomoCare Phase 3E.7a at 40cd59e. I am now on the phase-3e-8-verified-weight-trend branch.

Use docs/Phase3E7a_Closeout_and_Phase3E8_Handover.md as the current implementation handover, docs/Phase3E0d_Product_Handover.md for the original weight foundation, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for the accepted sequence and portfolio scope, and docs/TomoCare_Operating_Brief.md for durable product and governance principles.

We are starting Phase 3E.8 — Verified Weight-Trend Visualization.

First inspect the existing verified weight facts in trustedContext, the deterministic weight_trend calculations in answerComposer, citation enrichment, the AssistantPanel Chat and Voice transcript surfaces, the ten-source evidence presentation, accessibility tests, and the affected assistant and weight regressions. Then walk me through the smallest architecture and product decisions before preparing code.

Return one typed, versioned visualization payload derived from the same complete ordered verified facts as Tomo's narrative. Plot verified facts only, preserve source access for every point, keep kg canonical with lb as secondary display, retain the existing narrative and newest-first evidence list, and handle zero, one, duplicate-date, and same-value states honestly.

Do not add medical interpretation, target ranges, alerts, predictive modeling, new weight extraction, trusted-record edits, additional preventive-care lifecycle work, Animate Tomo recovery, synthetic documents, demo-environment work, or external actions in this slice.
```
