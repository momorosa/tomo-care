import assert from "node:assert/strict"
import test from "node:test"

import { getPostVerifyRecommendations } from "./recommendations.js"

function buildInvoice(overrides = {}) {
    return {
        status: "verified",
        doc_type: "invoice",
        title: "Veterinary invoice",
        text_extracted: {
            cost_items: [
                {
                    label: "Office visit",
                    amount: 44,
                },
            ],
        },
        ...overrides,
    }
}

test("uses the server-owned eligible recommendation contract", () => {
    const doc = buildInvoice({
        action_recommendations: {
            librelaReminder: {
                state: "eligible",
                show: true,
                disabled: false,
                recommended: true,
                badge: "Recommended",
                badge_tone: "brand",
                button_label: "Create",
                body: "Verified evidence confirms a Librela injection.",
            },
        },
    })

    const recommendation = getPostVerifyRecommendations(doc).librelaReminder

    assert.deepEqual(recommendation, {
        state: "eligible",
        show: true,
        disabled: false,
        recommended: true,
        badge: "Recommended",
        badgeTone: "brand",
        buttonLabel: "Create",
        body: "Verified evidence confirms a Librela injection.",
    })
})

test("presents a server-owned repair requirement without an action", () => {
    const doc = buildInvoice({
        action_recommendations: {
            librelaReminder: {
                state: "repair_required",
                show: true,
                disabled: true,
                recommended: false,
                badge: "Review required",
                badge_tone: "warning",
                button_label: "Review",
                body: "Verified invoice evidence confirms a Librela injection, but this record needs repair before a reminder can be created.",
            },
        },
    })

    const recommendation = getPostVerifyRecommendations(doc).librelaReminder

    assert.equal(recommendation.state, "repair_required")
    assert.equal(recommendation.disabled, true)
    assert.equal(recommendation.recommended, false)
    assert.equal(recommendation.badge, "Review required")
    assert.equal(recommendation.buttonLabel, "Review")
})

test("a broad client-side Librela mention can only request review", () => {
    const doc = buildInvoice({
        title: "Librela discussion invoice",
        text_extracted: {
            events: [
                {
                    event_type: "appointment",
                    event_date: "2026-08-03",
                    details_json: {
                        description: "Discussed Librela as an option.",
                    },
                },
            ],
            cost_items: [],
        },
    })

    const recommendation = getPostVerifyRecommendations(doc).librelaReminder

    assert.equal(recommendation.state, "review_required")
    assert.equal(recommendation.show, true)
    assert.equal(recommendation.disabled, true)
    assert.equal(recommendation.recommended, false)
    assert.equal(recommendation.badge, "Review required")
})

test("hides Librela when neither the server nor the document identifies it", () => {
    const recommendation = getPostVerifyRecommendations(
        buildInvoice()
    ).librelaReminder

    assert.equal(recommendation.state, "not_applicable")
    assert.equal(recommendation.show, false)
    assert.equal(recommendation.disabled, true)
})

test("preserves the existing insurance recommendation for invoices", () => {
    const recommendation = getPostVerifyRecommendations(
        buildInvoice()
    ).insuranceClaimReminder

    assert.equal(recommendation.show, true)
    assert.equal(recommendation.disabled, false)
    assert.equal(recommendation.recommended, true)
})