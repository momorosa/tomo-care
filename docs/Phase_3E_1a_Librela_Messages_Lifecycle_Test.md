# Phase 3E.1a — Librela to Apple Messages lifecycle test

## Automated boundary

Run:

```bash
npm run test:phase3e1a
```

The golden scenario proves this deterministic chain:

1. Tomo answers when Momo's next Librela care is due from verified records.
2. Tomo prepares the complete appointment-request draft.
3. The governed action resolves one active, verified clinic SMS recipient.
4. Rosa explicitly approves the frozen recipient and exact message.
5. TomoCare creates one short-lived Apple Messages handoff contract.
6. The handoff contains the complete approved draft and records only `messages_handoff_requested`.
7. The care action remains `approved`, while the workflow remains `not_sent` with `external_action_taken = false`.
8. Re-running the earlier ingestion and materialization path creates no duplicate trusted records or reminders.

The automated test does not open Messages, send a message, verify delivery, infer a clinic response, or claim an appointment booking.

## Manual macOS smoke test

Use macOS, Chrome, and a signed-in Messages app. Run this once when the native handoff contract or browser behavior changes.

1. Ask Tomo: **When is Momo's next Librela injection due?**
2. Ask Tomo: **Can you prepare Momo's Librela appointment request?**
3. Review the clinic name, dates, and complete message.
4. Approve the exact request.
5. Choose **Open in Messages**.
6. Confirm Messages opens the trusted clinic conversation.
7. Confirm the complete approved message appears as an editable draft.
8. Do not send the smoke-test message. Close or cancel the native draft.
9. Return to TomoCare and choose **I didn't send it**.
10. Confirm **Close as not sent** and verify the pending badge disappears.

Passing this smoke test proves only that macOS opened the intended conversation with the complete draft. It does not prove sending, delivery, clinic receipt, a response, or an appointment booking.
