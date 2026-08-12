import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const actionsUrl = new URL("../routes/actions.js", import.meta.url)

test("Calendar sync reloads the reminder and revalidates fresh timing", async () => {
    const source = await readFile(actionsUrl, "utf8")
    const route = getCalendarRoute(source)

    assert.match(route, /\.eq\("id", eventId\)\s*\.single\(\)/)
    assert.match(route, /resolveReminderTimingState\(event\)/)
    assert.match(route, /CALENDAR_SYNC_ALLOWED_TIMING_STATES\.has\(timingState\)/)
})

test("Calendar sync uses a stable external ID and recovers duplicate inserts", async () => {
    const source = await readFile(actionsUrl, "utf8")
    const route = getCalendarRoute(source)

    assert.match(route, /getStableGoogleCalendarEventId\(event\.id\)/)
    assert.match(route, /calendar\.events\.insert/)
    assert.match(route, /Number\(insertError\?\.code\) !== 409/)
    assert.match(route, /calendar\.events\.update/)
})

test("Calendar sync stores the event-specific URL on the reminder", async () => {
    const source = await readFile(actionsUrl, "utf8")
    const route = getCalendarRoute(source)

    assert.match(route, /google_calendar_event_id: calendarEvent\.id/)
    assert.match(route, /google_calendar_html_link: calendarEvent\.htmlLink/)
    assert.match(route, /calendar_sync_status: "synced"/)
})

test("a synced marker without an external reference can self-repair", async () => {
    const source = await readFile(actionsUrl, "utf8")
    const route = getCalendarRoute(source)

    assert.doesNotMatch(route, /synced_missing_external_ref/)
    assert.match(route, /if \(existingGoogleCalendarEventId\)/)
    assert.match(route, /getStableGoogleCalendarEventId\(event\.id\)/)
})

function getCalendarRoute(source) {
    const start = source.indexOf(
        '// POST /api/events/:eventId/actions/sync-google-calendar'
    )
    const end = source.indexOf('// GET /api/debug/google-calendar', start)

    assert.notEqual(start, -1)
    assert.notEqual(end, -1)

    return source.slice(start, end)
}
