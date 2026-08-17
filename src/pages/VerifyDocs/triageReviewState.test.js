import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    getTriageReviewState,
    isLegacyVerificationReview,
} from "./triageReviewState.js"

const workingPanelUrl = new URL("./WorkingPanel.jsx", import.meta.url)

function assessment(fields, status = "ready") {
    return {
        schema_version: "verification_intelligence_v1",
        status,
        fields,
    }
}

test("only changed, conflicting, and manual outcomes require acceptance", () => {
    const triageResult = assessment([
        {
            path: "consistent",
            outcome: "consistent_pattern",
            blocks_approval: false,
        },
        {
            path: "limited",
            outcome: "new_or_limited_history",
            blocks_approval: false,
        },
        {
            path: "unsupported",
            outcome: "not_captured",
            blocks_approval: false,
        },
        {
            path: "changed",
            outcome: "changed_from_pattern",
            blocks_approval: true,
        },
        {
            path: "conflict",
            outcome: "conflict_or_uncertainty",
            blocks_approval: true,
        },
    ])

    const before = getTriageReviewState({ triageResult })
    assert.equal(before.unreviewedCount, 2)
    assert.equal(before.blocksApprove, true)

    const after = getTriageReviewState({
        triageResult,
        acceptedPaths: new Set(["changed", "conflict"]),
    })
    assert.equal(after.unreviewedCount, 0)
    assert.equal(after.blocksApprove, false)
})

test("missing or stale assessment blocks approval even with no fields", () => {
    assert.equal(getTriageReviewState().blocksApprove, true)
    assert.equal(
        getTriageReviewState({ triageResult: assessment([], "stale") })
            .blocksApprove,
        true
    )
})

test("manual fail-safe review remains blocking until each item is accepted", () => {
    const triageResult = {
        ...assessment([
            {
                path: "invoice_id",
                outcome: "manual_review",
                blocks_approval: true,
            },
        ]),
        fail_safe: true,
    }

    assert.equal(getTriageReviewState({ triageResult }).blocksApprove, true)
    assert.equal(
        getTriageReviewState({
            triageResult,
            acceptedPaths: new Set(["invoice_id"]),
        }).blocksApprove,
        false
    )
})

test("only identifies a verified pre-3E.5 assessment as a legacy review", () => {
    const legacy = {
        overall_confidence: "medium",
        fields: [{ path: "doc_date", state: "needs-confirmation" }],
    }

    assert.equal(
        isLegacyVerificationReview({ triageResult: legacy, isVerified: true }),
        true
    )
    assert.equal(
        isLegacyVerificationReview({ triageResult: legacy, isVerified: false }),
        false
    )
    assert.equal(
        isLegacyVerificationReview({
            triageResult: assessment([]),
            isVerified: true,
        }),
        false
    )
})

test("presents a verified legacy assessment as collapsed historical context", async () => {
    const source = await readFile(workingPanelUrl, "utf8")

    assert.match(source, /Historical review details/)
    assert.match(source, /not a current risk-weighted assessment/)
    assert.match(source, /<details className="group">/)
    assert.match(source, /isLegacyVerificationReview/)
})
