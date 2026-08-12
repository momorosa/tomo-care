import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const actionsUrl = new URL("../routes/actions.js", import.meta.url)
const documentsUrl = new URL("../routes/documents.js", import.meta.url)

test("historical recovery requires a current preview token", async () => {
    const source = await readFile(actionsUrl, "utf8")
    const route = source.slice(
        source.indexOf("// POST /api/documents/:docId/actions/weight-materialization"),
        source.indexOf("// GET /api/documents/:docId/actions/librela-reconciliation-preview")
    )

    assert.match(route, /previewToken/)
    assert.match(route, /reason: "preview_required"/)
    assert.match(route, /plan\.preview_token !== previewToken/)
    assert.match(route, /materializeVerifiedWeight/)
    assert.doesNotMatch(route, /getGoogleCalendarService/)
})

test("normal verification only materializes a structured reviewed measurement", async () => {
    const source = await readFile(documentsUrl, "utf8")
    const approveRoute = source.slice(
        source.indexOf('router.post("/documents/:docId/approve"'),
        source.indexOf("// Update candidate truth")
    )

    assert.match(approveRoute, /allowRawText: false/)
    assert.match(approveRoute, /materialize_verified_weight_measurement/)
    assert.match(approveRoute, /p_verified_by: verifiedBy/)
})
