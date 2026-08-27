import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    getVerificationRecoveryPresentation,
    shouldOfferVerificationRecheck,
} from "./verificationRecoveryPresentation.js"

test("offers manual AI recheck only for an unverified saved candidate", () => {
    assert.equal(
        shouldOfferVerificationRecheck({
            hasCandidateData: true,
        }),
        true
    )
    assert.equal(
        shouldOfferVerificationRecheck({
            isVerified: true,
            hasCandidateData: true,
        }),
        false
    )
    assert.equal(
        shouldOfferVerificationRecheck({
            editMode: true,
            hasCandidateData: true,
        }),
        false
    )
    assert.equal(
        shouldOfferVerificationRecheck({
            hasCandidateData: true,
            recovery: { mode: "manual_review" },
        }),
        false
    )
    assert.equal(shouldOfferVerificationRecheck(), false)
})

test("explains exactly what a source timeout saved and did not approve", () => {
    const presentation = getVerificationRecoveryPresentation({
        triageResult: {
            fail_safe: true,
            source_review: {
                reason: "timeout",
                retryable: true,
            },
        },
    })

    assert.equal(presentation.mode, "manual_review")
    assert.equal(presentation.title, "AI comparison took too long")
    assert.match(presentation.message, /PDF, source text, and extracted fields are saved/i)
    assert.match(presentation.message, /Nothing has been approved/i)
    assert.match(presentation.message, /trusted record/i)
    assert.equal(presentation.retryable, true)
    assert.equal(presentation.manualReviewAvailable, true)
    assert.equal(presentation.reviewLaterAvailable, true)
})

test("keeps a hard handoff failure retryable without claiming manual approval is ready", () => {
    const presentation = getVerificationRecoveryPresentation({
        triageFailure: {
            reason: "timeout",
            retryable: true,
        },
    })

    assert.equal(presentation.mode, "retry_required")
    assert.equal(presentation.retryable, true)
    assert.equal(presentation.manualReviewAvailable, false)
    assert.match(presentation.message, /No review was approved/i)
})

test("wires retry, manual review, and review-later controls into Verify Docs", async () => {
    const workingPanelUrl = new URL("./WorkingPanel.jsx", import.meta.url)
    const verifyDocsUrl = new URL("./VerifyDocs.jsx", import.meta.url)
    const triageHookUrl = new URL("./hooks/useTriage.js", import.meta.url)
    const [workingPanel, verifyDocs, triageHook] = await Promise.all([
        readFile(workingPanelUrl, "utf8"),
        readFile(verifyDocsUrl, "utf8"),
        readFile(triageHookUrl, "utf8"),
    ])

    assert.match(workingPanel, /Retry AI review/)
    assert.match(workingPanel, /Recheck with AI/)
    assert.match(workingPanel, /AI review running…/)
    assert.match(
        workingPanel,
        /does\s+not approve or add anything to trusted/
    )
    assert.match(workingPanel, /Continue with manual review/)
    assert.match(workingPanel, /Review later/)
    assert.match(verifyDocs, /onRetryReview=\{retryVerificationReview\}/)
    assert.match(verifyDocs, /onReviewLater=\{reviewLater\}/)
    assert.match(triageHook, /setTriageFailure\(/)
    assert.doesNotMatch(triageHook, /catch \(e\)[\s\S]{0,180}setTriageResult\(null\)/)
})
