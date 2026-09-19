# Voice + Animation checkpoint B — Transitions and first character examples

**Date:** September 19, 2026

**Branch:** `final-voice-animation-ui-polish`

**Status:** B1 transition implementation ready for Rosa’s perceptual acceptance. B2 character examples ready for product review; contextual reaction selection is not implemented.

[Character listening review](./TomoCare_Character_Review.html) · [Polish register](./TomoCare_Final_Polish_Register.md)

## What changed in B1

The old local/live handoff faded to a solid background for 100ms, changed the source, then revealed it over 120ms. At answer completion it immediately requested local media. Explicit ending, expiry, and failure cleared the video and reset its display state immediately, bypassing that visual transition. Unexpected disconnect also detached tracks before notifying the view.

The new handoff captures the outgoing decoded frame, briefly softens it, switches to prepared media, and brings the new image back into focus. It does not cross-dissolve two faces or cover Tomo with a solid-color panel. A short normal-completion interval lets the live face settle before returning locally. Local pose-matched clip selection remains unchanged.

| Path | New behavior |
| --- | --- |
| Local → live speech | Retain the outgoing frame while transitioning to a ready live video. Connecting alone still leaves local motion visible until playback starts. |
| Normal speech completion | Allow 360ms of live settling, then return to prepared local media. A new answer cancels this pending return. |
| Stop / End / expiry / disconnect | Begin the visual return immediately, preserving a frame before track detach. Stop control and provider cleanup do not wait for the visual effect. |
| Slow or failed local clip | Keep the outgoing snapshot while waiting briefly for readiness, with a bounded 640ms readiness wait and the existing still fallback. |
| Reduced Motion | Cancel the bridge, release live resources, and use the still presentation immediately. |
| Late callback / rapid restart | A stopped or superseded speech attempt cannot restore live display. Repeated Stop/End shares the in-progress return rather than capturing an already-detached track. |

The visual departure is 160ms and arrival is 240ms. These are implementation settings to judge by feel, not a claim of perfect pose matching. Capture is bounded to 1280px on its longest edge and remains in memory; no video recording is saved. Existing voice fallback, explicit Animate/End controls, and care approval boundaries remain in place.

## Minimum checks for Rosa

No reset or new care records are needed. From the repository, start the isolated demo:

```sh
npm run dev:demo
```

For actual live animation, run the matching worker in a second terminal:

```sh
npm run dev:demo:avatar
```

The worker command alone does not start an avatar session. Use **Animate Tomo** explicitly, and end the session when finished. The configured provider session limit remains unchanged.

1. **Natural completion:** start animation, ask a short question, and let the answer finish. Repeat once. Judge entry and the return to local motion: does the brief soft-focus handoff feel calmer, or too noticeable? There should be no solid flash or doubled face.
2. **Stop and End:** interrupt one answer with Stop, then end live animation. Audio should stop promptly; the image should return cleanly; ordinary local Voice should remain available. Also try ending while speech is active and report any audio or visual discontinuity.
3. **Character direction:** open the [listening review](./TomoCare_Character_Review.html). Listen to gratitude, playfulness, and gratitude mixed with worry. Review the optional happy/laughing clip candidates. Tell me whether the words and delivery sound like your Tomo, and whether the proposed expression intensity is right.

For repeatable transition-only checks without a provider session, open http://localhost:5173/tests/browser/avatar-handoff.html while the demo server runs. This uses the shipped component with local footage and simulated playback events. Its controls cover completion, Stop, stale playback-start signals, expiry, disconnect, and Reduced Motion. It produces no audio and makes no care-service or provider requests.

An explicit provider review page is also available at http://localhost:5173/tests/browser/avatar-live-preview.html. This uses the actual provider after Animate Tomo is clicked, with the fictional audio samples; it requires the worker. It is separate from the local-only fixture.

## B2 examples and the decision they support

The samples use the existing configured voice and speech instructions. They are fictional proposals, not evidence that the app now recognizes these situations or selects expressions automatically.

- **Gratitude:** a warm acknowledgment after finding an existing reminder. Candidate: a small pleased reaction. The current draft intentionally exposes a review question: does repeating “one less thing” feel natural or too echo-like?
- **Playfulness/praise:** “Momo’s tiny chief of staff” receives “Tiny paws, very serious filing system. I’ll take the compliment.” Candidate: amused or pleased. The full laughing clip may be too intense; Rosa decides.
- **Thanks mixed with worry:** acknowledge the thanks gently, then ask what is worrying Rosa. No celebration merely because the utterance contains thanks.

After this review, B2 will connect the accepted context handling, wording, voice delivery, and selected reactions. The existing personality code already supports local and semantic tone signals and generated social/framing language, so the next investigation should inspect the actual path before assuming every response is a fixed template. The current local animation sequence does not consume those tone signals. Longer-term preference storage, a new provider, or new animation assets remain separate choices.

## Validation and limits

- **180 tests passed** across dashboard, verification, and avatar regression suites. New behavioral coverage exercises settling, cancellation by a new answer, immediate Stop/End, disconnect during entry, media readiness/failure, Reduced Motion, disposal, repeated Stop/End, frame capture bounds, and notification before track detach.
- Local browser fixture confirmed normal completion, explicit end, unexpected disconnect, timed expiry, stale playback-start after Stop, and Reduced Motion during visible simulated live video. Reduced Motion left no local motion elements or visible bridge. Narrow 390px framing used matching `contain` geometry for local video, live video, and canvas, with no horizontal page overflow.
- **One actual Runway session** was exercised through the production component and isolated demo API, using the existing worker capped at 90 seconds for this test. It reached ready, completed the gratitude sample, returned through departing → arriving → steady, began the playful sample, and accepted Stop/End. This validates the configured startup path with the worker present; it does not establish the cause of the older startup failure or guarantee every future session.
- Three speech samples were generated with the existing voice provider: 4.248s, 4.656s, and 3.648s. Browser audio metadata loaded without errors. These are AI-generated review artifacts; their perceived delivery and appropriateness await Rosa’s listening review.
- Provider charges/credits were not retrieved. One avatar session and three short synthesis calls were used; no cost estimate is claimed.
- The actual local/live pose difference remains. The brief blur is a proposed transition treatment, not a regenerated pose match. Subjective smoothness and lip-sync quality still need Rosa’s review in her usual browser. No user microphone recording or care-record writes were performed.
- Production build and focused lint pass. The pre-existing LiveKit bundle-size warning remains. Review pages and fixtures are not included in the production entry point.
