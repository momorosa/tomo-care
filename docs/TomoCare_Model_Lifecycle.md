# TomoCare model lifecycle and migration checks

**Reviewed:** September 19, 2026. **Owner:** implementation checks by Codex; voice/character and product tradeoffs reviewed with Rosa.

## Current configuration

Both real care and demo use these shared providers. Local environment overrides and source defaults were inspected, and all four model metadata endpoints were accessible using the configured credentials. Metadata checks establish access, not inference accuracy or future availability. No defaults or voice identity changed in this review.

| Role | Effective model | Review result | Next action |
| --- | --- | --- | --- |
| Language understanding and character wording | `gpt-5.6-terra` | Listed in the current OpenAI catalog; no retirement notice found for this model. | Retain the tested structured-output contract. A newer flagship is not automatically a better latency/cost fit. |
| Recorded speech transcription | `gpt-transcribe` | Current file-transcription model; no retirement notice found. | Keep care vocabulary and semantic-paraphrase regression checks. |
| Voice synthesis | `gpt-4o-mini-tts-2025-12-15`, voice `marin` | Current listed snapshot; no retirement notice found for this snapshot. | Keep the pinned voice behavior; review pronunciation, warmth, and restraint before any replacement. |
| Document extraction | `gemini-3-flash-preview` | Accessible, but still a preview. Google lists no shutdown date and recommends `gemini-3.6-flash` as replacement. | Evaluate the stable replacement on synthetic documents before switching. This evaluation is the next model-maintenance item, not a shipped migration. |
| Live animation | `gwm1_avatars` through the installed LiveKit Runway plugin | Installed plugin model matches Runway's current integration documentation. | Preserve supplied-audio architecture; rehearse expiry, disconnect, Stop, and restart. Provider metadata/session creation was not re-tested here. |

OpenAI's notices for legacy realtime/audio/transcription models do not by themselves mean the configured TTS snapshot is retiring. Compare exact model identifiers, not similar family names. "No notice found" is time-specific, not a support guarantee.

Sources checked: [OpenAI model catalog](https://developers.openai.com/api/docs/models), [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [GPT-Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe), [TTS snapshots](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts), [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations), [Gemini lifecycle](https://ai.google.dev/gemini-api/docs/deprecations), [Gemini model versions](https://ai.google.dev/gemini-api/docs/models), [Runway integration](https://docs.dev.runwayml.com/characters/integration/), and [Runway session limits](https://docs.dev.runwayml.com/characters/concepts/).

## Repeatable checks

Run `npm run models:check` for real-care configuration, or `npm run models:check:demo` for demo overrides. `-- --offline` inspects configuration only. The script sends authenticated GET requests for model metadata; it does not submit prompts, audio, PDFs, care records, or generation requests. It does not change models. Unknown overrides and preview use get a review warning; a lifecycle review older than 30 days also gets a warning. Network/access failures are not reported as successful checks. It does not scrape retirement notices or schedule monitoring.

At each release checkpoint, and before a model change, run this check and revisit the official lifecycle links. Refresh the review date and exact reviewed identifiers only after checking those notices. Preview providers warrant checking at each release because their notice periods can be short. No recurring automation was created.

## Migration and rollback

1. Record the provider notice, exact affected model, shutdown date, replacement, endpoint/parameter changes, and a migration target comfortably before shutdown. Treat loss of access as a release blocker, not a reason to silently substitute a model.
2. Test a candidate with the existing environment overrides: `TOMO_SEMANTIC_MODEL`, `TOMO_STT_MODEL`, `TOMO_TTS_MODEL`, `TOMO_TTS_VOICE`, or `TOMO_GEMINI_MODEL`. Use demo/synthetic material and the existing provider boundary. Keep one role changed at a time.
3. Check factual grounding, missing-data behavior, approval gating, ambiguous spending follow-ups, strict output schemas, care-name transcription, and character restraint. For extraction, compare amounts, currencies, dates, medication/vaccine facts and unknown fields against known synthetic expected values. No extracted candidate enters trusted records without verification.
4. Compare response time and provider cost with the current baseline. For speech, Rosa reviews appreciation, playfulness, concern, pronunciation, interruptions, and local/live continuity. Preserve `marin` only if the new model explicitly supports it; do not silently choose a different voice.
5. Promote the tested model through one configuration change, restart relevant services, rehearse both modes, and record acceptance. Retain the prior configuration and commit for rollback while that model remains supported. After retirement, rollback must target another already-tested supported model, not the retired identifier.

Current actions: retain the supported OpenAI models; schedule the stable Gemini extraction evaluation within the next implementation milestone. That candidate is not yet validated for TomoCare. Accuracy and character quality remain acceptance gates for all model upgrades.
