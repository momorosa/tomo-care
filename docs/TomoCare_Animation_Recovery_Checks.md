# Animation interruption recovery

**Date:** September 19, 2026. **Branch:** `final-voice-animation-ui-polish`.

**Status:** Accepted by Rosa on September 19, 2026. At the actual five-minute limit, local Voice took over seamlessly and the care conversation continued. Rosa confirmed this slice is complete.

Rosa accepted transcript resizing and clarified spending answers. She then reported an unexpected animation end that did not continue through local Voice. This reopens the P10 reliability check; prior successful manual End behavior did not cover every interruption phase.

## What the log establishes

The worker completed two speech playbacks and later shut down after the browser participant disconnected with `CLIENT_INITIATED`; its final error was null. The earlier user-away message is an inactivity state notification, not itself a crash. The browser may initiate disconnect on the animation duration limit, End, navigation/unmount, or cleanup after a failure. The effective local duration is 300 seconds, matching Runway's documented five-minute maximum. Without the session start time/browser event, the supplied excerpt does not prove which path caused this incident.

## Changes

- Speech requests are registered before audio preparation, and the returned completion no longer waits behind a stalled transfer. Expiry/disconnect settles pending work during fetch, decoding, transfer, and playback so the existing generated answer reaches local Voice.
- Initial playback acknowledgement is bounded at 15 seconds; acknowledged playback keeps the existing 90-second bound. Timeouts release the live session before fallback. Late transfer completion cannot recreate settled requests.
- Loss of the participant that supplied avatar media now ends the live session even when the browser remains connected to the room. Unrelated participants leaving do not trigger recovery.
- Stop settles locally without requiring the worker's acknowledgement. If an upload has not begun playing, its transport is closed to prevent speech starting after Stop. A stalled Stop delivery during playback is also bounded. Stop/Clear/newer-answer cancellation still suppresses local replay.
- Cleanup preserves the intended end reason before aborting the connection. Expiry copy explains the time limit and how to keep speaking. A browser-console event records only the normalized animation reason/state; no transcript, credential, or care record is logged.
- If the browser refuses local audio playback, the interface explicitly offers Replay or Start speaking instead of silently swallowing the failure.

The fallback uses the already-generated audio; it does not ask an LLM to regenerate or reinterpret the answer. A partly spoken answer can restart from the beginning locally because precise remote playback position is not available. Seamless word-level resume and perceived voice/posture matching remain later production polish.

## Verification

385 automated checks passed across assistant, voice, avatar, dashboard, and model-check suites; production build passed. New regression cases cover interruption during preparation/body/upload/playback, a stalled upload, Stop without acknowledgement, and avatar participant loss while the room stays connected. Browser fixture checks confirmed automatic expiry settles once locally, returns to the local image/motion, unexpected disconnect permits another local answer and animation restart, and Stop prevents late local replay. The browser fixture simulates the provider and local audio sink; it does not establish real microphone/audio or paid-provider quality. No new paid Runway session was created for these checks.

## Minimum manual checks

Use the existing demo app plus its demo avatar worker (`npm run dev:demo` and `npm run dev:demo:avatar` in separate terminals). Refresh the page for the new frontend.

1. **Automatic ending:** start animation, continue a short conversation, and let the five-minute limit elapse. Expect a clear time-limit message and local Tomo. Press Start speaking and ask another question; it should answer normally. If an answer was in progress at expiry, expect its existing audio to play locally once.
2. **Stop and continue:** Stop an animated answer, then immediately ask another question. The stopped answer must not return later, the controls must respond, and the next answer should work. End animation during another answer and confirm local speech takes over.
3. **Recovery controls:** restart animation once. If audio cannot autoplay, the visible message should direct you to Replay; Replay should play the displayed answer. Do not intentionally cut your network, since that also removes the local Voice service's provider connection.

If a failure recurs, capture the on-screen recovery message, approximate elapsed time since Animate Tomo, whether Tomo was speaking/listening/thinking, and the browser's `[TomoCare animation]` reason. The terminal worker's orderly shutdown alone cannot distinguish those client causes.
