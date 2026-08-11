# TomoCare Runway + LiveKit setup

This slice keeps TomoCare in control of the conversation:

- TomoCare records the question, retrieves verified care context, and creates the answer.
- TomoCare’s existing OpenAI speech provider creates the MP3.
- LiveKit carries that finished audio to the avatar worker and carries Runway’s synchronized media back to the browser.
- Runway animates Tomo. It does not receive Momo’s records, the user’s question, citations, prompts, or governed-action payloads.

Pose-matched local motion and normal local audio remain the fallback whenever the live provider path is unavailable. Reduced-motion behavior continues to use the still Tomo image.

## 1. Install the added packages

From the TomoCare repository root:

```bash
npm install
```

## 2. Add local environment settings

Keep the existing `.env` file. Add these values to it without deleting the existing Supabase, OpenAI, Google, Twilio, or other settings:

```bash
TOMO_RUNWAY_ENABLED=true
TOMO_RUNWAY_AVATAR_ID=85113904-a5ab-4368-abd5-c56cd8071f04
TOMO_RUNWAY_MAX_DURATION_SECONDS=120

RUNWAYML_API_SECRET=your_actual_runway_api_secret

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_actual_livekit_api_key
LIVEKIT_API_SECRET=your_actual_livekit_api_secret
```

Do not paste these secrets into chat, put them in a client-side `VITE_` variable, or commit `.env`.

`TOMO_RUNWAY_MAX_DURATION_SECONDS` defaults to 120 seconds and is capped at Runway’s five-minute session maximum.

## 3. Run static validation

```bash
npm run test:phase3d-avatar
npm run test:phase3c-ui
npm run test:phase3d-voice
npm run test:phase3b
npm run test:phase3c-orchestration

node --check server/index.js
node --check server/routes/avatar.js
node --check server/avatar/liveAvatarSession.js
node --check server/avatar/runwayAvatarAgent.js
node --check shared/avatarProtocol.js
node --check src/pages/Dashboard/api.js
node --check src/pages/Dashboard/runwayAvatarClient.js

npx eslint \
  server/index.js \
  server/routes/avatar.js \
  server/avatar/liveAvatarSession.js \
  server/avatar/liveAvatarSession.test.js \
  server/avatar/runwayAvatarAgent.js \
  server/avatar/runwayAvatarAgent.test.js \
  shared/avatarProtocol.js \
  src/pages/Dashboard/AssistantPanel.jsx \
  src/pages/Dashboard/RunwayAvatarMedia.jsx \
  src/pages/Dashboard/api.js \
  src/pages/Dashboard/conversationalHomeAccessibility.test.js \
  src/pages/Dashboard/runwayAvatarClient.js \
  src/pages/Dashboard/runwayAvatarClient.test.js \
  src/pages/Dashboard/voiceAccessibility.test.js

npm run build
```

## 4. Start TomoCare and the avatar worker

The API/UI and avatar worker remain separate local processes, but one command can manage all three development tasks in a single Terminal. Restart them after changing `.env`:

```bash
npm run dev:all
```

The output is labeled `ui`, `api`, and `avatar`. Press `Ctrl+C` once to stop all three.

If you need to debug the processes independently, use the original two-Terminal setup instead.

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:avatar
```

The avatar worker must remain running while using live animation. Starting the worker does not begin a paid Runway session; selecting **Animate Tomo** does.

## 5. Run one short provider-backed test

1. Open TomoCare in Voice mode. The local `idle-a` clip should play once and hold its final frame.
2. Select **Animate Tomo**. This is the action that starts a paid Runway session.
3. Wait for live video to replace the local motion stage.
4. Ask one short question, such as “When was Momo last given Librela?”
5. Confirm Tomo’s existing voice plays once, the mouth follows the speech, and the transcript and citations remain unchanged.
6. Select **Stop** during a second short reply and confirm playback stops.
7. Select **End live animation** and confirm local motion returns.
8. Check the Runway developer portal for the credits used by this test.

If live startup or playback fails, TomoCare should return to local motion and play the existing local audio. A provider error must not remove the grounded answer or transcript.

## Local motion sequence

The local motion follow-up is shipped. The default voice sequence is:

```text
idle-a → acknowledging-a → listening-c → thinking-b → live Runway → idle-a
```

The clips remain separate so the UI can respond to variable speaking and processing times. Each core clip plays once and holds its final frame. The player preloads the incoming local clip while the outgoing frame remains visible, then cuts directly between the pose-matched sources. Local transitions do not overlap two faces and do not use a purple cover. The one-time transition between local footage and Runway remains guarded because the generated and live poses differ.

Required files:

```text
public/media/tomo/motion/idle-a.mp4
public/media/tomo/motion/acknowledging-a.mp4
public/media/tomo/motion/listening-c.mp4
public/media/tomo/motion/thinking-b.mp4
```

Other clips, including `happy-a`, `laughing-a`, and `oops-a`, remain media assets only. Meaning-based reaction selection is planned product work and is not part of the current lifecycle state machine.

## Observed latency and cost evidence

One instrumented live turn produced the following measurements in milliseconds:

| Measurement | Observed |
| --- | ---: |
| Transcription | 630 |
| Answer generation | 1,619 |
| Speech generation | 998 |
| Server total | 3,247 |
| Network and serialization | 46 |
| Voice round trip | 3,293 |
| Audio preparation | 5 |
| Speech transfer | 2 |
| Avatar startup | 311 |
| Avatar playback | 4,575 |
| Avatar total | 4,893 |

The measured wait from voice submission to live-avatar playback was approximately `3,611 ms`. The complete turn, including `4,575 ms` of spoken avatar playback, was approximately `8,186 ms`. Answer generation was the largest pre-speech segment, followed by speech generation. The browser/network overhead and Runway startup were comparatively small in this sample.

The browser logs numeric timing fields only. It does not log transcripts, audio, care facts, citations, or identifiers.

Runway test cost and credits were not captured. Several short, explicitly started development sessions were used, but no portal screenshot or per-session credit value was saved. Do not estimate cost from session length; capture the provider-reported value during the next paid evaluation.

## Current boundary and deferred work

- Sessions start only after **Animate Tomo** is selected.
- The development duration defaults to two minutes and cannot exceed five minutes.
- LiveKit’s browser code loads on demand, not during the normal TomoCare page load.
- Switching to Chat, clearing the session, leaving the page, selecting **End live animation**, or reaching the duration limit disconnects the live session.
- Reduced-motion preference keeps the still image and disables live startup.
- Local state clips are shipped as one-shot, final-frame-hold motion. They do not loop.
- Runway is a visual layer only. TomoCare retains transcription, grounded answering, speech generation, citations, and action governance.
- The generated/live posture handoff is intentionally visible. The current goal is a clean state change, not a frame-perfect match between separate providers.
- Meaning-based character reactions, further latency work, and production cost measurement remain follow-up work.

Official references:

- Runway avatar plugin: https://docs.livekit.io/agents/models/avatar/plugins/runway/
- LiveKit virtual avatar flow: https://docs.livekit.io/agents/models/avatar/
- LiveKit byte streams: https://docs.livekit.io/transport/data/byte-streams/
