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