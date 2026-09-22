# Isolated demo Calendar — September 22, 2026

Status: implementation and local checks complete; dedicated-calendar setup and live Google acceptance are pending. This is the next approved slice after Rosa accepted the database-read validation. No Calendar or care-data writes were performed during implementation.

## Product boundary

One explicit **Add to demo calendar** action on the September synthetic invoice’s Librela reminder. The destination must be a dedicated secondary calendar named **TomoCare Demo — Synthetic Data**. The event is `[DEMO] Momo — Librela reminder`, October 19, 2026, 9:00–9:30 AM America/Los_Angeles; it notes the October 26 expected due date. It is a reminder, not an appointment booking. No clinic is contacted.

Events use fictional-data descriptions, private visibility, free availability, no attendees, and no event alerts. Calendar controls for other demo reminder types and generic Calendar navigation remain unavailable. Real-care Calendar behavior and the review-only appointment draft are unchanged.

## Setup checkpoint

The existing app OAuth connection was verified with a metadata-only read: its primary calendar is `tomomomo.care@gmail.com`. The signed-in Chrome accounts and the Calendar connector currently use different accounts. **Sign the TomoCare account into Google Calendar before continuing setup.** No credentials or permissions have been changed.

Then:

1. Create the secondary calendar with the exact name above, a clearly distinct color, and a synthetic-only description. Keep it private. Use Google Calendar’s UI so the app does not need broader OAuth permissions to create calendars.
2. Copy its Calendar ID from its settings. Add only `DEMO_GCAL_CALENDAR_ID=<exact-secondary-calendar-id>` to local `.env.demo`; never commit that file. Keep `GCAL_CALENDAR_ID` unchanged.
3. Verify that the existing app connection can read the new destination’s name. Restart the demo API so it loads the new local setting.
4. Complete the live checks below. Until configured, the UI hides the demo Calendar action and direct requests fail closed.

## Safety and replay

- A separate server route handles demo Calendar writes. It validates the exact demo project and pet, secondary-calendar ID, and the destination’s exact name. `primary`, personal email IDs, and the configured real-care destination are rejected. The old generic Calendar route remains blocked in demo mode.
- The server reloads the reminder and verified source. Only the manifest-owned September invoice, its verified September 7 Librela evidence, and the corresponding planned October reminder qualify. Expired timing is rejected.
- Event identity is deterministic for the scenario, source and internal reminder. A retry, lost response, or failed database link save reconnects the same event. Existing entries must carry the expected ownership metadata and ID. Unexpected ownership, guests, recurrence, changed title, or missing version information stops the action.
- Google updates/deletes use the event version to reject concurrent changes. Saving the link also checks the reminder’s database version, avoiding overwriting a newer reminder state.
- `demo:reset` first finds and removes only Calendar entries bearing this scenario’s exact ownership metadata. This includes an entry whose database link save failed. It validates the full selection before deletion and never clears or deletes the calendar. Provider cleanup failure stops reset before storage or database deletion; retry the reset after recovery. A partial external cleanup can occur before a provider failure, but source data is retained.
- A new reset/reverification cycle creates a fresh internal reminder and therefore a fresh Calendar event ID. This avoids reusing Google’s deleted-event IDs. Same-cycle retries retain their original ID.
- Keep the demo calendar setting in place until cleanup completes. A missing/mismatched setting with stored Calendar references blocks reset. If the local setting is removed after a lost database save, restore that same destination setting before reset so its orphan can be found.
- Deleting or repurposing an entry manually is not silently undone. A deleted entry requires the normal demo reset/reverification path; manually repurposed entries require review before cleanup.

## Verification performed

- 269 affected automated checks passed, including 21 new Calendar checks: exact identity/destination guards, unverified evidence, timing, quiet/free event payload, duplicate and conflict recovery, ownership protection, provider errors, cleanup and reset ordering, partial database failure, and UI labels.
- Focused ESLint and production build passed. The pre-existing LiveKit bundle-size warning remains.
- The current live synthetic source/reminder passed payload validation in a read-only check.
- The shipped reminder component was exercised in a local fixture at a narrow drawer width: explicit click, success link, expanded confirmation, failure and retry. The fixture makes no provider/database writes.
- **Not yet verified:** actual creation/update/deletion in the new Google calendar, live app-to-Google link, and real reset/replay cleanup. No full dataset reset was performed.

## Rosa’s minimum checks after setup

1. In **Demo data → Reminders**, see **Add to demo calendar** on Librela, with “Synthetic calendar · no alerts.” Click once, then open the resulting event. Confirm the dedicated calendar, `[DEMO]` title, October 19 date, no notifications, no guests, and **Free** availability. The description must say no appointment was booked.
2. Refresh TomoCare. The same reminder should show **Open demo calendar event**, and Google should contain only one entry for this reminder.
3. During the next planned full fresh-source rehearsal, stop the servers and run the documented demo reset. Confirm the prior demo Calendar entry is removed while real-care entries remain. Verify the synthetic invoice and create the Librela reminder again; adding it should produce one fresh demo entry. A reset also changes the baseline totals/history as documented in the Journey checkpoint; do not reset solely for the first two checks.

Local fixture: `/tests/browser/demo-calendar-fixtures.html`. Focused checks: `npm run test:demo-calendar`.

## Provider references

[Google Calendar event fields](https://developers.google.com/workspace/calendar/api/v3/reference/events), [private ownership properties](https://developers.google.com/workspace/calendar/api/guides/extended-properties), and [Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth).
