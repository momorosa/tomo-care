# Integrated Journey checkpoint — September 19, 2026

Status: implementation review and bounded repairs complete; Rosa’s integrated manual acceptance and fresh-source rehearsal remain pending.

The review covered the three existing stories: source to trusted records, trusted records to useful answers, and governed follow-through. It preserved the current demo dataset. No reset, inbox import, verification, new reminder, Calendar operation, outbound message, microphone capture or live avatar session was performed.

## Findings and repairs

- **October scope explanation:** the correct October reminder was accompanied by “tomorrow-only” limitation text. The explanation now describes the selected future window; tomorrow questions retain their specific explanation. A regression test covers October.
- **Inbox recovery (P11):** text-processing failure no longer suggests OCR as an early diagnosis. The message explains that the PDF is saved, trusted records are unchanged, and the next steps are source inspection and retry. The processing-stage identifier remains available under collapsed **Technical details**.
- **Unavailable demo Calendar controls:** reminder cards offered Calendar sync and Attention offered Calendar navigation even though demo execution is intentionally blocked. Those controls are now hidden in demo mode. Private-care controls and the server’s existing provider boundary are unchanged.
- **Outdated verification test:** one older test expected saving a correction to lead to approval. The app already correctly requires a separate explicit verification action. The test now protects that accepted boundary; no approval behavior changed.

## Verified in this pass

| Journey step | Evidence | Result |
| --- | --- | --- |
| Correct candidate, then explicitly verify | Existing service/route tests plus the shipped-component browser fixture | Correction saved as SAMPLE-002 and stayed unverified. Confirmation states no follow-up actions exist yet; optional next steps appear afterward. Fixture callbacks do not exercise live extraction or database approval. |
| October Attention | Actual demo Chat | Librela reminder opens October 19, due around October 26. Correct future-window limitation. **Open reminder** focuses and expands the governing reminder. |
| Missing evidence | Actual demo Chat asking whether Rabies was administered September 7 | **Missing verified data**; Tomo does not infer vaccine administration. |
| Voice/Chat continuity | Actual demo mode switch | October Attention and the missing-evidence exchange remain in the same transcript. This is not a new microphone/playback acceptance. |
| Appointment draft | Actual demo assistant and dialog | Names the fictional clinic, September 7 injection and October 26 due date. Editable, review-only, no recipient destination or sending/approval action. |
| Compact draft usability | Shipped-component fixture at 390 × 600 | Keyboard reaches the field, Copy and Done through scrolling. Focus wraps to Close; Escape dismisses and restores focus to the opener. Viewport restored afterward. |
| Regression coverage | Automated checks | 721 tests passed, zero failures. Focused ESLint and production build passed; existing LiveKit bundle-size warning remains. |

The live demo currently has the existing Librela reminder but **no insurance reminder**. A one-item October answer is therefore correct for this starting state. It is not evidence that the insurance story failed.

The prior accepted three-point history and spending checks remain accepted. Full assistive-technology speech, measured contrast, native 200% zoom, Reduced Motion perception, fresh Gmail-to-verification replay and combined live audio are not newly certified by this pass. Two document-list requests intermittently returned “JWT issued at future” during this pass (verified archive, then pending review). Other care requests succeeded. The cause is not established; do not call it resolved or claim a clean startup reliability pass. Track this authentication-timing symptom for investigation before evidence capture; no credentials or system-clock settings were changed.

## Rosa’s minimum integrated checks

Start `npm run dev:demo`, then open the displayed Vite URL and confirm **Demo data**. Keep that running if you separately start `npm run dev:demo:avatar` for optional live animation; the avatar command starts only the worker.

### 1. Current state: useful answers and honest uncertainty

No reset needed. Ask about medication spending and weight history, then ask whether the September source proves Rabies administration. Confirm the three 2026 weights and $416.50 recorded medication total in this current dataset; the Rabies answer must not claim administration. Select a chart source, switch Voice/Chat, and reopen the transcript. Evidence and conversation should remain available. Listen to one answer and try Stop or Replay.

### 2. Current state: Attention to an editable draft

Ask “What needs my attention in October?” Expect the October 19 Librela reminder and October 26 due date, with no “tomorrow-only” wording. Open the reminder; demo Calendar controls should be absent. Ask Tomo to draft a message requesting Momo’s next Librela appointment. Edit and copy the draft; confirm the dates and **Review-only demo draft** boundary. Nothing is sent or booked. Try Tab, Shift+Tab and Escape in a short window, then native 200% browser zoom. Use the existing fixture for repeatable dialog checks if helpful.

### 3. Final fresh-source rehearsal

This is the remaining end-to-end acceptance before capture. It intentionally replaces demo review/reminder state, so finish checks 1–2 first. Stop the servers, then use the existing bounded reset and restart:

```bash
npm run demo:reset -- --project-ref gohzjjqsbtwavjuhjdwj
npm run dev:demo
```

Check inbox; review the September synthetic PDF, correct the missing invoice number from the source (`HVC-DEMO-090726`), save/recheck, and verify separately. Confirm that only explicit verification adds trusted records. Continue to optional actions and create both the Librela and insurance reminders. October Attention should now include insurance on October 7 and Librela on October 19. Prepare the review-only draft and compare its dates with the source and reminder.

**Reset changes the expected dataset:** it restores the older baseline plus May/July history. After September verification, recorded medication spending becomes $559.25, and all-time weight history has seven points (six dated in 2026 at this checkpoint). Do not expect the current three-point/$416.50 dataset after a full reset. The new historical visits remain part of the reset manifest.

Report pass/fail for these three checks and any moment where the next step, evidence or approval state felt unclear. There is no need to repeat the already accepted five-minute avatar-expiry test unless a new issue appears. Broader voice identity and pose matching remain deferred product refinements.

## Remaining closeout

After integrated acceptance, capture the accepted story and provider fallback, update supported case-study claims, and complete release review/merge/tag. This pass does not mark evidence capture or the entire demo track complete.
