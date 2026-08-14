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
