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

test("presents the server-owned repair as an explicit review action", () => {
    const doc = buildInvoice({
        action_recommendations: {
            librelaReminder: {
                state: "repair_required",
                show: true,
                disabled: false,
                recommended: false,
                badge: "Repair available",
                badge_tone: "warning",
                button_label: "Review repair",
                body: "Verified invoice evidence confirms a Librela injection, but this record needs repair before a reminder can be created.",
            },
        },
    })

    const recommendation = getPostVerifyRecommendations(doc).librelaReminder

    assert.equal(recommendation.state, "repair_required")
    assert.equal(recommendation.disabled, false)
    assert.equal(recommendation.recommended, false)
    assert.equal(recommendation.badge, "Repair available")
    assert.equal(recommendation.buttonLabel, "Review repair")
})

test("shows an already-reconciled cycle as complete", () => {
    const doc = buildInvoice({
        action_recommendations: {
            librelaReminder: {
                state: "reconciled",
                show: true,
                disabled: true,
                recommended: false,
                badge: "Reconciled",
                badge_tone: "success",
                button_label: "Done",
                body: "The verified injection and next reminder are already reconciled.",
            },
        },
    })

    const recommendation = getPostVerifyRecommendations(doc).librelaReminder

    assert.equal(recommendation.state, "reconciled")
    assert.equal(recommendation.disabled, true)
    assert.equal(recommendation.badge, "Reconciled")
    assert.equal(recommendation.buttonLabel, "Done")
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

test("does not offer an insurance reminder for a vaccination certificate", () => {
    const recommendation = getPostVerifyRecommendations({
        status: "verified",
        doc_type: "vaccination_certificate",
        title: "Rabies vaccination certificate",
        text_extracted: {
            vaccine_evidence: [
                {
                    care_item: "rabies",
                    source_record_type: "vaccination_certificate",
                },
            ],
        },
    }).insuranceClaimReminder

    assert.equal(recommendation.show, false)
    assert.equal(recommendation.disabled, true)
    assert.equal(recommendation.recommended, false)
})

test("uses the server-owned verified-weight recovery recommendation", () => {
    const recommendation = getPostVerifyRecommendations(
        buildInvoice({
            action_recommendations: {
                weightMaterialization: {
                    state: "repair_available",
                    show: true,
                    disabled: false,
                    badge: "Weight available",
                    badge_tone: "warning",
                    button_label: "Review weight",
                    body: "Review this measurement before saving it.",
                },
            },
        })
    ).weightMaterialization

    assert.equal(recommendation.state, "repair_available")
    assert.equal(recommendation.show, true)
    assert.equal(recommendation.disabled, false)
    assert.equal(recommendation.buttonLabel, "Review weight")
})
