import assert from "node:assert/strict"
import test from "node:test"
import { buildFreshAssistantAnswer } from "./assistantAnswerAttention.js"

test("gives every successful assistant response a new attention revision", () => {
    const result = {
        answer_type: "grounded_answer",
        answer: "The governed test is already complete.",
    }

    const firstAnswer = buildFreshAssistantAnswer(
        null,
        "Draft a Librela appointment request.",
        result
    )
    const repeatedAnswer = buildFreshAssistantAnswer(
        firstAnswer,
        "Draft a Librela appointment request.",
        result
    )

    assert.equal(firstAnswer.attention_revision, 1)
    assert.equal(repeatedAnswer.attention_revision, 2)
    assert.equal(repeatedAnswer.answer, result.answer)
})

test("does not allow response data to reuse an earlier attention revision", () => {
    const answer = buildFreshAssistantAnswer(null, "What is due?", {
        answer: "Librela is due.",
        attention_revision: 99,
    })

    assert.equal(answer.attention_revision, 1)
})