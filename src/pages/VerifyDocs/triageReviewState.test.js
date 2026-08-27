import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    getTriageReviewState,
    isLegacyVerificationReview,
    preserveUnchangedAcceptedPaths,
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

test("preserves accepted fields whose value and review state did not change", () => {
    const shared = {
        path: "summary",
        extracted_value: "Synthetic visit summary",
        outcome: "manual_review",
        blocks_approval: true,
    }
    const previousAssessment = {
        fields: [
            shared,
            {
                path: "source_org",
                extracted_value: "Incorrect sender",
                outcome: "manual_review",
                blocks_approval: true,
            },
        ],
    }
    const nextAssessment = {
        fields: [
            shared,
            {
                path: "source_org",
                extracted_value: "Fictional Veterinary Center",
                outcome: "manual_review",
                blocks_approval: true,
            },
        ],
    }

    const preserved = preserveUnchangedAcceptedPaths({
        previousAssessment,
        nextAssessment,
        acceptedPaths: new Set(["summary", "source_org"]),
    })

    assert.deepEqual([...preserved], ["summary"])
})

test("does not preserve acceptance when a field risk state changes", () => {
    const preserved = preserveUnchangedAcceptedPaths({
        previousAssessment: {
            fields: [
                {
                    path: "summary",
                    extracted_value: "Synthetic visit summary",
                    outcome: "consistent_pattern",
                    blocks_approval: false,
                },
            ],
        },
        nextAssessment: {
            fields: [
                {
                    path: "summary",
                    extracted_value: "Synthetic visit summary",
                    outcome: "conflict_or_uncertainty",
                    blocks_approval: true,
                },
            ],
        },
        acceptedPaths: new Set(["summary"]),
    })

    assert.equal(preserved.size, 0)
})

test("presents a verified legacy assessment as collapsed historical context", async () => {
    const source = await readFile(workingPanelUrl, "utf8")

    assert.match(source, /Historical review details/)
    assert.match(source, /not a current risk-weighted assessment/)
    assert.match(source, /<details className="group">/)
    assert.match(source, /isLegacyVerificationReview/)
})
