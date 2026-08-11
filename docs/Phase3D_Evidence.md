# TomoCare Phase 3D evidence

**Phase:** 3D — Conversational Tomo  
**Status:** Shipped on `phase-3d-runway-character`; merge to `main` pending  
**Evidence updated:** August 11, 2026

## Scope verified

Phase 3D moved TomoCare from a dashboard-centered assistant to a voice-first conversational home. The shipped scope includes semantic interpretation inside the supported intent map, bounded relationship context and personality, one session transcript across Voice and Chat, microphone and speech output, a Runway + LiveKit visual layer, pose-matched local motion, provider fallback, accessibility behavior, and numeric-only latency instrumentation.

The phase did not change TomoCare's source of truth or action authority. Grounded answers, citations, deterministic care logic, and approval-gated actions continue to use the existing backend.

## Automated evidence

The following explicit counts were recorded at the state-driven motion and latency checkpoint:

```text
Avatar:               9 passed
Voice:               86 passed
Dashboard:           61 passed
Phase 3B regression: 214 passed
Production build:     successful
```

The later transition-smoothing, pose-matched sequence, and filename-correction checkpoints also passed their requested tests and production builds. Exact final suite counts were not copied into the closeout record, so they are not reconstructed here.

Final validation commands:

```bash
npm run test:phase3d-avatar
npm run test:phase3d-voice
npm run test:phase3c-ui
npm run test:phase3b
npm run build
```

## Live latency sample

One provider-backed turn produced this browser timing object:

```text
transcription_ms:              630
answer_generation_ms:        1619
speech_generation_ms:         998
server_total_ms:             3247
network_and_serialization_ms:  46
voice_round_trip_ms:         3293
audio_prepare_ms:               5
speech_transfer_ms:             2
avatar_startup_ms:            311
avatar_playback_ms:          4575
avatar_total_ms:             4893
```

Derived from the same sample:

- Voice submission to live-avatar playback: approximately `3,611 ms`
- Complete turn including avatar playback: approximately `8,186 ms`
- Largest pre-speech segment: answer generation at `1,619 ms`
- Second-largest pre-speech segment: speech generation at `998 ms`

This is one development sample, not a benchmark or service-level claim.

## Provider cost evidence

Runway credits and dollar cost were not captured. The evaluation used several short sessions that began only after **Animate Tomo** was selected. No provider-portal screenshot or per-session credit value was saved, so this closeout does not estimate cost.

The next paid evaluation should record:

- Session start and end time
- Provider-reported credits consumed
- Dollar value, if the portal provides it
- Number of spoken turns
- Whether the session ended manually or at the duration limit

## Manual and visual evidence checklist

- [x] Voice and Chat use the same grounded assistant and session transcript.
- [x] Grounded text, citations, and reminder evidence remain visible during voice use.
- [x] Live animation starts only after the user selects **Animate Tomo**.
- [x] Ending the live session returns the interface to local Tomo media.
- [x] Local audio remains available when Runway is not started.
- [x] Reduced-motion behavior retains the still-image path.
- [x] Browser latency output contains numeric timing fields only.
- [x] QuickTime transition recording reviewed: `Screen Recording 2026-08-09 at 12.35.39 PM.mov` (received as a ZIP in the working session).
- [x] The recording exposed repeated loop resets, purple transition flickers, and face overlap between mismatched sources.
- [x] The production motion path was simplified to `idle-a → acknowledging-a → listening-c → thinking-b → live Runway`.
- [x] Core local clips now play once, hold their final frame, preload the next source, and cut directly between pose-matched clips.
- [x] Rosa manually verified the final pose-matched flow and reported that it works much better.
- [ ] Capture a short after-state video for the portfolio asset set. This is useful evidence, not a Phase 3D shipping blocker.
- [ ] Capture Runway credits or cost during the next paid provider test.

## Privacy and provider boundary

Runway receives the finished speech audio required for animation. It does not receive Momo's trusted records, the user's question, citations, prompts, or governed-action payloads. Provider secrets remain server-side. Browser latency logs exclude transcripts, audio, care facts, citations, and identifiers.

## Known limitations and deferred work

- The generated/live posture change is visible because local clips and Runway start from different poses.
- The latency sample is a single development turn.
- Runway cost has not been measured.
- Meaning-based `happy`, `laughing`, and `oops` reactions are planned but not connected to semantic intent.
- Assistant coverage is narrower than the full visible product surface.
- Governed navigation and tool-use skills, including opening the relevant Google Calendar reminder or Calendar view, are planned.
- Durable conversation history, production hosting, authentication, and multi-user support remain outside Phase 3D.

## Repository closeout

The correct asset exists at:

```text
public/media/tomo/motion/idle-a.mp4
```

The branch still contains an identical duplicate with a leading space:

```text
public/media/tomo/motion/ idle-a.mp4
```

Delete the leading-space duplicate before merging. No code references it.
