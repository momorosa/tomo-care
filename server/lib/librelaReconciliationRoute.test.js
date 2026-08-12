import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const routeUrl = new URL("../routes/actions.js", import.meta.url)

test("requires a current preview token before invoking the repair RPC", async () => {
    const source = await readFile(routeUrl, "utf8")
    const repairRoute = source.slice(
        source.indexOf("// POST /api/documents/:docId/actions/librela-reconciliation"),
        source.indexOf("// POST /api/documents/:docId/actions/librela-reminder")
    )

    assert.match(repairRoute, /previewToken/)
    assert.match(repairRoute, /reason: "preview_required"/)
    assert.match(repairRoute, /plan\.preview_token !== previewToken/)
    assert.match(repairRoute, /reconcileLibrelaCycle/)
})

test("keeps Calendar outside the repair route", async () => {
    const source = await readFile(routeUrl, "utf8")
    const repairRoute = source.slice(
        source.indexOf("// POST /api/documents/:docId/actions/librela-reconciliation"),
        source.indexOf("// POST /api/documents/:docId/actions/librela-reminder")
    )

    assert.doesNotMatch(repairRoute, /syncReminderToGoogleCalendar/)
    assert.doesNotMatch(repairRoute, /getGoogleCalendarService/)
    assert.match(repairRoute, /intentionally does not call Calendar/)
})
