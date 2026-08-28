import test from "node:test"
import assert from "node:assert/strict"
import { composeSpokenAnswer } from "./spokenAnswer.js"
import { TOMO_PERSONALITY_V1 } from "./tomoPersonality.js"

test("keeps spoken answers concise without changing their first grounded facts", () => {
    const spoken = composeSpokenAnswer({
        answer_type: "grounded_answer",
        answer:
            "Momo’s last verified Librela injection was June 10, 2026. Her next reminder is due July 29, 2026. The source was verified from the clinic receipt. More supporting detail is visible below.",
    })

    assert.equal(
        spoken,
        "Momo’s last verified Librela injection was June 10, 2026. Her next reminder is due July 29, 2026."
    )
})

test("does not split verified weight facts at decimal points", () => {
    const spoken = composeSpokenAnswer({
        answer_type: "grounded_answer",
        answer:
            "I can summarize Momo’s verified weight trend, but I can’t determine whether it is medically concerning. Momo’s verified weight changed from 15.4 kg (33.95 lb) on February 17, 2025 to 15.2 kg (33.51 lb) on June 10, 2026, which is down 0.2 kg (0.44 lb). Please confirm clinical significance with her vet.",
    })

    assert.equal(
        spoken,
        "I can summarize Momo’s verified weight trend, but I can’t determine whether it is medically concerning. Momo’s verified weight changed from 15.4 kg (33.95 lb) on February 17, 2025 to 15.2 kg (33.51 lb) on June 10, 2026, which is down 0.2 kg (0.44 lb)."
    )
})

test("speaks the latest verified weight and measured change from the typed trend", () => {
    const spoken = composeSpokenAnswer({
        answer_type: "grounded_answer",
        answer:
            "Let’s see how Queen Momo’s been doing. Momo’s verified weight trend is slightly downward overall. The complete verified comparison remains visible on screen.",
        visualization: {
            schema_version: 1,
            type: "verified_weight_trend",
            unit: "kg",
            points: [
                {
                    fact_id: "weight-first",
                    fact_date: "2025-02-17",
                    value_kg: 15.4,
                    value_lb: 33.95,
                },
                {
                    fact_id: "weight-latest",
                    fact_date: "2026-08-10",
                    value_kg: 15.2,
                    value_lb: 33.51,
                },
            ],
            summary: {
                reading_count: 2,
                first_fact_id: "weight-first",
                latest_fact_id: "weight-latest",
                low_fact_ids: ["weight-latest"],
                high_fact_ids: ["weight-first"],
                overall_change_kg: -0.2,
                overall_direction: "slightly_downward",
            },
        },
    })

    assert.equal(
        spoken,
        "Momo’s latest verified weight is 33.51 pounds as of August 10, 2026. Across 2 verified readings since February 17, 2025, she is down 0.44 pounds overall—a slightly downward trend."
    )
    assert.doesNotMatch(spoken, /Let’s see/)
})

test("speaks one typed weight reading without manufacturing a trend", () => {
    const spoken = composeSpokenAnswer({
        answer_type: "grounded_answer",
        answer: "A longer written answer remains visible on screen.",
        visualization: {
            schema_version: 1,
            type: "verified_weight_trend",
            unit: "kg",
            points: [
                {
                    fact_id: "weight-only",
                    fact_date: "2026-08-10",
                    value_kg: 15.2,
                    value_lb: 33.51,
                },
            ],
            summary: {
                reading_count: 1,
                first_fact_id: "weight-only",
                latest_fact_id: "weight-only",
                low_fact_ids: ["weight-only"],
                high_fact_ids: ["weight-only"],
                overall_change_kg: 0,
                overall_direction: "insufficient_readings",
            },
        },
    })

    assert.equal(
        spoken,
        "Momo’s one verified weight reading is 33.51 pounds as of August 10, 2026. One reading is not enough to establish a weight trend."
    )
})

test("falls back to the written answer when the typed trend is inconsistent", () => {
    const spoken = composeSpokenAnswer({
        answer_type: "grounded_answer",
        answer:
            "The first grounded fact remains available. The second grounded fact remains available. Extra detail stays on screen.",
        visualization: {
            schema_version: 1,
            type: "verified_weight_trend",
            unit: "kg",
            points: [
                {
                    fact_id: "weight-only",
                    fact_date: "2026-08-10",
                    value_kg: 15.2,
                    value_lb: 33.51,
                },
            ],
            summary: {
                reading_count: 2,
                first_fact_id: "weight-only",
                latest_fact_id: "weight-only",
                overall_change_kg: 0,
                overall_direction: "stable",
            },
        },
    })

    assert.equal(
        spoken,
        "The first grounded fact remains available. The second grounded fact remains available."
    )
})

test("keeps numeric dates and common abbreviations inside their sentences", () => {
    const spoken = composeSpokenAnswer({
        answer_type: "grounded_answer",
        answer:
            "Dr. Lee recorded the visit on 6.10.2026. Momo weighed 15.2 kg. A third detail remains visible.",
    })

    assert.equal(
        spoken,
        "Dr. Lee recorded the visit on 6.10.2026. Momo weighed 15.2 kg."
    )
})

test("speaks the complete compact Profile answer including relationship warmth", () => {
    const governedAnswer =
        "Momo is an American Eskimo dog, born August 22, 2014, and is 11 years old. She is female and spayed according to her Profile."
    const relationshipAnswer =
        "Beyond those official details, she’s regal, devoted, discerning, playful, and joyful—and very much your happy place."
    const spoken = composeSpokenAnswer({
        answer_type: "profile_summary",
        answer:
            `Let’s see what Queen Momo has on her Profile. ${governedAnswer} ${relationshipAnswer}`,
        governed_answer: governedAnswer,
    })

    assert.equal(spoken, `${governedAnswer} ${relationshipAnswer}`)
    assert.match(spoken, /happy place/)
    assert.doesNotMatch(spoken, /Let’s see/)
})

test("speaks a direct governed microchip answer without unrelated Profile facts", () => {
    const answer = "Momo’s microchip number is 900215000000001."
    const spoken = composeSpokenAnswer({
        answer_type: "profile_summary",
        profile_focus: "microchip_id",
        answer,
        governed_answer: answer,
    })

    assert.equal(spoken, answer)
    assert.doesNotMatch(spoken, /breed|birthday|spayed|happy place/i)
})

test("does not pull a microchip identifier into broad Profile speech", () => {
    const governedAnswer =
        "Momo is an American Eskimo dog, born August 22, 2014, and is 12 years old. She is female and spayed according to her Profile."
    const spoken = composeSpokenAnswer({
        answer_type: "profile_summary",
        profile_focus: "summary",
        answer: governedAnswer,
        governed_answer: governedAnswer,
        profile_fields: { microchip_id: "900215000000001" },
    })

    assert.equal(spoken, governedAnswer)
    assert.doesNotMatch(spoken, /microchip|900215000000001/i)
})

test("adds the fixed visual-review boundary to prepared actions", () => {
    const spoken = composeSpokenAnswer({
        answer_type: "action_prepared",
        answer: "I prepared Momo’s Simparica update.",
    })

    assert.equal(
        spoken,
        `I prepared Momo’s Simparica update. ${TOMO_PERSONALITY_V1.reviewTransition}`
    )
})

test("does not claim a fact when no grounded answer exists", () => {
    assert.equal(
        composeSpokenAnswer({ answer_type: "unsupported", answer: "" }),
        "I don’t have enough verified information to answer that yet."
    )
})

test("never exceeds the configured speech limit", () => {
    const spoken = composeSpokenAnswer(
        {
            answer_type: "grounded_answer",
            answer: "This sentence is intentionally much longer than the configured limit.",
        },
        { maxCharacters: 24 }
    )

    assert.ok(spoken.length <= 24)
    assert.match(spoken, /…$/)
})

test("ends long attention speech cleanly instead of cutting off after two items", () => {
    const items = ["Simparica Trio", "Adequan", "Librela", "Insurance claim"].map(
        (title, index) => ({
            title,
            reason: `${title} needs review for its governed care status on August ${20 + index}, 2026.`,
        })
    )
    const spoken = composeSpokenAnswer(
        {
            answer_type: "attention_summary",
            answer:
                "This month, four things need your attention. Simparica Trio needs review for its governed care status on August 20, 2026, Adequan needs review for its governed care status on August 21, 2026, Librela needs review for its governed care status on August 22, 2026, and Insurance claim needs review for its governed care status on August 23, 2026.",
            attention_items: items,
        },
        { maxCharacters: 210 }
    )

    assert.ok(spoken.length <= 210)
    assert.match(spoken, /Simparica Trio/)
    assert.match(spoken, /more items are listed on screen\.$/)
    assert.doesNotMatch(spoken, /…$/)
})
