import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const documentsRouteUrl = new URL("../routes/documents.js", import.meta.url)
const verifyDocsUrl = new URL(
    "../../src/pages/VerifyDocs/VerifyDocs.jsx",
    import.meta.url
)
const workingPanelUrl = new URL(
    "../../src/pages/VerifyDocs/WorkingPanel.jsx",
    import.meta.url
)

test("document approval enforces assessment fingerprint and accepted blockers", async () => {
    const source = await readFile(documentsRouteUrl, "utf8")

    assert.match(source, /validateVerificationApproval/)
    assert.match(source, /candidateFingerprint/)
    assert.match(source, /acceptedPaths/)
    assert.match(source, /triage_result:\s*buildStaleAssessment/)
    assert.match(source, /verifyUpdate\.eq\("updated_at", doc\.updated_at\)/)
    assert.match(source, /The document changed while it was being verified/)
    assert.match(source, /Verified records must use the governed repair workflow/)
})

test("dirty save reruns review before any promotion attempt", async () => {
    const [page, panel] = await Promise.all([
        readFile(verifyDocsUrl, "utf8"),
        readFile(workingPanelUrl, "utf8"),
    ])

    const patchIndex = page.indexOf(
        "await api.patchExtracted(selectedId, draft.draftExtracted)"
    )
    const forcedReviewIndex = page.indexOf(
        "await triage.runTriage(selectedId, {\n                force: true,"
    )
    const approvalIndex = page.indexOf(
        "await approveDoc({ assessment, acceptedPaths: new Set() })"
    )

    assert.ok(patchIndex >= 0)
    assert.ok(forcedReviewIndex > patchIndex)
    assert.ok(approvalIndex > forcedReviewIndex)
    assert.match(panel, /Save &amp; recheck/)
})
