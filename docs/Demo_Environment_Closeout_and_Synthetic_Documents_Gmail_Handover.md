# TomoCare Current State: Demo Environment Closeout and Synthetic Documents/Gmail Handover

**Closeout date:** September 7, 2026

**Current branch:** `main`

**Demo-environment implementation:** `290537b` — `feat(demo): add resettable synthetic environment`

**Demo-environment merge:** `5f11640` — `Merge demo environment resettable data`

**Next bounded slice:** Synthetic Veterinary Documents and Demo-Safe Gmail Intake

## Purpose

This handover closes the Demo Environment and Resettable Synthetic Dataset slice and defines the smallest safe contract for the first complete portfolio source-to-trusted-record demonstration.

The demo environment is merged and pushed to `main`. It uses the same TomoCare application with a separate hosted Supabase project, one deterministic fictional scenario, a server-owned runtime contract, persistent Demo labeling, fail-closed external-action boundaries, and one guarded server-only reset command.

The current five synthetic document rows are intentionally metadata-only provenance anchors. They support existing Profile, weight, reminder, attention, Chat, and Voice reads, but they do not contain PDFs, source text, extraction results, or triage results. The empty source and working panels in Verify are therefore a known boundary of the completed environment slice, not failed Gmail ingestion.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. The separately hosted demo database and its observed reset behavior
3. This handover for the settled next-slice scope
4. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md) for portfolio sequencing
5. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md) for durable product and governance principles
6. [Demo Environment Setup and Reset](./Demo_Environment_Setup_and_Reset.md) for local configuration and administration
7. [TomoCare Database Schema Reference](./TomoCare_Database_Schema_Reference.md) and the migration chain for schema truth
8. Earlier handovers for historical context

When an older document conflicts with current code, tests, migrations, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Demo Environment shipped result

### One codebase, separate data boundary

Real care and portfolio demonstration continue to use one application. Demo mode targets the dedicated hosted Supabase project:

```text
Project reference: gohzjjqsbtwavjuhjdwj
Project URL:       https://gohzjjqsbtwavjuhjdwj.supabase.co
```

The project reference is an identity allowlist, not reset authority. The Supabase server secret remains only in the untracked `.env.demo` file. A publishable key is not required by this server-owned data path.

The Supabase dashboard accepted `tomocare_demo_server` as the secret-key display name. This underscore-only name does not affect TomoCare configuration; the application reads the secret value from `SUPABASE_SECRET_KEY`, not the dashboard display name.

### Server-owned runtime contract

`server/config/runtimeContext.js` accepts only `real` or `demo`. It validates the hosted project reference and pet identity before server startup:

- demo mode requires the exact demo project and fixed fictional pet;
- real mode rejects either demo identity; and
- invalid or ambiguous configuration fails closed.

`GET /api/runtime-context` exposes only mode, safe label, fictional-data notice, and care date. It does not expose a Supabase URL, project reference, key, pet identifier, inbox, recipient, provider configuration, or reset capability.

The browser waits for that response before rendering care data. Demo mode then shows a persistent accessible **Demo data** indicator across the shared application shell.

### Fresh-schema migration path

`supabase/migrations/202607010001_create_tomocare_base_schema.sql` closes the previous fresh-project gap. It creates the original application tables and private `tomo-docs` Storage bucket before the later governed-action, orchestration, Apple Messages, weight, and Rabies migrations run.

RLS is enabled on the original base tables. Only `field_plan` receives browser-user policies. Care data remains behind the server-owned Supabase secret.

### Deterministic fictional baseline

`server/demo/scenarioManifest.js` owns one scenario, `tomocare-demo-v1`. Dates resolve as deterministic offsets from the care date in `APP_TIME_ZONE`; the application clock is not frozen.

The accepted reset on September 7, 2026 produced:

| Resource | Count |
| --- | ---: |
| `pets` | 1 |
| `documents` | 5 |
| `events` | 4 |
| `cost_items` | 1 |
| `labs` | 0 |
| `facts` | 5 |
| `provider_contacts` | 0 |
| `orchestration_runs` | 0 |
| `care_actions` | 0 |
| `apple_messages_handoffs` | 0 |

The scenario includes:

- one fictional Profile;
- four source-linked verified weight facts;
- one fictional verified Librela administration and planned follow-up reminder;
- one fictional owner-confirmed Simparica administration and current reminder;
- one clinic-reported Rabies next-due fact that does not claim administration; and
- five verified metadata-only document anchors.

Fictional clinic and insurance labels are not presented as governed Profile facts. Missing source files and candidate content remain visibly missing.

### Guarded administrative reset

The only reset entry point is:

```bash
npm run demo:reset -- --project-ref gohzjjqsbtwavjuhjdwj
```

Before mutation, it verifies:

1. exact demo runtime mode;
2. the project reference parsed from the configured Supabase URL;
3. the same explicit command-line project confirmation;
4. the fixed scenario pet identifier;
5. the hard-coded table allowlist; and
6. the exact `tomo-docs/demo/tomocare-demo-v1` Storage scope.

The command does not truncate tables or perform unconstrained deletion. It removes dependency-ordered manifest-owned records, clears only the allowlisted Storage prefix, and restores the deterministic baseline. Reset authority and the server secret are never sent to the browser.

### Side effects remain fail closed

In demo mode, general Gmail polling, Google Calendar mutation, and Apple Messages handoff paths stop before provider execution with `demo_external_action_blocked`. Only the exact server-validated synthetic Gmail intake capability may reach Gmail; it must not imply access to arbitrary mail. Calendar and Messages must not claim that an event was created, a native destination was opened, a message was sent, or an appointment was booked.

OpenAI-backed Chat and Voice and the optional Animate Tomo presentation may continue to operate over fictional care content through their existing contracts. They do not receive reset authority.

## Acceptance evidence

### Hosted database and reset

Rosa confirmed that all twelve migrations applied successfully to the allowlisted demo project. The guarded reset then succeeded twice with the same care date, Storage prefix, and row counts shown above. This is the live evidence for fresh-schema provisioning and idempotent reset behavior.

### Automated and build validation

Rosa reported the following results on the merged implementation:

```text
Demo-environment tests: 26 passed
Phase 3E.4 regression:  149 passed
Phase 3E.9 regression:  139 passed
Production build:       successful
```

### Manual acceptance

Manual inspection confirmed:

- the demo server and application load the fictional scenario;
- the **Demo data** indicator is persistent and readable;
- the Material Symbol used by the indicator is included in `index.html`;
- demo Profile and care views do not display hard-coded real clinic or insurer values; and
- the Verify archive truthfully shows the five metadata-only fictional source anchors.

## Boundaries that remain in force

- One application and one scenario; no demo fork or scenario picker.
- No copied, anonymized, masked, sampled, or exported production data.
- The server remains the source of runtime identity.
- Care data is withheld until runtime identity is confirmed.
- The Demo indicator is persistent and cannot be disabled by a browser toggle.
- Reset remains an administrative command, never a public control.
- Reset must verify the exact allowlisted project before its first mutation.
- Reset may touch only explicit manifest-owned identifiers and the exact demo Storage prefix.
- Candidate truth still requires human review and approval before trusted materialization.
- Gmail, Calendar, and Messages remain blocked by default in demo mode; Gate 1 opens only the exact synthetic Gmail intake contract.
- Prepared, reviewed, handed off, sent, delivered, received, booked, and completed remain distinct states.
- Missing evidence produces an honest missing state, not synthetic inference.

## Known limitations at closeout

- The five baseline documents have no `file_url`, `raw_text`, `text_extracted`, or `triage_result`.
- Verify can list those verified anchors but cannot render a source PDF or candidate working panel for them.
- The demo can inspect and review only the exact allowlisted synthetic Gmail message; general inbox checking remains unavailable.
- The demo has no configured clinic contact, Calendar destination, or Messages destination.
- There is no pending document awaiting human review in the reset baseline; the exact Gmail source creates it on demand.
- Gates 1 and 2 cover the source boundary, deterministic candidate extraction, and bounded Verification Intelligence review. Gate 3 adds explicit approval, shared source-linked materialization, derived Dashboard/Chat/Voice reads, and manifest-exact reset/replay behavior. Live Gate 3 acceptance, screenshots, recording, case-study update, and the portfolio release tag remain incomplete.

These are intentional handoff boundaries, not claims that the portfolio checkpoint is finished.

## Revised near-term sequence

1. **Synthetic Veterinary Documents and Demo-Safe Gmail Intake — Gate 3 live acceptance**
2. **Governed Follow-Through Demo Checkpoint**
3. **Final Voice, Animation, and End-to-End UI Polish**
4. **Demo Evidence, Case Study, and Portfolio Checkpoint Freeze**
5. **Broader preventive and health-intelligence work as later bounded Real-Care slices**

## Next bounded slice: Synthetic Veterinary Documents and Demo-Safe Gmail Intake

### User problem

The environment is now safe and repeatable, but the portfolio cannot yet demonstrate TomoCare's central source-to-trusted-memory story. The current Verify archive contains fictional metadata without a source file or candidate extraction, so it cannot show how a real incoming document moves through preservation, AI-assisted review, human correction, and trusted materialization.

The next slice should complete that story once, using one wholly fictional document and one narrowly allowlisted demo intake boundary inside the existing dedicated TomoCare inbox.

### Accepted outcome

After this slice:

1. One polished fictional veterinary invoice is clearly labeled `SAMPLE — DEMO DATA` in the file and application metadata.
2. The invoice uses only fictional clinic, staff, account, patient, policy, invoice, contact, and medical-administrative values.
3. The existing OAuth-connected TomoCare intake inbox and a separate allowlisted sender replace the blanket Gmail block for this exact synthetic message path only.
4. Demo mode never runs the broad real-care Gmail query and ignores Momo's real-care messages and arbitrary mail.
5. The accepted attachment is written only beneath `tomo-docs/demo/tomocare-demo-v1` using a deterministic manifest-owned object key.
6. Rechecking the inbox does not create a second document or duplicate downstream records.
7. The source, extracted candidate, Verification Intelligence result, and human edits are visible in Verify.
8. Candidate truth remains untrusted until Rosa explicitly saves and verifies it.
9. Approval materializes only existing allowlisted source-linked event, weight, cost, and carefully bounded status fields.
10. The vaccine-status section cannot become proof of vaccine administration without the required administration evidence.
11. The resulting trusted state is available consistently to Dashboard, Chat, Voice, attention, evidence, and the appropriate lifecycle logic.
12. Reset removes the exact message-derived records and object, then restores the same pre-intake baseline.
13. Calendar and Messages remain blocked before provider execution.
14. Real-care intake and previously shipped governance remain unchanged.

### Smallest product decisions

#### One document, one narrative

Create one invoice, not a fixture library. It should contain only enough information to demonstrate the existing product:

- one Librela visit;
- one weight reading;
- one itemized medication cost and invoice total;
- one insurance-relevant administrative field; and
- one clinic-reported vaccine-status statement whose meaning is intentionally distinct from administration evidence.

The document should contain one meaningful review moment rather than artificial ambiguity everywhere. A reviewer should be able to understand why TomoCare asks for attention and what changes when Rosa approves the corrected candidate.

#### One allowlisted message boundary

Reuse the existing dedicated TomoCare intake inbox and its server-only OAuth connection. Send the fixture from a different allowlisted account. Demo mode must construct its own narrow query and allow only the exact authenticated recipient, direct sender, subject prefix, attachment filename, `application/pdf` content type, and manifest-owned PDF hash required for the scenario.

This is query- and content-isolated intake, not a claim of separate mailbox-level OAuth authority. Do not enable general demo mailbox scanning or run the broad real-care query in demo mode. OAuth credentials, refresh tokens, sender, and recipient remain untracked server-only configuration. The validated personal sender address must not be copied into the demo database or browser response.

#### One replayable message

Treat the accepted email and attachment as scenario-owned inputs. Define their stable identity and deterministic destination keys in the scenario contract so repeated inbox checks upsert or skip rather than duplicate. The reset must remove only the exact database identifiers and Storage objects reserved for this scenario.

Do not delete email from Gmail as part of reset. Reset restores TomoCare state; the stable source message remains available for the next ingestion rehearsal.

#### Preserve visible human control

The desired demo is not “email arrives and facts appear automatically.” It is:

1. Rosa checks the allowlisted demo message path in the dedicated TomoCare inbox.
2. TomoCare preserves the accepted PDF and creates candidate truth.
3. Verification Intelligence focuses attention on the consequential or uncertain field.
4. Rosa inspects the source, edits if needed, and explicitly verifies.
5. Deterministic materialization creates source-linked trusted records.
6. Dashboard, Chat, and Voice reflect the new trusted state.

### Smallest technical decisions

#### Narrow capability instead of disabling the global guard

Keep demo external side effects blocked by default. Add a typed capability for `demo_gmail_intake` that is allowed only when the server has validated the demo runtime and exact demo Gmail contract. Do not weaken the shared Calendar or Messages guards.

The browser must not receive Gmail tokens, mailbox identifiers, provider configuration, or general provider authority. A safe response may report only user-relevant intake status and bounded failure reasons.

#### Deterministic source ownership

Extend `scenarioManifest.js` with the exact document, derived-record, and Storage object identities owned by this one intake fixture. Every reset target must be derivable from that explicit manifest, not from a broad pet query, document status, date range, filename wildcard, or source-organization name.

The Gmail message ID may be validated as an external source identity, but deletion authority should remain limited to deterministic TomoCare row IDs and object keys.

#### Existing truth pipeline remains authoritative

Reuse the current Gmail receipt ingestion, private Storage, document extraction, triage, Verification Intelligence, draft, verify, and materialization paths. Do not build a parallel demo importer or seed the final trusted result directly.

The invoice must exercise current candidate and trusted schemas. If the current extractor cannot represent a field safely, show it as unsupported or leave it for manual review rather than expanding medical intelligence inside this slice.

#### Care dates remain scenario-relative

Generate the invoice's printed service date and expected derived dates from one accepted scenario care date or a documented stable offset. The PDF, expected candidate, trusted rows, and assistant assertions must agree. Do not change the global care-date contract or use the machine's locale implicitly.

### Existing architecture to inspect first

- `server/gmail/gmailInbox.js` and its query, message, attachment, and OAuth boundaries
- `server/gmail/ingestGmailReceipts.js` and current idempotency/storage behavior
- document extraction, triage, and Verification Intelligence entry points
- VerifyDocs source rendering, working-panel, draft, and approval flows
- server-only materialization for events, costs, weight, and preventive evidence
- `server/config/externalSideEffects.js` and the current demo boundary
- `server/demo/scenarioManifest.js` and `server/scripts/resetDemoEnvironment.js`
- the `tomo-docs/demo/tomocare-demo-v1` Storage ownership contract
- Dashboard, Chat, Voice, attention, evidence, and lifecycle tests affected by the new trusted result
- current Gmail tests that assume the real inbox, sender, label, filenames, or environment

### Required tests

The next slice should prove:

1. Demo Gmail intake remains unavailable without exact validated demo configuration.
2. Real-care Gmail identity or credentials cannot satisfy the demo contract.
3. Only the authenticated TomoCare inbox, allowlisted direct sender, subject prefix, filename, PDF type, and manifest-owned content hash are accepted.
4. Unrelated demo-mailbox messages and attachments are ignored without creating records or objects.
5. Accepted content is stored only under the exact demo scenario prefix.
6. Repeated inbox checks do not duplicate documents, objects, candidates, or trusted rows.
7. The fictional PDF is visibly labeled and contains no production values.
8. Candidate extraction remains untrusted and appears in the review queue.
9. Verification Intelligence uses the current source and candidate and returns bounded review guidance.
10. Only explicit human verification can materialize the source-linked trusted result.
11. Weight, cost, event, invoice, and status values match the approved candidate and source.
12. Vaccine-status wording cannot create administration evidence or a preventive action.
13. Reset removes only the exact message-derived scenario rows and Storage key.
14. Intake succeeds again after reset and returns the same logical result.
15. Calendar and Messages remain blocked before provider execution in demo mode.
16. Real-care Gmail behavior and all existing runtime, reset, verification, assistant, lifecycle, and action contracts remain unchanged.
17. Focused tests, affected regression suites, syntax checks, ESLint, and the production build pass.

### Manual acceptance path

1. Run the guarded reset and start TomoCare in demo mode.
2. Confirm the persistent **Demo data** indicator appears before baseline care data.
3. Confirm Verify has no pending document.
4. Send or retain the one allowlisted fictional email in the dedicated TomoCare inbox.
5. Select **Check inbox** and confirm exactly one pending document appears.
6. Open it and confirm the labeled PDF, candidate fields, and Verification Intelligence guidance render together.
7. Correct the planned review field and save without verifying; confirm trusted views do not change.
8. Explicitly verify the candidate and confirm the expected source-linked records appear.
9. Ask the agreed Chat and Voice questions and confirm both use the same new trusted evidence.
10. Check the inbox again and confirm no duplicate document or trusted records appear.
11. Attempt Calendar and Messages follow-through and confirm both remain truthfully blocked.
12. Run reset twice and confirm the original baseline returns without duplicate or orphaned rows or Storage objects.
13. Repeat intake once and confirm the same logical end state.

### Explicitly out of scope

- Momo's personal mailbox, real-care messages, documents, records, clinic, insurer, or identifiers
- General-purpose or arbitrary Gmail ingestion in demo mode
- More than one synthetic source document or scenario
- A document generator, fixture editor, scenario picker, or public reset button
- Automatic verification or direct trusted seeding of the new invoice result
- New extraction, AI, Voice, avatar, messaging, calendar, or storage providers
- Demo Calendar configuration or event creation
- Demo Messages destination configuration or native handoff execution
- Appointment booking, message delivery, reply interpretation, or completion claims
- Vaccine administration materialization without qualifying source evidence
- New preventive lifecycle, lab interpretation, medical intelligence, diagnosis, urgency, or treatment advice
- Final Voice, animation, responsive, transition, or general visual polish
- Portfolio screenshots, video, narration, case-study production, release tagging, or final fallback capture

## Definition of done

Synthetic Veterinary Documents and Demo-Safe Gmail Intake is complete only when:

- one labeled fictional PDF travels through the real governed intake and review architecture;
- demo Gmail access never runs the broad real-care query and accepts only the exact synthetic envelope and content contract;
- the source is stored only at one deterministic demo-owned key;
- candidate truth remains editable and untrusted until explicit verification;
- approved rows remain source-linked and match the reviewed candidate;
- the vaccine statement retains its exact evidence meaning;
- duplicate inbox checks and post-reset replay are idempotent;
- reset remains allowlisted and cannot touch non-scenario data;
- Calendar and Messages remain blocked;
- real-care behavior remains unchanged;
- affected automated tests and the production build pass; and
- Rosa completes the manual reset, intake, review, approval, grounding, duplicate, and replay checks.

## Recommended branch

After this documentation closeout is reviewed, committed, and pushed on `main`, create:

```bash
git switch -c synthetic-documents-demo-gmail-intake
git push -u origin synthetic-documents-demo-gmail-intake
```

## Pasteable opening message for the next implementation chat

```text
We completed the Demo Environment and Resettable Synthetic Dataset implementation at 290537b and merged it to main at 5f11640. I am now on the synthetic-documents-demo-gmail-intake branch.

Use docs/Demo_Environment_Closeout_and_Synthetic_Documents_Gmail_Handover.md as the current implementation handover, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for the accepted portfolio sequence, docs/TomoCare_Operating_Brief.md for durable product and governance principles, docs/Demo_Environment_Setup_and_Reset.md for the shipped environment contract, and current code, migrations, tests, and docs/TomoCare_Database_Schema_Reference.md as implementation truth.

We are beginning the bounded Synthetic Veterinary Documents and Demo-Safe Gmail Intake slice.

First inspect the current Gmail query, OAuth, message, attachment, storage, idempotency, extraction, triage, Verification Intelligence, VerifyDocs, materialization, scenario-manifest, reset, care-date, and external-side-effect seams. Then walk me through the smallest product and technical decisions before preparing the code packet.

Create one polished SAMPLE — DEMO DATA fictional veterinary invoice and one narrowly allowlisted demo Gmail path inside the existing dedicated TomoCare inbox. Carry that source through the existing private demo Storage prefix, candidate extraction, Verification Intelligence, human correction and approval, and existing source-linked trusted materialization. Keep exact scenario-owned row and object identities in the manifest so repeated inbox checks and reset/replay remain idempotent.

Keep Gmail, Calendar, and Messages blocked by default in demo mode. Open only the exact demo Gmail intake capability after the server validates the demo runtime, authenticated TomoCare inbox, direct sender, subject prefix, attachment filename, PDF type, and manifest-owned content hash. Never expose OAuth tokens, mailbox identity, personal sender address, server keys, or reset authority to the browser. Do not delete the fixture email during reset.

Do not query or accept Momo's real-care messages, data, documents, clinic, insurer, contacts, or identifiers; accept arbitrary mail; create multiple documents or scenarios; add a parallel demo importer; auto-verify candidate truth; configure Calendar or Messages destinations; add providers, medical intelligence, broader care coverage, final UI or animation polish, portfolio evidence, case-study work, or release tagging.
```
