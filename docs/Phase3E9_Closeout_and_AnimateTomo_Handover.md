# TomoCare Current State: Phase 3E.9 Closeout and Animate Tomo Handover

**Closeout date:** August 28, 2026

**Current branch:** `main`

**Phase 3E.9 implementation:** `7661869` — `feat(phase-3e-9): refine profile detail and voice transcript`

**Phase 3E.9 merge:** `6679047` — `Merge Phase 3E.9 governed profile detail`

**Next bounded slice:** Animate Tomo Reliability and Recovery

## Purpose

This handover records the shipped Phase 3E.9 governed Profile detail, assistant privacy boundary, Profile drawer refinement, default-open Voice transcript, validation evidence, and the opening contract for the next bounded Animate Tomo reliability slice.

Phase 3E.9 is merged and pushed to `main`. It required no database migration, environment change, provider change, extraction change, external action, or trusted-state mutation.

## Source-of-truth hierarchy

Use these sources in order:

1. Current code and passing tests on `main`
2. Current database and provider behavior
3. This handover for the settled Animate Tomo reliability scope
4. [TomoCare Product Roadmap and Portfolio Checkpoint](./TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md) for accepted sequencing and portfolio scope
5. [TomoCare Operating Brief](./TomoCare_Operating_Brief.md) for durable product and governance principles
6. [TomoCare Multi-Agent Orchestration Decision and Build Plan](./TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md) for agent and deterministic-system boundaries
7. Earlier handovers for historical context

When an older document conflicts with current code, tests, or this handover, follow the current implementation and record the discrepancy before changing behavior.

## Phase 3E.9 shipped result

TomoCare now exposes Momo's stored microchip number through one bounded governed Profile contract:

- `pets.microchip_id` is part of the explicit read-only Profile allowlist;
- surrounding whitespace is trimmed without reformatting or guessing;
- a missing identifier remains `null` and makes the Profile partial;
- the Profile drawer shows the exact stored identifier or `Not recorded`;
- direct Chat and Voice questions answer from the governed `pets` row;
- broad Profile answers, payloads, limitations, and speech do not volunteer the identifier; and
- Profile-edit requests remain behind the existing governance boundary and do not mutate `pets`.

The Profile drawer now separates **Profile details** from **Care overview** while preserving the portrait, identity summary, latest verified care, last Librela, reminders, clinic label, insurance label, navigation, drawer width, and dark visual system.

The Voice transcript now opens by default so charts, sources, links, limits, and navigation remain available during spoken conversation. Rosa may collapse and reopen it. Clearing the session clears conversation content without unexpectedly collapsing the transcript.

## Shipped architecture

### One explicit governed Profile read contract

`server/profile/profileRepository.js` continues to own the explicit `pets` selection. Phase 3E.9 adds only `microchip_id`; `select("*")`, broad row exposure, editing, and mutation remain prohibited.

`server/profile/governedProfile.js` carries the field through the same normalized Profile object used by assistant and dashboard reads. It trims stored text, preserves the remaining value exactly, turns blank text into `null`, and includes the identifier in the optional-missing contract. It does not validate against a country format, infer a manufacturer or registry, or establish registration or ownership status.

The dashboard care summary reuses the same explicit selection and normalization rather than introducing a second Profile transformation.

### Direct-only assistant disclosure

Deterministic and semantic planning use the existing `profile_summary` intent with the bounded `profile_focus = microchip_id`. The Assistant service continues to bypass broad trusted-context retrieval for Profile questions and loads only the governed Profile source.

`answerComposer.js` returns the exact identifier only for the direct microchip focus. That response payload contains only the requested `microchip_id` Profile field. For broad or unrelated Profile questions, the identifier is removed from `profile_fields`, missing-field language, limitations, relationship framing, and spoken answers.

Missing and unavailable states do not inspect documents, conversation memory, screen text, relationship memory, or other context for a substitute identifier. The governing reference remains the `pets` row rather than a fabricated document citation.

Profile-change wording still routes to the existing read-only safety boundary before Profile retrieval, so requests to set, fix, correct, update, or change a microchip number create no proposal and write no state.

### Shared Chat and Voice answer

Voice uses the same Assistant response and deterministic governed answer as Chat. It does not calculate, retrieve, or restate a separate microchip fact. Broad Profile speech cannot introduce the identifier because it is absent from the composed answer, and the spoken-answer layer does not mine hidden Profile fields.

Direct Voice speech continues through the existing OpenAI text-to-speech provider. Phase 3E.9 adds no provider, storage, logging, or telemetry path. Avoiding provider transmission for a directly requested spoken identifier would require a separate local speech architecture and remains outside this slice.

### Clearer Profile information hierarchy

The portrait and compact identity summary remain first. **Profile details** contains birth date and microchip number. **Care overview** contains latest verified care, last Librela, active reminders, primary clinic, and insurance.

The microchip value uses a full-width stacked row, tabular monospace treatment, and bounded wrapping so a long unbroken identifier does not compress its label or overflow the current drawer.

Primary clinic and insurance remain presentation-only labels. Their visual placement does not make them governed assistant sources.

### Default-open Voice transcript

`AssistantPanel.jsx` initializes the Voice transcript as open. The existing control remains an accessible expand/collapse button. An explicit user choice remains in effect for the mounted session; no preference or transcript content is persisted.

Clearing the conversation resets session turns, bounded conversation context, audio state, and the current answer but no longer forces the transcript closed. Chat continues to use the same session transcript.

## Accepted product and privacy decisions

- Show the full identifier in Rosa's private real-care Profile because the purpose is retrieval.
- Use only fictional identifiers in tests, packages, screenshots, recordings, and portfolio evidence.
- Do not add copy, edit, export, wallet, QR, registration, ownership, or travel-document actions.
- Do not infer identity or medical meaning from the identifier.
- Do not volunteer it in broad Profile or routine Voice responses.
- Do not include it in citations, orchestration traces, logs, or numeric latency telemetry.
- Keep the Voice transcript session-only even though it opens by default.
- Preserve clinic and insurance as presentation-only labels.

## Validation and acceptance evidence

Rosa's local validation reported:

- `138` passing Phase 3E.9 tests;
- `149` passing governed Profile regression tests;
- `76` passing weight and transcript regression tests;
- `105` passing Voice regression tests; and
- a successful production build.

Manual acceptance confirmed that the Profile grouping is clearer and easier to digest, the microchip detail works in the Profile experience, and the UI refinements are useful in normal use.

The implementation contains only fictional microchip values in automated tests. No live database write, migration, provider configuration change, or external action was required.

## Phase 3E.9 boundaries that remain in force

- `pets.microchip_id` is the only new governed Profile field.
- Profile facts remain read-only.
- Broad Profile answers do not expose the identifier.
- Clinic and insurance labels are not assistant sources.
- No relationship-memory, household-identity, multi-pet, or patient-ID expansion was introduced.
- No medical interpretation or care recommendation is derived from the identifier.
- No extraction, backfill, schema, provider, or demo behavior changed.
- The Voice transcript remains session-only and user-collapsible.

## Revised near-term sequence

1. **Animate Tomo Reliability and Recovery**
2. **Separate demo environment and resettable synthetic dataset**
3. **Synthetic veterinary documents and demo-safe Gmail ingestion**
4. **Final Voice, animation, and end-to-end UI polish**
5. **Demo evidence, case study, and portfolio checkpoint freeze**
6. **Broader preventive and health-intelligence work as later bounded Real-Care slices**

The next slice hardens a provider-dependent presentation layer before the resettable demo environment is built. It does not begin final animation polish or change the demo sequence.

## Next bounded slice: Animate Tomo Reliability and Recovery

### User problem

Animate Tomo is intentionally optional, and local Voice already remains available when live animation fails. The current recovery experience is incomplete:

- startup errors return to the fallback with an untyped message;
- an unexpected LiveKit disconnect silently looks like an ordinary fallback;
- the configured session-duration timeout ends live animation without explaining why;
- playback errors preserve local audio but do not retain a bounded presentation reason;
- retry is implicit through the generic **Animate Tomo** button rather than an explicit recovery decision; and
- intentional **End live animation** is not modeled separately from provider-driven disconnect behavior.

For a reliable portfolio demonstration, Rosa should always understand whether live animation is starting, ready, intentionally ended, temporarily unavailable, or safely continuing through local Voice.

### Accepted outcome

After the reliability slice:

1. Animate Tomo remains explicitly user-started and optional.
2. Starting, live-ready, intentional-end, recoverable-failure, and local-only states are visually distinct and accessible.
3. Known failures retain one allowlisted non-sensitive reason for presentation and testing.
4. Every failure states that Tomo's answer and local Voice remain available.
5. Transient failures offer a clear **Try animation again** action.
6. Retry cleans up the prior client, media tracks, transition state, and timers before creating one fresh session.
7. Retry never reconnects automatically and never replays the preceding answer.
8. If live playback fails after speech is generated, the same local audio plays exactly once.
9. An intentional **End live animation** returns calmly to local presentation without showing an error.
10. Reduced Motion continues to prevent live startup and uses the still/local fallback without presenting that preference as a failure.

### Current architecture to preserve

- `RunwayAvatarMedia.jsx` owns live presentation state and the explicit start/end controls.
- `runwayAvatarClient.js` owns LiveKit connection, finished-audio transfer, bounded status handling, stop control, disconnect handling, and typed client errors.
- `liveAvatarSession.js` and the avatar route keep feature flags, provider credentials, session creation, and short-lived token generation on the server.
- `runwayAvatarAgent.js` forwards only TomoCare-generated audio and does not reason, converse, transcribe, or call tools.
- `AssistantPanel.jsx` owns the already-generated local audio fallback and must remain the final guarantee that Voice continues.
- Static image, local motion, reduced-motion behavior, transcript, and numeric-only latency reporting remain available independently of Runway.

### Proposed presentation contract

Use a small deterministic presentation layer that maps internal live state and an allowlisted failure reason to:

- user-facing status title and explanation;
- whether retry is safe;
- retry or local-only action label;
- accessible live-region behavior; and
- a non-sensitive diagnostic reason retained only for the current browser session.

The raw provider message must not be rendered. Unknown errors map to a generic safe animation failure while preserving local Voice.

Expected reason families include:

- configuration: `avatar_disabled`, `avatar_not_configured`;
- startup: `avatar_session_failed`, `invalid_avatar_session`, startup timeout;
- connection: unexpected `avatar_disconnected`;
- lifecycle: session duration expired;
- speech preparation: `avatar_audio_unavailable`, `empty_audio`, `audio_too_large`, `unsupported_audio`;
- playback: `avatar_playback_failed`, `avatar_playback_timeout`; and
- intentional user end, which is a normal outcome rather than a failure.

Exact internal names may be consolidated during implementation, but tests must prove that retryability and user-facing language are deterministic.

### Retry and fallback decisions

- Do not retry automatically. Live sessions may consume provider time and should remain under Rosa's control.
- A retry starts a new animation session only. It does not replay the last answer or synthesize speech again.
- The previous client and timers must be cleaned up before retry to prevent duplicate tracks, callbacks, or expiry timers.
- A provider or live-playback failure must reject back to `AssistantPanel`, which continues the existing local audio path exactly once.
- Configuration-disabled and Reduce Motion states should not offer a misleading transient retry.
- Session expiry may offer a fresh user-initiated start because the prior provider session ended normally.
- Muting, stopping playback, replaying an answer, clearing the session, switching Chat and Voice, and ending live animation must retain their current meanings.

### Minimum visual treatment

- Keep the current avatar stage, control placement, local media, dark visual system, transcript, and responsive behavior.
- Replace ambiguous transient error text with one compact status-and-recovery treatment near the existing Animate control.
- State that local Voice continues.
- Use **Try animation again** only when retry is safe.
- Keep **Animate Tomo** for the ordinary initial state and **End live animation** for a healthy live session.
- Do not add a modal, toast system, settings panel, automatic countdown, provider branding, or diagnostic code visible as primary UI.

### Required tests

The next slice should prove:

1. Known reason codes map to bounded user-facing status, retryability, and actions.
2. Unknown provider messages cannot reach the UI.
3. Startup permits only one in-flight session request and has a bounded timeout or cancellation path.
4. Intentional end and unexpected disconnect produce different presentation states.
5. Session expiry is visible and can start one fresh session on user request.
6. Playback failure preserves the existing local audio exactly once.
7. Retry cleans the old client, tracks, speech state, transition state, and timers before reconnecting.
8. Retry does not replay or resynthesize the previous answer.
9. Reduced Motion prevents live startup and is not labeled as a provider failure.
10. No provider secret, care content, transcript, audio bytes, pet identifier, or raw error is added to logs or telemetry.
11. Existing avatar protocol, short-lived session token, speech transfer, stop control, local motion, Voice, transcript, accessibility, latency, and production-build checks remain green.

### Manual acceptance scenarios

1. Start Animate Tomo successfully and confirm local media remains available until live speech begins.
2. End live animation intentionally and confirm no failure message appears.
3. Test with animation disabled or not configured and confirm the UI explains local Voice without a misleading retry loop.
4. Simulate startup failure and confirm one visible recovery state and one user-initiated retry.
5. Simulate an unexpected disconnect and confirm local Voice remains usable.
6. Let a short test session expire and confirm the reason is visible and a fresh start is available.
7. Simulate live playback failure and confirm the answer plays locally once, without overlap or duplication.
8. Retry after failure and confirm the prior answer is not replayed.
9. Confirm mute, stop, replay, transcript, Chat switching, Clear, and reduced-motion behavior still work.
10. Confirm no care fact, trusted state, external action, or provider configuration changes.

### Explicitly out of scope

- Automatic reconnect or background retry loops
- New animation, speech, or avatar providers
- Provider account, billing, credential, or environment reconfiguration
- New character design, gestures, expressions, motion clips, or semantic reaction mapping
- Voice answer, transcription, synthesis, personality, or conversation changes
- Final animation transitions or general end-to-end UI polish
- Demo environment, synthetic data, synthetic documents, or Gmail demo intake
- Database tables, durable failure logs, orchestration runs, care actions, or trusted-state changes
- Medical interpretation or care intelligence

## Definition of done

The Animate Tomo reliability slice is complete only when:

- every supported failure resolves to a visible bounded state;
- intentional end is not treated as failure;
- transient failures have a user-controlled retry;
- configuration and reduced-motion states remain honest and non-retryable when retry cannot help;
- local Voice continues exactly once when live playback fails;
- retry cleans previous resources and does not replay an answer;
- raw provider errors, secrets, identifiers, and care content remain outside presentation and telemetry;
- existing Voice, transcript, local motion, avatar protocol, accessibility, and latency behavior remain intact;
- affected tests and the production build pass; and
- Rosa completes the manual acceptance scenarios.

## Recommended branch

After this documentation checkpoint is committed and pushed on `main`, create:

```bash
git switch -c animate-tomo-reliability-recovery
git push -u origin animate-tomo-reliability-recovery
```

## Pasteable opening message for the next implementation chat

```text
We completed and merged TomoCare Phase 3E.9 at 6679047. I am now on the animate-tomo-reliability-recovery branch.

Use docs/Phase3E9_Closeout_and_AnimateTomo_Handover.md as the current implementation handover, docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md for the accepted portfolio sequence, docs/TomoCare_Operating_Brief.md for durable product and governance principles, and the current avatar code and tests as the implementation source of truth.

We are starting the bounded Animate Tomo Reliability and Recovery slice.

First inspect RunwayAvatarMedia, runwayAvatarClient, the live-avatar session route, avatar agent and protocol, AssistantPanel local-audio fallback, motion and Voice accessibility tests, latency handling, and current cleanup behavior. Then walk me through the smallest product and technical decisions before preparing code.

Make startup, unexpected disconnect, session expiry, and playback failures visible through a typed non-sensitive presentation contract. Preserve uninterrupted local Voice, distinguish intentional end from failure, and offer one user-initiated retry for transient states after complete cleanup. Retry must not reconnect automatically, replay the previous answer, resynthesize speech, duplicate audio, or expose raw provider errors.

Do not add providers, provider configuration, durable failure storage, answer or speech changes, character redesign, new gestures or semantic reactions, final animation polish, demo-environment work, synthetic data, database changes, care actions, or medical intelligence in this slice.
```
