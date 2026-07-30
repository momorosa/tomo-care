import test from "node:test"
import assert from "node:assert/strict"
import {
    answerAssistantQuestion,
    AssistantServiceError,
} from "./assistantService.js"

test("uses one shared planning, trusted-context, and composition flow", async () => {
    const calls = []
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "When was Momo’s last Librela shot?",
        dependencies: {
            currentCareDate: "2026-07-30",
            buildPlan(question, options) {
                calls.push({ step: "plan", question, options })
                return { intent: "last_librela_injection" }
            },
            async buildContext(petId) {
                calls.push({ step: "context", petId })
                return { trustedEvents: [{ id: "event-1" }] }
            },
            composeAnswer(input) {
                calls.push({ step: "compose", input })
                return {
                    answer_type: "grounded_answer",
                    answer: "June 10.",
                    citations: [{ type: "trusted_event", id: "event-1" }],
                }
            },
        },
    })

    assert.equal(result.answer, "June 10.")
    assert.deepEqual(
        calls.map((call) => call.step),
        ["plan", "context", "compose"]
    )
    assert.equal(calls[2].input.actionPreparation, null)
    assert.equal(calls[2].input.messageDraftPreparation, null)
})

test("prepares a governed action without approving or executing it", async () => {
    let prepareCalls = 0
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "I gave Simparica today.",
        dependencies: {
            currentCareDate: "2026-07-30",
            actionRepository: {},
            buildPlan: () => ({
                intent: "home_medication_given_action",
            }),
            buildContext: async () => ({ reminders: [] }),
            prepareMedicationAction: async () => {
                prepareCalls += 1
                return {
                    answerType: "action_prepared",
                    proposedAction: {
                        id: "action-1",
                        status: "proposed",
                    },
                }
            },
            composeAnswer: ({ actionPreparation }) => ({
                answer_type: "action_prepared",
                answer: "Ready for review.",
                proposed_action: actionPreparation.proposedAction,
            }),
        },
    })

    assert.equal(prepareCalls, 1)
    assert.equal(result.proposed_action.status, "proposed")
    assert.equal("approval" in result, false)
    assert.equal("execution" in result, false)
})

test("preserves the read-only evaluation action boundary", async () => {
    await assert.rejects(
        () =>
            answerAssistantQuestion({
                petId: "pet-1",
                question: "I gave Simparica today.",
                evaluationMode: "read_only",
                dependencies: {
                    currentCareDate: "2026-07-30",
                    buildPlan: () => ({
                        intent: "home_medication_given_action",
                    }),
                },
            }),
        (err) =>
            err instanceof AssistantServiceError &&
            err.status === 409 &&
            err.reason === "read_only_eval_action_blocked"
    )
})