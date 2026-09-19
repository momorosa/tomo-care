# Tomo’s character — B2 delivery and manual checks

**Date:** September 19, 2026  
**Branch:** `final-voice-animation-ui-polish`  
**Status:** Approved character direction implemented; Rosa’s in-app listening and expression acceptance pending.

## What is now connected

Tomo’s existing semantic interpretation now guides wording, speech delivery, and a bounded local expression. Natural paraphrases work through the language model; the review examples are not passwords or fixed reply scripts. The implementation is shared by real care and demo. Voice and Chat share the character wording; the visible expression appears in the Voice stage.

| Context | Delivery | Expression |
| --- | --- | --- |
| Appreciation, praise, delight | Warm and quietly pleased | Existing happy clip, once |
| Clear affectionate joke | Gently amused | Existing laughing clip, once |
| Thanks or humor mixed with concern | Calm and attentive | Ordinary local presentation; no celebration |
| Frustration or sarcastic criticism | Calm, direct acknowledgment | No celebration |
| Missing evidence, medical boundaries, action review | Restrained; factual content preserved | No celebration |
| Neutral or uncertain interpretation | Conversational or restrained as appropriate | No guessed positive expression |

Local expressions accompany ordinary local Voice. When live animation is speaking, the expression is prepared after speech completion and plays on the return to local media. It does not replace the live face mid-sentence. Expressions return to idle after one play. Stop, End, a new listening/thinking turn, and clearing the session cancel old cues. Reduced Motion uses the still presentation. Failed expression loads fall back rather than waiting indefinitely.

The existing voice, model configuration, Runway provider, care facts, citations, and approval mechanisms remain in place. Character metadata can select only supported local clips. It cannot supply arbitrary media URLs or authorize an action. Generated social language has additional checks against common unsupported health reassurance and invented shared memories; these checks are bounded safeguards, not a proof that all possible model mistakes are eliminated.

## Minimum manual checks

Start the website in one terminal, from the repository:

```sh
npm run dev:demo
```

For live animation, also start its worker in a **second** terminal:

```sh
npm run dev:demo:avatar
```

Open **http://localhost:5173**. Start with ordinary Voice, without Animate Tomo. No reset, inbox check, or care-record changes are needed.

1. **Thanks in your own words.** Try two different expressions of appreciation. Expect a warm, concise reply and a brief pleased reaction, followed by idle. Judge whether it feels personal without being overdone.
2. **Playful praise.** Make a small joke about Tomo’s role or reward. Expect a reply that responds to the joke’s specific meaning and an amused reaction. Judge whether the existing laugh is too large for a gentle joke.
3. **Mixed emotions.** Express thanks but also worry about Momo, then try a disappointed or sarcastic remark. Expect calm acknowledgment and no happy/laughing reaction. Tomo must not claim Momo is fine simply to reassure you.
4. **A real care question.** Ask a known read-only question in your own friendly wording. Compare the answer and evidence as usual; character must not change values, imply missing facts, or suggest an action was completed. Chat should provide the same grounded behavior.
5. **One live answer and one interruption.** Select Animate Tomo, express thanks, and let the answer finish. Expect live speech followed by one local reaction. On another answer, use Stop, then End live animation. Audio must stop promptly and an old reaction must not reappear when you start a new question.

Tell me which situation felt right or wrong, roughly what you said, and whether the issue was the words, delivery, expression intensity, or timing. Exact phrasing is useful evidence, but is not required for Tomo to understand you.

## Validation

- **365 tests passed** across assistant, voice, dashboard, and avatar suites. New cases cover semantic paraphrases, mixed-signal precedence, health/action restraint, unsupported reassurance, voice tone propagation, bounded animation selection, and matching real/demo behavior.
- **Eight fictional live language checks passed their expected expression classification** after prompt refinement: two gratitude paraphrases, two affectionate jokes, thanks with implicit worry, sarcastic criticism, a health question phrased with laughter, and a thankful weight query with deliberately absent evidence. Care context was stubbed empty; no real care records were read or written. The last two remained clarification/missing-evidence answers.
- A preceding eight-case language run informed the refinement away from repeating sample wording. An initial run without base credentials exercised fallback and was not counted as successful semantic validation.
- Three short speech requests using the new delivery instructions produced decodable MP3s: gratitude 4.008s, playful 5.304s, concern 2.808s. This validates generation, not subjective voice quality. The synthetic files were temporary QA artifacts.
- Browser checks used the production avatar component with simulated live transport. Verified a pleased reaction, amused footage, return to held idle, a deferred reaction actually playing after live completion, Stop cancellation, new-listening cancellation, and Reduced Motion without stale replay. No new Runway session or microphone recording was used in this slice.
- Focused lint, production build, and whitespace checks pass. The existing LiveKit bundle-size warning remains.

## Boundaries for the next review

This is meaning inferred from typed or transcribed words, not analysis of vocal prosody or facial expressions. It does not add persistent preference learning or full conversational memory; repeated wording remains possible. Current care follow-up context remains deliberately bounded. Subtle emotion control inside the live Runway face is not added: speech delivery changes, and the selected local expression follows live speech. The existing assets’ intensity and pose fit still need Rosa’s judgment.

Voice directions use the existing speech API’s supported [delivery instructions](https://developers.openai.com/api/docs/guides/text-to-speech). No model or voice migration is included.
