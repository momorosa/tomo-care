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
            orchestrationRepository: {},
            buildPlan: () => ({
                intent: "home_medication_given_action",
            }),
            buildContext: async () => ({ reminders: [] }),
            coordinateCareOperations: async () => {
                prepareCalls += 1
                return {
                    actionPreparation: {
                        answerType: "action_prepared",
                        proposedAction: {
                            id: "action-1",
                            status: "proposed",
                        },
                    },
                    orchestrationTrace: { run_id: "run-1" },
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

test("carries an Adequan clarification through medication and date follow-ups", async () => {
    const reminder = {
        id: "adequan-reminder",
        doc_id: null,
        event_date: "2026-08-17",
        status: "planned",
    }
    const dependencies = {
        currentCareDate: "2026-08-18",
        semanticProvider: null,
        actionRepository: {},
        orchestrationRepository: {},
        buildContext: async () => ({
            homeMedicationAdministrationEvents: [],
            homeMedicationReminders: [reminder],
            verifiedEvents: [],
            plannedReminders: [reminder],
            documents: [],
        }),
        coordinateCareOperations: async ({ queryPlan }) => {
            if (queryPlan.action.issue) {
                return {
                    actionPreparation: {
                        status: queryPlan.action.issue,
                        displayName:
                            queryPlan.subject === "adequan"
                                ? "Adequan"
                                : "home medication",
                    },
                    orchestrationTrace: { run_id: "clarification-run" },
                }
            }

            return {
                actionPreparation: {
                    status: "prepared",
                    displayName: "Adequan",
                    administeredDate:
                        queryPlan.action.administered_date,
                    disposition: "created",
                    action: {
                        id: "adequan-action",
                        status: "proposed",
                    },
                    reminder,
                },
                orchestrationTrace: { run_id: "prepared-run" },
            }
        },
    }

    const uncertain = await answerAssistantQuestion({
        petId: "pet-1",
        question: "I may have given Momo Adequan yesterday.",
        dependencies,
    })
    const medication = await answerAssistantQuestion({
        petId: "pet-1",
        question: "I gave Momo Adequan.",
        conversationContext: uncertain.conversation_context,
        dependencies,
    })
    const date = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Yesterday.",
        conversationContext: medication.conversation_context,
        dependencies,
    })

    assert.equal(uncertain.answer_type, "clarification_needed")
    assert.match(
        uncertain.answer,
        /not completely sure whether Momo received Adequan on August 17, 2026/
    )
    assert.match(
        uncertain.answer,
        /I won’t prepare an update while you’re uncertain/
    )
    assert.equal(uncertain.conversation_context, null)
    assert.equal(medication.answer_type, "clarification_needed")
    assert.match(
        medication.answer,
        /Got it—what day did you give Momo Adequan/
    )
    assert.deepEqual(medication.conversation_context, {
        intent: "home_medication_given_action",
        subject: "adequan",
        pending_detail: "administration_date",
    })
    assert.equal(date.query_plan.intent, "home_medication_given_action")
    assert.equal(date.query_plan.action.administered_date, "2026-08-17")
    assert.equal(date.answer_type, "action_prepared")
    assert.equal(date.proposed_action.id, "adequan-action")
    assert.equal(date.conversation_context, null)
})

test("keeps clarification specific when orchestration returns no preparation metadata", async () => {
    const dependencies = {
        currentCareDate: "2026-08-18",
        semanticProvider: null,
        actionRepository: {},
        orchestrationRepository: {},
        buildContext: async () => ({
            homeMedicationAdministrationEvents: [],
            homeMedicationReminders: [],
            verifiedEvents: [],
            plannedReminders: [],
            documents: [],
        }),
        coordinateCareOperations: async () => ({
            status: "recovered",
            actionPreparation: null,
            orchestrationTrace: {
                result_status: "clarification_required",
                recovered: true,
            },
        }),
    }

    const uncertain = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Hey Tomo, I may have given Momo Adequan yesterday.",
        dependencies,
    })
    const missingDate = await answerAssistantQuestion({
        petId: "pet-1",
        question: "I gave Momo Adequan.",
        dependencies,
    })

    assert.match(
        uncertain.answer,
        /not completely sure whether Momo received Adequan on August 17, 2026/
    )
    assert.doesNotMatch(
        uncertain.answer,
        /couldn’t safely prepare/
    )
    assert.match(
        missingDate.answer,
        /Got it—what day did you give Momo Adequan/
    )
    assert.doesNotMatch(
        missingDate.answer,
        /couldn’t safely prepare/
    )
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

test("answers a social turn without loading trusted care records", async () => {
    let contextCalls = 0
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Thank you!",
        conversationContext: {
            intent: "last_librela",
            subject: "librela",
        },
        dependencies: {
            currentCareDate: "2026-07-30",
            buildPlan: () => ({
                intent: "unknown",
                date_range: { kind: "all_time" },
            }),
            buildContext: async () => {
                contextCalls += 1
                return {}
            },
            semanticProvider: null,
        },
    })

    assert.equal(contextCalls, 0)
    assert.equal(result.answer_type, "social_response")
    assert.match(result.answer, /Rosa|happy to help/)
    assert.deepEqual(result.citations, [])
    assert.deepEqual(result.conversation_context, {
        intent: "last_librela",
        subject: "librela",
    })
})

test("returns wording-sensitive positive feedback without loading care records", async () => {
    let contextCalls = 0
    const questions = [
        "Hey, that’s fantastic, thank you!",
        "Oh, that’s perfect—that’s what I was looking for.",
    ]
    const results = []

    for (const question of questions) {
        results.push(
            await answerAssistantQuestion({
                petId: "pet-1",
                question,
                dependencies: {
                    currentCareDate: "2026-07-31",
                    semanticProvider: null,
                    buildContext: async () => {
                        contextCalls += 1
                        return {}
                    },
                },
            })
        )
    }

    assert.equal(contextCalls, 0)
    assert.notEqual(results[0].answer, results[1].answer)
    for (const result of results) {
        assert.equal(result.answer_type, "social_response")
        assert.deepEqual(result.citations, [])
        assert.equal(result.proposed_action, null)
    }
})

test("uses generated language as the primary response for harmless social feedback", async () => {
    let contextCalls = 0
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "That’s exactly what I needed!",
        dependencies: {
            currentCareDate: "2026-07-31",
            semanticProvider: {
                async interpret() {
                    return {
                        kind: "social",
                        social_intent: "positive_feedback",
                        confidence: "high",
                        tone: "appreciative",
                        addressed_tomo: false,
                        seriousness: "ordinary",
                        social_response:
                            "Perfect. I’m glad we landed exactly where you needed.",
                        personality_opening: "",
                        personality_closing: "",
                    }
                },
            },
            buildContext: async () => {
                contextCalls += 1
                return {}
            },
        },
    })

    assert.equal(contextCalls, 0)
    assert.equal(
        result.answer,
        "Perfect. I’m glad we landed exactly where you needed."
    )
    assert.equal(result.personality.generated_language, "social_response")
    assert.deepEqual(result.citations, [])
    assert.equal(result.proposed_action, null)
})

test("keeps the deterministic factual body unchanged inside generated framing", async () => {
    const factualAnswer =
        "Momo’s verified direct Librela spend in 2026 is $349.20."
    const citations = [{ type: "cost_item", id: "cost-1" }]
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Hey Tomo, what did Queen Momo’s shots cost in 2026?",
        dependencies: {
            currentCareDate: "2026-07-31",
            buildPlan: () => ({
                intent: "spend_summary",
                subject: "librela",
                requires_action: false,
            }),
            semanticProvider: {
                async interpret() {
                    return {
                        confidence: "high",
                        tone: "playful",
                        addressed_tomo: true,
                        seriousness: "ordinary",
                        social_response: "",
                        personality_opening:
                            "Her Majesty has my full attention.",
                        personality_closing: "",
                    }
                },
            },
            buildContext: async () => ({}),
            composeAnswer: () => ({
                answer_type: "grounded_answer",
                answer: factualAnswer,
                citations,
                limitations: ["Direct medication line items only."],
                proposed_action: null,
            }),
        },
    })

    assert.equal(
        result.answer,
        `Her Majesty has my full attention. ${factualAnswer}`
    )
    assert.ok(result.answer.includes(factualAnswer))
    assert.equal(result.citations, citations)
    assert.deepEqual(result.limitations, [
        "Direct medication line items only.",
    ])
    assert.equal(result.proposed_action, null)
})

test("answers Tomo’s self-description without loading trusted care records", async () => {
    let contextCalls = 0
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Can you tell me about you? What can you do for me?",
        dependencies: {
            currentCareDate: "2026-07-31",
            semanticProvider: null,
            buildContext: async () => {
                contextCalls += 1
                return {}
            },
        },
    })

    assert.equal(contextCalls, 0)
    assert.equal(result.answer_type, "social_response")
    assert.match(result.answer, /I’m Tomo—your sidekick for Momo’s care/)
    assert.deepEqual(result.citations, [])
})

test("answers the observed Momo-profile question from only the governed profile source", async () => {
    let contextCalls = 0
    let profileCalls = 0
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "What do you know about Momo?",
        dependencies: {
            currentCareDate: "2026-07-31",
            semanticProvider: null,
            buildContext: async () => {
                contextCalls += 1
                return {}
            },
            profileRepository: {},
            buildProfile: async ({ petId, currentCareDate }) => {
                profileCalls += 1
                assert.equal(petId, "pet-1")
                assert.equal(currentCareDate, "2026-07-31")
                return {
                    status: "available",
                    fields: {
                        id: "pet-1",
                        name: "Momo",
                        species: "canine",
                        breed: "American Eskimo",
                        birth_date: "2014-08-22",
                        age: 11,
                        sex: "female",
                        reproductive_status: "spayed",
                    },
                    missing_fields: [],
                    governing_reference: {
                        table: "pets",
                        record_id: "pet-1",
                    },
                    navigation_targets: [],
                }
            },
        },
    })

    assert.equal(contextCalls, 0)
    assert.equal(profileCalls, 1)
    assert.equal(result.answer_type, "profile_summary")
    assert.match(result.governed_answer, /American Eskimo/)
    assert.deepEqual(result.citations, [])
})

test("answers the observed last-Simparica question from verified history without preparing an action", async () => {
    let prepareCalls = 0
    const administration = {
        id: "simparica-administration",
        doc_id: null,
        event_type: "medication_administration",
        event_date: "2026-07-26",
        status: "verified",
        details_json: {
            care_item: "Simparica Trio",
            medication: "Simparica Trio",
        },
    }
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Hey Tomo, when was the last time I gave Momo Simparica?",
        dependencies: {
            currentCareDate: "2026-07-31",
            semanticProvider: null,
            actionRepository: {},
            orchestrationRepository: {},
            buildContext: async () => ({
                homeMedicationAdministrationEvents: [administration],
                homeMedicationReminders: [],
                verifiedEvents: [administration],
                plannedReminders: [],
                documents: [],
            }),
            prepareMedicationAction: async () => {
                prepareCalls += 1
            },
            coordinateCareOperations: async () => ({
                actionPreparation: null,
                orchestrationTrace: { run_id: "run-status" },
            }),
        },
    })

    assert.equal(prepareCalls, 0)
    assert.equal(result.query_plan.intent, "home_medication_status")
    assert.match(result.answer, /July 26, 2026/)
    assert.equal(result.proposed_action, null)
})

test("answers the observed Adequan calendar wording from the planned reminder", async () => {
    const reminder = {
        id: "adequan-reminder",
        doc_id: null,
        event_type: "reminder",
        event_date: "2026-08-30",
        status: "planned",
        details_json: {
            care_item: "Adequan",
            medication: "Adequan",
            target_admin_date: "2026-08-31",
            due_date: "2026-08-31",
        },
    }
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Is Adequan on my calendar?",
        dependencies: {
            currentCareDate: "2026-07-31",
            semanticProvider: null,
            actionRepository: {},
            orchestrationRepository: {},
            buildContext: async () => ({
                homeMedicationAdministrationEvents: [],
                homeMedicationReminders: [reminder],
                verifiedEvents: [],
                plannedReminders: [reminder],
                documents: [],
            }),
            coordinateCareOperations: async () => ({
                actionPreparation: null,
                orchestrationTrace: { run_id: "run-due" },
            }),
        },
    })

    assert.equal(result.query_plan.intent, "home_medication_due")
    assert.match(result.answer, /Adequan has a target administration date/)
    assert.match(result.answer, /planned reminder is set for August 30, 2026/)
    assert.equal(result.proposed_action, null)
})

test("answers the observed August calendar wording with a strict month scope", async () => {
    const reminder = (id, eventDate, detailsJson) => ({
        id,
        doc_id: null,
        event_type: "reminder",
        event_date: eventDate,
        status: "planned",
        details_json: detailsJson,
    })
    const reminders = [
        reminder("librela", "2026-07-22", { subtype: "Librela" }),
        reminder("simparica", "2026-08-16", {
            care_item: "Simparica Trio",
        }),
        reminder("adequan", "2026-08-30", { care_item: "Adequan" }),
    ]
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Is anything on my calendar for August?",
        dependencies: {
            currentCareDate: "2026-07-31",
            semanticProvider: null,
            buildContext: async () => ({
                plannedReminders: reminders,
            }),
        },
    })

    assert.equal(result.query_plan.date_range.type, "calendar_month")
    assert.match(result.answer, /2 active planned reminders in August 2026/)
    assert.match(result.answer, /Separately, there is 1 earlier active reminder/)
    assert.deepEqual(
        result.citations.map((citation) => citation.id),
        ["simparica", "adequan", "librela"]
    )
})

test("adds relationship framing after composition without changing evidence", async () => {
    const citations = [{ type: "cost_item", id: "cost-1" }]
    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question:
            "Hey Tomo, how much has Queen Momo’s luxury wellness program cost in 2026?",
        dependencies: {
            currentCareDate: "2026-07-30",
            buildPlan: () => ({
                intent: "spend_summary",
                subject: "librela",
                requires_action: false,
            }),
            buildContext: async () => ({}),
            composeAnswer: () => ({
                answer_type: "grounded_answer",
                answer: "Verified spend is $349.20.",
                citations,
                proposed_action: null,
            }),
        },
    })

    assert.match(result.answer, /royal|Majesty/i)
    assert.ok(result.answer.endsWith("Verified spend is $349.20."))
    assert.equal(result.personality.mode, "relational")
    assert.equal(result.personality.framing_applied, true)
    assert.equal(result.citations, citations)
    assert.equal(result.proposed_action, null)
})

test("builds attention from governed sources without loading broad trusted context", async () => {
    let contextCalls = 0
    const repository = { name: "attention repository" }
    const summary = {
        status: "available",
        items: [{ id: "care_action:action-1" }],
        total_qualifying_count: 1,
        sources: [],
    }
    let buildInput = null

    const result = await answerAssistantQuestion({
        petId: "pet-1",
        question: "Tomo, what needs my attention?",
        dependencies: {
            currentCareDate: "2026-08-14",
            semanticProvider: null,
            attentionRepository: repository,
            buildContext: async () => {
                contextCalls += 1
                return {}
            },
            async buildAttention(input) {
                buildInput = input
                return summary
            },
            composeAnswer(input) {
                assert.equal(input.attentionSummary, summary)
                assert.deepEqual(input.context, {})
                return {
                    answer_type: "attention_summary",
                    answer: "One item needs attention.",
                    attention_items: summary.items,
                    citations: [],
                    proposed_action: null,
                }
            },
        },
    })

    assert.equal(contextCalls, 0)
    assert.deepEqual(buildInput, {
        repository,
        petId: "pet-1",
        currentCareDate: "2026-08-14",
        dateRange: {
            type: "all_time",
            label: "current attention",
            start: null,
            end: null,
        },
    })
    assert.equal(result.answer_type, "attention_summary")
    assert.deepEqual(result.attention_items, summary.items)
})
