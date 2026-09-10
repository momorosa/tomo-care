import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const verifyDocsUrl = new URL("./VerifyDocs.jsx", import.meta.url)
const workingPanelUrl = new URL("./WorkingPanel.jsx", import.meta.url)
const verifyHeaderUrl = new URL("./VerifyHeader.jsx", import.meta.url)
const postVerifyModalUrl = new URL(
    "./PostVerifyActionsModal.jsx",
    import.meta.url
)

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker)
    const end = source.indexOf(endMarker, start)

    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`)
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`)

    return source.slice(start, end)
}

test("saving a correction rechecks candidate truth without approving it", async () => {
    const source = await readFile(verifyDocsUrl, "utf8")
    const saveAndRecheck = sourceBetween(
        source,
        "async function saveAndRecheck()",
        "async function retryVerificationReview()"
    )

    assert.match(saveAndRecheck, /api\.patchExtracted/)
    assert.match(saveAndRecheck, /triage\.runTriage/)
    assert.match(saveAndRecheck, /ready to verify/)
    assert.doesNotMatch(saveAndRecheck, /approveDoc/)
    assert.doesNotMatch(saveAndRecheck, /openPostVerifyActions/)
})

test("attention cards lead directly to a focused correction", async () => {
    const source = await readFile(workingPanelUrl, "utf8")

    assert.match(source, /conflict_or_uncertainty: "Needs correction"/)
    assert.match(source, /onCorrectField\?\.\(f\.path\)/)
    assert.match(source, />\s*Keep as shown\s*</)
    assert.match(source, /shrink-0 whitespace-nowrap/)
    assert.match(source, /text-sm font-semibold text-tomo-accent break-words/)
    assert.match(source, /hover:border-tomo-accent\/70/)
    assert.doesNotMatch(source, /Select this card to correct the field/)
    assert.doesNotMatch(source, />\s*Correct\s*</)
    assert.match(source, /Update \{displayReviewLabel\(editTargetPath\)\}/)
    assert.match(source, /focusOnMount=\{editTargetPath === "invoice_id"\}/)
    assert.match(source, /saving will recheck,\s*not verify/)
})

test("verification remains a separate explicit action", async () => {
    const source = await readFile(verifyHeaderUrl, "utf8")

    assert.match(source, /Verify and add to care record/)
    assert.match(source, /before verifying/)
    assert.doesNotMatch(source, /Approve & save record/)
})

test("verified documents show confirmation before optional next steps", async () => {
    const source = await readFile(postVerifyModalUrl, "utf8")

    assert.match(source, /if \(!open\) return null/)
    assert.match(source, /return <OpenPostVerifyActionsModal \{\.\.\.props\} \/>/)
    assert.match(source, /useState\("confirmation"\)/)
    assert.doesNotMatch(source, /useEffect/)
    assert.match(source, /if \(step === "confirmation"\)/)
    assert.match(source, /Added to Momo’s trusted care record/)
    assert.match(source, /No reminders or follow-up/)
    assert.match(source, /Continue to next steps/)
    assert.match(source, /setStep\("actions"\)/)
    assert.match(source, /Choose what TomoCare should help with next/)
})
