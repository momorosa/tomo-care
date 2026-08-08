# TomoCare Runway + LiveKit setup

This slice keeps TomoCare in control of the conversation:

- TomoCare records the question, retrieves verified care context, and creates the answer.
- TomoCare’s existing OpenAI speech provider creates the MP3.
- LiveKit carries that finished audio to the avatar worker and carries Runway’s synchronized media back to the browser.
- Runway animates Tomo. It does not receive Momo’s records, the user’s question, citations, prompts, or governed-action payloads.

The still Tomo image and normal local audio remain the fallback whenever the live provider path is unavailable.

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

1. Open TomoCare in Voice mode. The still Tomo image should appear first.
2. Select **Animate Tomo**. This is the action that starts a paid Runway session.
3. Wait for live video to replace the still image.
4. Ask one short question, such as “When was Momo last given Librela?”
5. Confirm Tomo’s existing voice plays once, the mouth follows the speech, and the transcript and citations remain unchanged.
6. Select **Stop** during a second short reply and confirm playback stops.
7. Select **End live animation** and confirm the still image returns.
8. Check the Runway developer portal for the credits used by this test.

If live startup or playback fails, TomoCare should show the still image and play the existing local audio. A provider error must not remove the grounded answer or transcript.

## Current boundary and deferred work

- Sessions start only after **Animate Tomo** is selected.
- The development duration defaults to two minutes and cannot exceed five minutes.
- LiveKit’s browser code loads on demand, not during the normal TomoCare page load.
- Switching to Chat, clearing the session, leaving the page, selecting **End live animation**, or reaching the duration limit disconnects the live session.
- Reduced-motion preference keeps the still image and disables live startup.
- Local idle, listening, thinking, and speaking-fallback video loops are a separate follow-up slice.

Official references:

- Runway avatar plugin: https://docs.livekit.io/agents/models/avatar/plugins/runway/
- LiveKit virtual avatar flow: https://docs.livekit.io/agents/models/avatar/
- LiveKit byte streams: https://docs.livekit.io/transport/data/byte-streams/
