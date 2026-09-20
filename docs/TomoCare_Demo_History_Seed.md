# Demo history enrichment — September 19, 2026

Status: implemented and applied to the isolated demo; Rosa’s manual acceptance pending.

Two fictional, preprocessed Librela visits add useful history without creating or extracting more PDFs. They are verified-status **fixtures**, not evidence of a human verification session. Source titles, notes and the read-only source view explicitly identify preloaded demo history. These sampled dates do not recommend a treatment schedule.

| Visit | Weight | Recorded medication subtotal (USD) | Source |
| --- | --- | --- | --- |
| May 7, 2026 | 13.6 kg | $135.00 | New preloaded fictional history |
| July 7, 2026 | 13.4 kg | $140.00 | New preloaded fictional history |
| September 7, 2026 | 13.1 kg | $141.50 | Existing manually verified synthetic invoice |

For the current demo, medication spending is **$416.50 across four line items**. The September invoice contributes two medication items; each preloaded visit contributes one. This is recorded medication spending, not a claim of all spending or complete historical invoices. Weight changes by **−0.5 kg** across three measurements; Tomo must not infer a medical conclusion from this alone.

## Preserved state and reset behavior

The seed inserted two documents, two injection events, two weight facts and two medication costs. Before/after comparison confirmed that all pre-existing records, including the verified September invoice and reminders, were unchanged. No PDF upload, inbox import, new reminder or provider action occurred. Repeating the seed inserted zero rows.

The exact new IDs are included in the existing reset allowlist. A future full reset restores the older baseline plus these visits: seven documents, six events, three costs and seven facts before September intake. That baseline includes additional older history, so its answers differ from the current three-visit dataset. In particular, after September verification, its medication total includes the existing $142.75 baseline item and becomes $559.25. Do not reset just to test this addition.

The May/July/September example dates are fixed in 2026. Use “in 2026” when rehearsing in a later year; the older reset baseline also contains relative dates.

## Minimum manual checks

Start the usual demo server (`npm run dev:demo`, or `npm run dev:demo:avatar` for the optional live-animation worker). **No reset is needed.**

1. Ask “How much did I spend on Momo’s medication this year?” Expect $416.50 in the current 2026 dataset, with source links and the recorded-spending limitation.
2. Ask “How has Momo’s weight changed this year?” Expect May, July and September points: 13.6 → 13.4 → 13.1 kg. Switch Voice/Chat and confirm the same chart and conversation remain available.
3. Select the July point and open its source. Expect clearly labeled, read-only preloaded demo history with July 7, 13.4 kg and $140; no PDF by design. The September invoice should still open its ordinary PDF source.

These exact words are examples, not required phrases.

## Repeatable seed command

Already applied; this is available for a matching existing demo that lacks the history:

```bash
npm run demo:seed-history -- --project-ref gohzjjqsbtwavjuhjdwj
```

The command requires demo mode, the exact allowlisted project and demo pet. It inserts only missing fixture IDs, skips matching rows, and refuses conflicting fixtures before writing. It preserves reviewed changes rather than overwriting them. A partial insert can be resumed by rerunning. It never resets or deletes data.

## Validation

Focused demo/reset/seed, assistant, voice and verification tests: 293 passed. Lint and production build passed. Browser checks confirmed the actual medication answer, three-point weight answer/chart and historical source access. Existing records were compared before and after seeding. No live microphone or avatar session was needed for this data addition; broader integrated Journey acceptance remains the next checkpoint.
