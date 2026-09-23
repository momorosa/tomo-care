# Isolated demo Calendar — September 22, 2026

Status: implementation, dedicated-calendar setup and live integration checks complete on September 22, 2026. Rosa’s visual acceptance and the planned receipt-only replay/reverification rehearsal remain. The live check created one synthetic Calendar entry and saved its link on the existing demo reminder; no real-care records or calendars were changed.

## Product boundary

One explicit **Add to demo calendar** action on the September synthetic invoice’s Librela reminder. The destination must be a dedicated secondary calendar named **TomoCare Demo — Synthetic Data**. The event is `[DEMO] Momo — Librela reminder`, October 19, 2026, 9:00–9:30 AM America/Los_Angeles; it notes the October 26 expected due date. It is a reminder, not an appointment booking. No clinic is contacted.

Events use fictional-data descriptions, private visibility, free availability, no attendees, and no event alerts. Calendar controls for other demo reminder types and generic Calendar navigation remain unavailable. Real-care Calendar behavior and the review-only appointment draft are unchanged.

## Setup checkpoint

The existing app OAuth connection belongs to `tomomomo.care@gmail.com` and retains only its existing `calendar.events` scope. Rosa confirmed this account was already signed into a separate **Tomo** Chrome profile. Setup used that profile’s Google Calendar UI; no new sign-in, credentials or broader permissions were needed. The secondary calendar is private, orange (distinct from the blue care calendar), and has no default event or email notifications. Its exact ID is saved only in ignored local `.env.demo`; the care calendar setting is unchanged.

Open TomoCare and its Google Calendar links in the **Tomo Chrome profile**. A link opened from Rosa’s other Chrome profile may use that profile’s different Google account. This is browser account context, not a Calendar authorization failure.

For setup on another machine:

1. Create the secondary calendar with the exact name above, a clearly distinct color, and a synthetic-only description. Keep it private. Use Google Calendar’s UI so the app does not need broader OAuth permissions to create calendars.
2. Copy its Calendar ID from its settings. Add only `DEMO_GCAL_CALENDAR_ID=<exact-secondary-calendar-id>` to local `.env.demo`; never commit that file. Keep `GCAL_CALENDAR_ID` unchanged.
3. Verify that the existing app connection can read the new destination’s name. Restart the demo API so it loads the new local setting.
4. Complete the live checks below. Until configured, the UI hides the demo Calendar action and direct requests fail closed.

## Safety and replay

- A separate server route handles demo Calendar writes. It validates the exact demo project and pet, secondary-calendar ID, and the destination’s exact name. `primary`, personal email IDs, and the configured real-care destination are rejected. The old generic Calendar route remains blocked in demo mode.
- The server reloads the reminder and verified source. Only the manifest-owned September invoice, its verified September 7 Librela evidence, and the corresponding planned October reminder qualify. Expired timing is rejected.
- Event identity is deterministic for the scenario, source and internal reminder. A retry, lost response, or failed database link save reconnects the same event. Existing entries must carry the expected ownership metadata and ID. Unexpected ownership, guests, recurrence, changed title, or missing version information stops the action.
- Google updates/deletes use the event version to reject concurrent changes. Saving the link also checks the reminder’s database version, avoiding overwriting a newer reminder state.
- Both `demo:reset-receipt --apply` and the full `demo:reset` first find and removes only Calendar entries bearing this scenario’s exact ownership metadata. This includes an entry whose database link save failed. It validates the full selection before deletion and never clears or deletes the calendar. Provider cleanup failure stops reset before storage or database deletion; retry the reset after recovery. A partial external cleanup can occur before a provider failure, but source data is retained.
- A new reset/reverification cycle creates a fresh internal reminder and therefore a fresh Calendar event ID. This avoids reusing Google’s deleted-event IDs. Same-cycle retries retain their original ID.
- Keep the demo calendar setting in place until cleanup completes. A missing/mismatched setting with stored Calendar references blocks reset. If the local setting is removed after a lost database save, restore that same destination setting before reset so its orphan can be found.
- Deleting or repurposing an entry manually is not silently undone. A deleted entry requires the normal demo reset/reverification path; manually repurposed entries require review before cleanup.

## Verification performed

- 269 affected automated checks passed, including 21 new Calendar checks: exact identity/destination guards, unverified evidence, timing, quiet/free event payload, duplicate and conflict recovery, ownership protection, provider errors, cleanup and reset ordering, partial database failure, and UI labels.
- Focused ESLint and production build passed. The pre-existing LiveKit bundle-size warning remains.
- The current live synthetic source/reminder passed payload validation in a read-only check.
- The shipped reminder component was exercised in a local fixture at a narrow drawer width: explicit click, success link, expanded confirmation, failure and retry. The fixture makes no provider/database writes.
- **Live provider check:** created a temporary scenario-owned synthetic entry, retried it, and verified exactly one entry with no attendees or reminders, private visibility and free availability. The production reset’s Calendar-cleanup function then removed that one entry and verified the dedicated calendar was empty. No database reset was performed.
- **Live UI check:** used **Add to demo calendar** on the existing Librela reminder. Confirmed one event on October 19, 2026, 9:00–9:30 AM Pacific; the demo database saved its exact calendar/event references. The link opened the event in the Tomo profile and Google displayed the synthetic notice, dedicated calendar, private visibility and free availability. Refreshing TomoCare preserved **Open demo calendar event**.
- **Still pending:** Rosa’s visual acceptance and the next planned receipt-only replay → invoice verification → reminder recreation rehearsal. The external cleanup portion was tested live independently, preserving the current accepted dataset.

## Rosa’s minimum checks after setup

1. The live check has already added the event. In the **Tomo Chrome profile → Demo data → Reminders**, select **Open demo calendar event** on Librela. Confirm the dedicated calendar, orange color, `[DEMO]` title, October 19 date, no notifications, no guests, and **Free** availability. The description must say no appointment was booked. No reset is needed for this review.
2. Refresh TomoCare. The same reminder should show **Open demo calendar event**, and Google should contain only one entry for this reminder.
3. During the next fresh-source rehearsal, stop the app and avatar worker and use [receipt-only replay](./TomoCare_Demo_Receipt_Replay.md). Confirm the prior demo Calendar entry is removed while real-care entries remain. Verify the synthetic invoice and create the Librela reminder again; adding it should produce one fresh demo entry. Receipt-only replay preserves May/July and unrelated records. The separate full reset changes baseline totals/history; it is not required here.

Local fixture: `/tests/browser/demo-calendar-fixtures.html`. Focused checks: `npm run test:demo-calendar`.

## Provider references

[Google Calendar event fields](https://developers.google.com/workspace/calendar/api/v3/reference/events), [private ownership properties](https://developers.google.com/workspace/calendar/api/guides/extended-properties), and [Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth).
