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

test("dirty save reruns review and requires a separate explicit verification", async () => {
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
    const preservationIndex = page.indexOf(
        "preserveUnchangedAcceptedPaths({"
    )
    const correctionStart = page.indexOf("async function saveAndRecheck()")
    const correctionEnd = page.indexOf("async function retryVerificationReview()", correctionStart)
    assert.ok(correctionStart >= 0 && correctionEnd > correctionStart)
    const correctionHandler = page.slice(correctionStart, correctionEnd)

    assert.ok(patchIndex >= 0)
    assert.ok(forcedReviewIndex > patchIndex)
    assert.ok(preservationIndex > forcedReviewIndex)
    assert.doesNotMatch(correctionHandler, /approveDoc\(|approveDocument\(/)
    assert.match(correctionHandler, /status: "needs_review"/)
    assert.match(page, /acceptedPaths: preservedAcceptedPaths/)
    assert.match(panel, /Save correction &amp; recheck/)
})
