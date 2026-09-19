import test from "node:test"
import assert from "node:assert/strict"
import { answerAssistantQuestion } from "./assistantService.js"

for (const runtimeMode of ["demo", "real"]) {
    test(`${runtimeMode}: social semantics reach the shared character without reading care data`, async () => {
        const question = "You deserve a corner office, tiny chief of staff."
        const answer = "With a sunbeam, please."
        const result = await answerAssistantQuestion({
            petId: "fixture-pet", question,
            dependencies: {
                runtimeMode,
                semanticProvider: { interpret: async (input) => {
                    assert.equal(input.question, question)
                    return {
                        kind: "social", social_intent: "positive_feedback", confidence: "high",
                        tone: "playful", seriousness: "ordinary", social_response: answer,
                    }
                } },
                buildContext: async () => { throw new Error("Social replies must not read care data") },
            },
        })
        assert.equal(result.answer, answer)
        assert.equal(result.personality.expression, "amused")
        assert.deepEqual(result.citations, [])
        assert.equal(result.proposed_action, null)
    })

    test(`${runtimeMode}: a thankful care question keeps missing-evidence language`, async () => {
        const result = await answerAssistantQuestion({
            petId: "fixture-pet", question: "Thanks, what was Momo's last weight?",
            dependencies: {
                runtimeMode, buildContext: async () => ({}),
                semanticProvider: { interpret: async () => ({
                    kind: "care_query", intent: "last_weight", subject: "weight", confidence: "high",
                    tone: "appreciative", seriousness: "ordinary",
                    personality_opening: "Momo is perfectly healthy.",
                }) },
            },
        })
        assert.equal(result.answer_type, "no_trusted_data")
        assert.match(result.answer, /don’t have a verified weight/)
        assert.equal(result.personality.mode, "restrained")
        assert.equal(result.personality.expression, "attentive")
        assert.doesNotMatch(result.answer, /healthy/)
        assert.equal(result.proposed_action, null)
    })
}

test("an unavailable semantic provider stays honest rather than guessing a celebratory reaction", async () => {
    const result = await answerAssistantQuestion({
        petId: "fixture-pet", question: "You deserve a corner office.",
        dependencies: {
            runtimeMode: "demo", buildContext: async () => ({}),
            semanticProvider: { interpret: async () => { throw new Error("Unavailable") } },
        },
    })
    assert.equal(result.semantic_interpretation.status, "unavailable")
    assert.equal(result.answer_type, "unsupported_question")
    assert.equal(result.personality.expression, "attentive")
})
