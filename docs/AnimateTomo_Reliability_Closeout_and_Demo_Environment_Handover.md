# TomoCare Current State: Animate Tomo Reliability Closeout and Demo Environment Handover

**Closeout date:** September 3, 2026

**Current branch:** `main`

**Animate Tomo implementation:** `1ce1175` — `feat(animate-tomo): add reliability recovery`

**Animate Tomo merge:** `8575e8a` — `Merge Animate Tomo reliability recovery`

**Next bounded slice:** Demo Environment and Resettable Synthetic Dataset

## Purpose

This handover records the shipped Animate Tomo reliability-and-recovery contract, its acceptance evidence and boundaries, and the opening contract for a separate resettable portfolio environment.

Animate Tomo Reliability and Recovery is merged and pushed to `main`. It required no database migration, environment-variable change, provider configuration, answer or speech change, care-state mutation, or medical-intelligence change.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. Current database and provider behavior
3. This handover for the settled demo-environment scope
4. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md) for accepted sequencing and portfolio scope
5. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md) for durable product and governance principles
6. [TomoCare Multi-Agent Orchestration Decision and Build Plan](./TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md) for agent and deterministic-system boundaries
7. Earlier handovers for historical context

When an older document conflicts with current code, tests, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Animate Tomo shipped result

Animate Tomo remains explicitly optional and user-started. The interface now makes its presentation lifecycle understandable without allowing provider failure to interrupt Tomo's answer or local Voice.

The shipped behavior includes:

- typed non-sensitive presentation states for starting, live-ready, local-only, intentional end, recoverable failure, and non-retryable unavailability;
- allowlisted presentation reasons for startup, unexpected disconnect, session expiry, speech-preparation, and playback failure;
- a bounded 35-second startup timeout with cancellation and one in-flight connection attempt;
- a clear distinction between **End live animation** and a provider-driven disconnect;
- one explicit **Try animation again** action only when a fresh session may help;
- complete cleanup before retry or end;
- uninterrupted static or local-motion presentation and local Voice fallback;
- exact-once local audio when live playback cannot complete;
- no answer replay or speech resynthesis as part of animation retry; and
- preserved reduced-motion, accessibility, latency, transcript, and existing Voice behavior.

Raw provider errors are not rendered. Unknown failures resolve to generic safe animation guidance while local Voice remains available.

## Shipped architecture

### Typed presentation boundary

`avatarPresentation.js` owns the allowlisted browser-session presentation contract. It converts internal state and known reason codes into bounded user-facing title, explanation, action, retryability, and accessible status behavior.

Provider messages, tokens, care content, transcript content, audio bytes, pet identifiers, and secrets are outside this contract. The UI receives only safe presentation data.

### One live-session attempt at a time

`RunwayAvatarMedia.jsx` remains the owner of the optional live presentation lifecycle and explicit start, retry, and end controls. Startup has one cancellable boundary and cannot create overlapping session requests.

Retry is not a replay operation. It cleans the previous live session and returns the avatar layer to a fresh start without sending the prior answer or audio again.

### Complete client cleanup

`runwayAvatarClient.js` keeps provider connection, speech transfer, playback status, disconnect handling, and stop control behind the existing browser client boundary. Cleanup removes listeners, timers, media tracks, media-element sources, transition state, and pending speech state before a new attempt begins.

Intentional ending suppresses failure presentation. Unexpected disconnect remains visible and may offer a fresh user-started session.

### Local Voice remains the final guarantee

`avatarVoiceFallback.js` and `AssistantPanel.jsx` preserve the existing already-generated local audio path. If the live avatar cannot play that audio, local playback receives the same audio once. Stale or superseded playback attempts cannot create overlap.

Animation retry does not call the answer service, text-to-speech provider, or answer replay control.

### Server and protocol boundaries preserved

The live-avatar session route, `liveAvatarSession.js`, `runwayAvatarAgent.js`, short-lived session token, and avatar protocol retain their existing responsibilities. Provider credentials remain server-side, and the avatar agent remains a presentation relay rather than an assistant, reasoner, or action actor.

## Acceptance evidence

Rosa reported that all requested automated tests passed and the production build completed successfully.

Manual acceptance confirmed:

- Animate Tomo starts successfully;
- the start and intentional-end messages are clear;
- **End live animation** returns calmly without presenting a failure; and
- local Voice continues to work after live animation ends.

The live provider did not fail during manual testing. That is not a release gap: deterministic automated coverage exercises startup failure, unexpected disconnect, expiry, playback failure, cleanup, and retry behavior. No live provider disruption or production failure was introduced solely to create manual evidence.

## Reliability boundaries that remain in force

- Animate Tomo remains optional and user-started.
- Retry is explicit; there is no automatic reconnect or background retry loop.
- Retry creates a fresh animation session only.
- Retry does not replay an answer, resynthesize speech, or duplicate audio.
- Intentional end is not a failure.
- Reduced Motion is not a failure.
- Raw provider errors and secrets remain outside presentation and telemetry.
- Failure reasons remain browser-session presentation state rather than durable records.
- Local Voice, static media, and local motion remain available independently of Runway and LiveKit.
- No provider, database, care action, trusted record, medical behavior, character design, gesture, or semantic-reaction behavior changed.

## Revised near-term sequence

1. **Demo Environment and Resettable Synthetic Dataset**
2. **Synthetic Veterinary Documents and Demo-Safe Gmail Intake**
3. **Final Voice, Animation, and End-to-End UI Polish**
4. **Demo Evidence, Case Study, and Portfolio Checkpoint Freeze**
5. **Broader preventive and health-intelligence work as later bounded Real-Care slices**

The next slice establishes privacy-safe, reproducible state before the final synthetic invoice and Gmail story are added. It does not begin general demo polish.

## Next bounded slice: Demo Environment and Resettable Synthetic Dataset

### User problem

TomoCare currently operates against Momo's real longitudinal care state. That is appropriate for private product use, but it is not safe or reliable as the default source for interviews, portfolio recordings, or repeated end-to-end demonstrations.

Using the live environment creates four avoidable risks:

- screenshots or recordings may preserve real clinic, insurance, identifier, recipient, or medical details;
- verification, reminder, action, Calendar, or Messages steps may mutate real state or reach real destinations;
- the starting state changes as Momo's real care progresses; and
- a failed rehearsal may leave the next demonstration in an inconsistent state.

The portfolio needs the same governed product, not a mock fork, running against clearly synthetic state that can be restored safely.

### Accepted outcome

After this slice:

1. Real care and portfolio demonstration still use one application codebase.
2. Demo runs against a separate hosted Supabase project containing no copied Momo records or private source files.
3. The server owns one typed `real` or `demo` runtime-mode contract.
4. The browser confirms runtime mode before presenting care data.
5. Demo mode has a persistent, accessible **Demo data** indicator on every main product surface.
6. One deterministic synthetic Momo scenario supports Profile, attention, reminders, verified weight, Chat, and Voice reads.
7. One explicit administrative reset command restores the same logical starting state.
8. Reset refuses to run unless both demo mode and the allowlisted demo project identity are confirmed.
9. Reset touches only deterministic demo-owned database rows and storage prefixes.
10. Repeating reset does not duplicate records and produces the same logical scenario.
11. Demo mode cannot poll Momo's inbox, contact a clinic, write to Rosa's Calendar, or open a real Messages destination.
12. Real-care behavior and existing governance remain unchanged when runtime mode is `real`.

### Smallest product decisions

#### One product, visibly different data context

Do not create a demo-only UI or a second application fork. The persistent Demo indicator is context, not a new visual theme. It should be visible before synthetic care data appears and remain present across Dashboard, Verify, Chat, Voice, and drawers.

If runtime context cannot be confirmed, do not render care data under an ambiguous real-care presentation. Show one bounded environment-unavailable state instead.

#### One reset scenario, not a scenario builder

Create one portfolio starting state. Do not add multiple personas, a scenario picker, dataset editor, reset button in the product UI, or arbitrary fixture upload.

The reset baseline should contain only enough clearly fictional state to prove current shipped capabilities:

- one synthetic Momo Profile with fictional identifiers;
- a small source-linked verified weight history;
- a completed Librela event and one current planned follow-up state;
- representative Simparica or Adequan reminder state;
- bounded Rabies evidence or status only if a synthetic source fixture can preserve the shipped evidence distinction; and
- no pending polished invoice at baseline, because the next slice will introduce it through demo-safe Gmail intake.

The exact row inventory must be documented in one manifest. All identifiers, clinic names, contacts, source text, prices, and dates must be fictional and safe for public evidence.

#### Dates remain current without changing the product clock

Define scenario dates as deterministic offsets from the reset care date in `APP_TIME_ZONE`. This keeps **today**, **this week**, reminders, and due-state behavior useful whenever the demo is reset without introducing a frozen global clock or changing real-care date semantics.

The reset output should record the resolved scenario date and row counts so Rosa can confirm the starting state before a demonstration.

#### External side effects fail closed first

This slice establishes safety before live demo integrations. In demo mode, Gmail polling, Google Calendar writes, and native Messages destination resolution or opening must be blocked unless a later slice adds an explicit demo-safe destination contract.

The product should explain the demo boundary truthfully; it must not claim an email was ingested, an event was created, a message was opened, or an appointment was requested when execution was blocked.

OpenAI or avatar presentation may continue to operate with synthetic conversation content through the existing optional contracts. This slice does not add or reconfigure an AI, Voice, animation, or messaging provider.

### Smallest technical decisions

#### Server-owned runtime context

Add one validated server runtime value with only `real` and `demo` as accepted modes. Unknown values should fail startup or return a typed unavailable state rather than silently becoming demo.

Expose only a non-sensitive public runtime response such as mode, label, and scenario date. Do not expose Supabase URLs, project references, keys, inbox identifiers, Calendar identifiers, recipient values, or provider configuration.

The browser should load this context before care data and derive the persistent Demo indicator from the server response rather than from query parameters, local storage, or a manually toggled client flag.

#### Separate hosted Supabase project

Use a distinct hosted Supabase project for the portfolio environment. Do not clone production data, reuse Momo's storage bucket contents, share service-role keys, or create a `demo` flag beside real rows in the production project.

The repository's current migration directory begins after TomoCare's original base tables. Before provisioning the demo project, inspect the live schema and existing migrations to identify the schema-bootstrap gap. Add a reviewed schema-only fresh-environment path without exporting rows, private comments, secrets, or storage objects. Do not turn a production data dump into seed material.

#### Deterministic ownership

Use a fixed synthetic pet UUID and fixed UUIDs or stable keys for every seeded row. Seed and reset operations should identify ownership from those explicit values, not from names such as `Momo`, broad date ranges, or `delete all` operations.

Storage fixtures, if needed for source-linked evidence, must live under one explicit demo-only prefix. They must be wholly fictional and clearly labeled in their contents and metadata.

#### Guarded administrative reset

Provide one server-side or repository CLI command. Do not expose the service-role key or destructive reset authority to the browser.

Before any delete, update, storage removal, or insert, the command must verify:

1. runtime mode is `demo`;
2. the configured Supabase URL resolves to the exact allowlisted demo project reference;
3. the synthetic pet identifier matches the manifest; and
4. every target table and storage prefix is explicitly allowlisted.

If any check fails, exit before mutation with a safe actionable message. Avoid broad schema reset, `truncate`, unconstrained delete, production project linking, or any command whose target depends on an unresolved variable.

Run cleanup in dependency-aware order or through one reviewed transaction where practical. Running reset twice should succeed and leave the same logical row set.

#### Preserve one governance model

Seed trusted facts only through explicit synthetic fixture construction that mirrors current trusted shapes and provenance. Do not weaken verification, materialization, citation, action-approval, idempotency, or agent-permission rules merely because the data is fictional.

The demo runtime must not bypass missing-data or abstention behavior. If a fact is absent from the scenario, Tomo should say it is unavailable rather than drawing from real-care defaults or hidden test fixtures.

### Existing architecture to inspect first

- `server/supabase.js` and every server startup path that constructs shared dependencies
- `server/index.js`, API route registration, and any health or configuration response
- `.env.example`, deployment configuration, and current environment-variable documentation
- the complete `supabase/migrations` chain and the base-schema gap for a fresh project
- tables and storage paths used by `pets`, `documents`, `events`, `cost_items`, `facts`, `external_refs`, `care_actions`, `orchestration_runs`, Apple Messages handoffs, and preventive evidence
- `server/lib/careDates.js` and current date injection seams
- Gmail polling and ingestion entry points
- Google Calendar execution and external-reference persistence
- Apple Messages prepare, resolve, and browser-open boundaries
- Dashboard, VerifyDocs, Chat, Voice, drawers, and global layout surfaces that need the Demo indicator
- assistant, attention, Profile, weight, reminder, lifecycle, orchestration, and action tests that assume the real pet identifier or current environment

### Required tests

The next slice should prove:

1. Only `real` and `demo` runtime modes are accepted.
2. Public runtime context contains no URL, project reference, key, inbox, recipient, provider configuration, or private identifier.
3. Care data is not rendered before runtime mode is confirmed.
4. Demo mode displays a persistent accessible indicator across the primary routes and Voice or Chat presentation.
5. The indicator cannot be dismissed or hidden through a client-only toggle.
6. Reset rejects real mode, unknown mode, missing project identity, and a project-reference mismatch before mutation.
7. Reset operates only on allowlisted synthetic identifiers, tables, and storage prefixes.
8. Two consecutive resets produce the same logical records without duplicates.
9. Relative scenario dates resolve deterministically from the reset care date and `APP_TIME_ZONE`.
10. Seeded Profile, weight, attention, reminders, Chat, and Voice return internally consistent fictional state.
11. Missing seeded facts remain missing; no fallback can read the real-care project or real identifiers.
12. Gmail polling, Calendar mutation, and real Messages handoff are blocked in demo mode before provider execution.
13. Real mode preserves the current routes, data contracts, approvals, and provider boundaries.
14. Seed files, test fixtures, logs, errors, and packages contain no real Momo care values, clinic contact, recipient, document text, storage URL, token, or secret.
15. Focused tests, relevant regression suites, syntax checks, ESLint, and the production build pass.

### Manual acceptance scenarios

1. Start the real-care configuration and confirm no Demo indicator appears and existing private use still works.
2. Start the demo configuration and confirm **Demo data** is visible before any synthetic care content.
3. Confirm the Profile, care summary, attention, reminder, verified-weight, Chat, and Voice views agree on the seeded scenario.
4. Make an allowed temporary change in the demo environment, run the reset command, and confirm the baseline returns.
5. Run reset a second time and confirm no duplicate rows, reminders, actions, or evidence appear.
6. Deliberately point the reset command at an unapproved or mismatched project identity and confirm it exits before mutation.
7. Attempt Gmail, Calendar, and Messages side effects in demo mode and confirm each stops before provider execution with truthful bounded language.
8. Confirm Animate Tomo and local Voice still operate as optional presentation layers over synthetic answers.
9. Confirm no real-care record, storage object, inbox, Calendar, clinic contact, or Messages recipient changes.

### Explicitly out of scope

- Copying, masking, anonymizing, or sampling Momo's production data
- A second application fork or demo-only product architecture
- Multiple scenarios, persona selection, scenario authoring, or a public reset control
- The final synthetic invoice or other polished veterinary documents
- Demo Gmail inbox authorization, polling, ingestion, or live attachment transfer
- Demo-safe Calendar event creation or Messages destination configuration beyond fail-closed guards
- Final Voice, animation, transition, responsive, or visual polish
- Portfolio screenshots, recordings, scripted narration, case-study production, or release tagging
- New AI, Voice, avatar, messaging, calendar, or extraction providers
- New medical interpretation, care recommendations, preventive lifecycle expansion, or trusted-care logic
- Durable analytics or failure telemetry

## Definition of done

The Demo Environment and Resettable Synthetic Dataset slice is complete only when:

- one codebase runs in validated real-care and demo modes;
- the demo uses a separate hosted Supabase project with a reviewed fresh-schema path;
- no production data or storage object is copied into the demo project;
- care data is not shown until runtime context is known;
- demo mode is continuously and accessibly labeled;
- one documented fictional scenario is internally consistent across current reads;
- the guarded reset command is repeatable and cannot target the real-care project;
- demo side effects fail closed before Gmail, Calendar, clinic, or Messages execution;
- real-care behavior remains unchanged;
- affected tests and the production build pass; and
- Rosa completes the manual isolation and reset checks.

## Recommended branch

After this documentation checkpoint is committed and pushed on `main`, create:

```bash
git switch -c demo-environment-resettable-data
git push -u origin demo-environment-resettable-data
```

## Pasteable opening message for the next implementation chat

```text
We completed and merged TomoCare Animate Tomo Reliability and Recovery at 8575e8a. I am now on the demo-environment-resettable-data branch.

Use docs/AnimateTomo_Reliability_Closeout_and_Demo_Environment_Handover.md as the current implementation handover, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for the accepted portfolio sequence, docs/TomoCare_Operating_Brief.md for durable product and governance principles, and the current code and tests as the implementation source of truth.

We are beginning the bounded Demo Environment and Resettable Synthetic Dataset slice.

First inspect server startup and Supabase configuration, the migration chain and fresh-schema gap, all tables and storage paths owned by the current product, care-date handling, Gmail/Calendar/Messages side-effect boundaries, global UI surfaces, and tests that assume the real pet or environment. Then walk me through the smallest product and technical decisions before preparing the code packet.

Keep one application codebase. Use a separate hosted Supabase demo project, a server-owned typed real/demo runtime contract, a persistent accessible Demo indicator before care data is shown, one deterministic wholly fictional scenario, and one guarded administrative reset command. Reset must verify demo mode and the exact allowlisted project identity before any mutation, touch only explicit demo-owned identifiers and storage prefixes, remain idempotent, and never expose reset authority to the browser.

In demo mode, prevent Gmail polling, Calendar writes, clinic contact, and real Messages handoff before provider execution. Preserve the same truth tiers, provenance, verification, assistant grounding, approvals, idempotency, agent permissions, Voice, and optional Animate Tomo behavior as real care.

Do not copy or anonymize Momo's production data; create an app fork, multiple scenarios, a scenario editor, or a public reset control; finalize synthetic documents or Gmail intake; configure demo Calendar or Messages destinations; add providers, medical intelligence, care coverage, final UI or animation polish, portfolio evidence, or release tagging in this slice.
```
