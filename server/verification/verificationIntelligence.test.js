import assert from "node:assert/strict"
import test from "node:test"

import {
    buildCorrectionHistory,
    buildStaleAssessment,
    buildVerificationAssessment,
    getCandidateFingerprint,
    isCurrentVerificationAssessment,
    REVIEW_OUTCOMES,
    validateVerificationApproval,
} from "./verificationIntelligence.js"
import {
    buildMatchingSourceReview,
    FICTIONAL_CURRENT_DOCUMENT,
    FICTIONAL_CURRENT_EXTRACTED,
    FICTIONAL_CURRENT_RAW_TEXT,
    FICTIONAL_TRUSTED_HISTORY,
} from "./fixtures/fictionalCedarInvoice.js"

function clone(value) {
    return structuredClone(value)
}

function buildAssessment(overrides = {}) {
    const extracted = overrides.extracted || clone(FICTIONAL_CURRENT_EXTRACTED)
    return buildVerificationAssessment({
        rawText: overrides.rawText || FICTIONAL_CURRENT_RAW_TEXT,
        extracted,
        document: FICTIONAL_CURRENT_DOCUMENT,
        history: overrides.history || clone(FICTIONAL_TRUSTED_HISTORY),
        sourceReview:
            overrides.sourceReview || buildMatchingSourceReview(extracted),
        sourceReviewFailed: overrides.sourceReviewFailed || false,
        createdAt: "2026-08-16T18:00:00.000Z",
        model: "fixture-source-reviewer",
    })
}

test("groups established costs, matching dates, arithmetic, and stable weight", () => {
    const assessment = buildAssessment()
    const outcomes = new Map(
        assessment.fields.map((field) => [field.path, field])
    )

    assert.equal(assessment.history.comparable_record_count, 5)
    assert.equal(
        outcomes.get("checks.date_consistency").outcome,
        REVIEW_OUTCOMES.CONSISTENT
    )
    assert.equal(
        outcomes.get("checks.invoice_arithmetic").outcome,
        REVIEW_OUTCOMES.CONSISTENT
    )
    assert.equal(
        outcomes.get("checks.weight_comparison").outcome,
        REVIEW_OUTCOMES.CONSISTENT
    )
    assert.equal(
        outcomes.get("patterns.cost_items[0]").outcome,
        REVIEW_OUTCOMES.CONSISTENT
    )
    assert.equal(
        outcomes.get("patterns.cost_items[2]").extracted_value.label,
        "Librela 10 mg/ml Solution Vial"
    )
    assert.doesNotMatch(
        outcomes.get("patterns.cost_items[2]").reason,
        /administered dose/i
    )
    assert.equal(assessment.summary.blocking_count, 0)
})

test("surfaces a changed recurring fee with the established verified value", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    extracted.cost_items[0].amount = 49
    extracted.totals.paid = 165.4

    const assessment = buildAssessment({ extracted })
    const changed = assessment.fields.find(
        (field) => field.path === "cost_items[0].amount"
    )

    assert.equal(changed.outcome, REVIEW_OUTCOMES.CHANGED)
    assert.equal(changed.blocks_approval, true)
    assert.match(changed.reason, /\$49\.00 now/i)
    assert.match(changed.reason, /\$44\.00 across the last three/i)
})

test("treats fewer than three comparable visits as limited history", () => {
    const assessment = buildAssessment({
        history: clone(FICTIONAL_TRUSTED_HISTORY).slice(0, 2),
    })
    const nurseVisit = assessment.fields.find(
        (field) => field.path === "cost_items[0].label"
    )

    assert.equal(nurseVisit.outcome, REVIEW_OUTCOMES.LIMITED)
    assert.equal(nurseVisit.blocks_approval, false)
})

test("does not skip a recent missing line item to manufacture a pattern", () => {
    const history = clone(FICTIONAL_TRUSTED_HISTORY)
    history[1].cost_items = history[1].cost_items.filter(
        (item) => item.item_name !== "Nurse Office Visit"
    )

    const assessment = buildAssessment({ history })
    const nurseVisit = assessment.fields.find(
        (field) => field.path === "cost_items[0].label"
    )

    assert.equal(nurseVisit.outcome, REVIEW_OUTCOMES.LIMITED)
})

test("surfaces a new line item after three comparable verified visits", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    extracted.cost_items.push({
        service_date: "2026-08-16",
        category: "other",
        label: "New handling fee",
        amount: 5,
        currency: "USD",
    })
    extracted.totals.paid = 165.4

    const assessment = buildAssessment({ extracted })
    const changed = assessment.fields.find(
        (field) => field.path === "cost_items[4].label"
    )

    assert.equal(changed.outcome, REVIEW_OUTCOMES.CHANGED)
    assert.equal(changed.blocks_approval, true)
    assert.match(changed.reason, /new compared with the last three/i)
})

test("unclear current amount blocks even when history is limited", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    const sourceReview = buildMatchingSourceReview(extracted)
    sourceReview.fields.find(
        (field) => field.path === "cost_items[0].amount"
    ).state = "uncertain"

    const assessment = buildAssessment({
        extracted,
        history: clone(FICTIONAL_TRUSTED_HISTORY).slice(0, 1),
        sourceReview,
    })
    const amount = assessment.fields.find(
        (field) => field.path === "cost_items[0].amount"
    )

    assert.equal(amount.outcome, REVIEW_OUTCOMES.CONFLICT)
    assert.equal(amount.blocks_approval, true)
})

test("keeps a missing paid total separate from calculated line-item arithmetic", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    delete extracted.totals.paid

    const assessment = buildAssessment({ extracted })
    const arithmetic = assessment.fields.find(
        (field) => field.path === "checks.invoice_arithmetic"
    )

    assert.equal(arithmetic.outcome, REVIEW_OUTCOMES.LIMITED)
    assert.deepEqual(arithmetic.extracted_value, {
        calculated_line_total: 160.4,
        source_paid_total: null,
    })
    assert.match(arithmetic.reason, /did not fill it in automatically/i)
})

test("does not invent an invoice arithmetic problem for a non-financial document", () => {
    const extracted = {
        doc_type: "visit_note",
        doc_date: "2026-08-16",
        summary: "Fictional visit note.",
        events: [],
        labs: [],
    }
    const assessment = buildAssessment({
        extracted,
        history: [],
        rawText:
            "SAMPLE — DEMO DATA\nVisit date: 08/16/2026\nFictional visit note without charges.",
    })

    assert.equal(
        assessment.fields.some(
            (field) => field.path === "checks.invoice_arithmetic"
        ),
        false
    )
})

test("blocks an arithmetic contradiction beyond the one-cent tolerance", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    extracted.totals.paid = 161

    const assessment = buildAssessment({ extracted })
    const arithmetic = assessment.fields.find(
        (field) => field.path === "checks.invoice_arithmetic"
    )

    assert.equal(arithmetic.outcome, REVIEW_OUTCOMES.CONFLICT)
    assert.equal(arithmetic.blocks_approval, true)
})

test("allows a one-cent invoice rounding difference", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    extracted.totals.paid = 160.41

    const assessment = buildAssessment({ extracted })
    const arithmetic = assessment.fields.find(
        (field) => field.path === "checks.invoice_arithmetic"
    )

    assert.equal(arithmetic.outcome, REVIEW_OUTCOMES.CONSISTENT)
    assert.equal(arithmetic.blocks_approval, false)
})

test("groups matching dates once and blocks a contradictory line-item date", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    extracted.cost_items[2].service_date = "2026-08-15"

    const assessment = buildAssessment({ extracted })
    const dateCheck = assessment.fields.find(
        (field) => field.path === "checks.date_consistency"
    )

    assert.equal(dateCheck.outcome, REVIEW_OUTCOMES.CONFLICT)
    assert.equal(dateCheck.blocks_approval, true)
    assert.match(dateCheck.reason, /invoice and line-item dates differ/i)
    assert.equal(
        assessment.fields.some(
            (field) => field.path === "cost_items[2].service_date"
        ),
        false
    )
})

test("raises the five-percent weight threshold without making a medical claim", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    extracted.weight_measurement.value = 14.3

    const assessment = buildAssessment({ extracted })
    const weight = assessment.fields.find(
        (field) => field.path === "checks.weight_comparison"
    )

    assert.equal(weight.outcome, REVIEW_OUTCOMES.CHANGED)
    assert.equal(weight.blocks_approval, true)
    assert.match(weight.reason, /review threshold, not a medical conclusion/i)
})

test("acknowledges vaccine, annual-wellness, and lab sections without capture", () => {
    const assessment = buildAssessment()
    const unsupported = assessment.fields
        .filter((field) => field.outcome === REVIEW_OUTCOMES.NOT_CAPTURED)
        .map((field) => field.path)

    assert.deepEqual(unsupported, [
        "unsupported.rabies_evidence",
        "unsupported.annual_wellness",
        "unsupported.labs",
    ])
    assert.equal(
        assessment.fields
            .filter((field) => unsupported.includes(field.path))
            .every((field) => field.blocks_approval === false),
        true
    )
})

test("source-review failure makes every candidate field a manual review", () => {
    const assessment = buildAssessment({
        sourceReview: {
            failed: true,
            fields: [],
            failure: {
                reason: "timeout",
                retryable: true,
                elapsed_ms: 45000,
            },
        },
        sourceReviewFailed: true,
    })
    const candidateFields = assessment.fields.filter(
        (field) => field.outcome === REVIEW_OUTCOMES.MANUAL
    )

    assert.equal(assessment.fail_safe, true)
    assert.deepEqual(assessment.source_review, {
        status: "manual_review",
        reason: "timeout",
        retryable: true,
        elapsed_ms: 45000,
    })
    assert.ok(candidateFields.length > 10)
    assert.equal(candidateFields.every((field) => field.blocks_approval), true)
})

test("candidate fingerprint is stable across object key order", () => {
    assert.equal(
        getCandidateFingerprint({ b: 2, a: { d: 4, c: 3 } }),
        getCandidateFingerprint({ a: { c: 3, d: 4 }, b: 2 })
    )
})

test("backend approval requires the current fingerprint and every blocking item", () => {
    const extracted = clone(FICTIONAL_CURRENT_EXTRACTED)
    extracted.cost_items[0].amount = 49
    extracted.totals.paid = 165.4
    const assessment = buildAssessment({ extracted })
    const changedPath = "cost_items[0].amount"

    const unresolved = validateVerificationApproval({
        assessment,
        extracted,
        candidateFingerprint: assessment.candidate_fingerprint,
        acceptedPaths: [],
    })
    assert.equal(unresolved.ok, false)
    assert.equal(unresolved.reason, "review_required")
    assert.ok(unresolved.unresolved_paths.includes(changedPath))

    const approved = validateVerificationApproval({
        assessment,
        extracted,
        candidateFingerprint: assessment.candidate_fingerprint,
        acceptedPaths: unresolved.unresolved_paths,
    })
    assert.equal(approved.ok, true)

    extracted.summary = "Edited after review"
    const stale = validateVerificationApproval({
        assessment,
        extracted,
        candidateFingerprint: assessment.candidate_fingerprint,
        acceptedPaths: unresolved.unresolved_paths,
    })
    assert.equal(stale.ok, false)
    assert.equal(stale.reason, "assessment_required")
})

test("candidate edits invalidate assessment and retain bounded correction history", () => {
    const previous = clone(FICTIONAL_CURRENT_EXTRACTED)
    const next = clone(previous)
    next.cost_items[0].amount = 49
    const assessment = buildAssessment({ extracted: previous })

    const correctionHistory = buildCorrectionHistory({
        previousExtracted: previous,
        nextExtracted: next,
        changedAt: "2026-08-16T19:00:00.000Z",
    })
    assert.equal(correctionHistory.length, 1)
    assert.deepEqual(correctionHistory[0].changes[0], {
        path: "cost_items[0].amount",
        previous_value: 44,
        next_value: 49,
    })

    const stale = buildStaleAssessment({
        previousAssessment: assessment,
        previousExtracted: previous,
        nextExtracted: next,
        changedAt: "2026-08-16T19:00:00.000Z",
    })
    assert.equal(stale.status, "stale")
    assert.equal(isCurrentVerificationAssessment(stale, next), false)
    assert.equal(stale.correction_history.length, 1)
})
