# Replay the September demo receipt without resetting history

Use this for the end-to-end screen recording. **May and July stay; no reseeding is needed.** This command does not restore the older full demo baseline.

## What changes

Only the fixed September Harborlight synthetic receipt is replayed:

- Removes its imported document and saved PDF, derived costs/facts/labs/events, and source-linked reminders, appointment drafts, actions and handoffs.
- Removes its owned event from **TomoCare Demo — Synthetic Data**, including an owned entry whose database link save failed. It never clears the calendar itself.
- Preserves May/July visits, all unrelated records, the pet profile, the original Gmail email, and real-care data/calendars.

The current reminder and its Calendar entry disappear when you **apply**. Reverification lets you create a fresh reminder and then add a fresh Calendar entry. Until then, spending/weight answers use the retained May/July records.

## Commands

In the TomoCare repository, stop the running app and avatar worker with **Ctrl+C** in their terminals. Preview first (read-only):

```bash
npm run demo:reset-receipt -- --project-ref gohzjjqsbtwavjuhjdwj
```

When ready to replay, apply that narrow reset:

```bash
npm run demo:reset-receipt -- --project-ref gohzjjqsbtwavjuhjdwj --apply
npm run dev:demo
```

For live animation, open a second terminal in the repository:

```bash
npm run dev:demo:avatar
```

Refresh the app, confirm **Demo data**, and clear the old session transcript before recording. Select **Check inbox**, review the September PDF, correct its missing invoice number from the source (`HVC-DEMO-090726`), save/recheck, then explicitly verify. Create the Librela reminder and select **Add to demo calendar**. Continue the Voice/animation conversation. In the accepted dataset, September verification restores three weights and $416.50 recorded medication spending.

## Safety and recovery

Preview is the default; only `--apply` changes data. Both modes require the exact demo project, runtime and pet identities. The document must match the synthetic fixture ownership. Unexpected ownership or shared draft dependencies stop the operation.

Calendar cleanup must succeed before database or PDF deletion. Keep the demo calendar setting configured until cleanup completes. Cleanup is staged across providers, not one transaction: an error can leave partial scoped cleanup. Keep servers stopped, resolve the reported problem, and rerun the **same receipt-only command**. The document is removed last, and source-linked rows are checked afterward. Do not switch to full reset as an error-recovery shortcut.

## Validation — September 22, 2026

Live read-only preview selected one September document, four cost rows, two facts, two events (the recorded injection and current reminder), two appointment drafts, no labs/actions/handoffs, one saved PDF key, and one owned Calendar event. No reset was applied.

All 47 focused reset, Calendar, Gmail intake and trusted-flow tests passed, and affected JavaScript passed ESLint. Automated coverage verifies default preview, exact ownership boundaries, preservation of unrelated rows, repeat application, partial failure recovery, Calendar failure ordering and Calendar preview without deletion. Integrated receipt replay remains the next manual recording check.

For comparison only: `demo:reset` restores the **full scenario**, including the older baseline. If May/July are missing independently, `npm run demo:seed-history -- --project-ref gohzjjqsbtwavjuhjdwj` adds only those historical fixtures, refusing conflicting existing records. Neither command is needed for this receipt-only replay.
