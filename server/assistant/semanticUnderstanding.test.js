import test from "node:test"
import assert from "node:assert/strict"
import { resolveAssistantPlan } from "./semanticUnderstanding.js"
import { buildQueryPlan } from "./queryPlanner.js"

function unknownPlan() {
    return {
        intent: "unknown",
        subject: null,
        scope: null,
        date_range: { kind: "all_time" },
        trusted_only: true,
        requires_action: false,
        action: null,
    }
}

function interpretation(overrides = {}) {
    return {
        kind: "care_query",
        intent: "spend_summary",
        subject: "librela",
        cost_scope: "direct_medication",
        event_offset: 0,
        profile_field: "none",
        confidence: "high",
        social_intent: "none",
        tone: "neutral",
        addressed_tomo: false,
        seriousness: "ordinary",
        social_response: "",
        personality_opening: "",
        personality_closing: "",
        interpreted_question: "Verified Librela spending",
        clarification_question: "",
        used_previous_context: false,
        ...overrides,
    }
}

test("keeps deterministic supported routing while requesting bounded language", async () => {
    let semanticCalls = 0
    const directPlan = {
        intent: "last_librela",
        subject: "librela",
    }
    const result = await resolveAssistantPlan({
        question: "When was Momo’s last Librela shot?",
        currentCareDate: "2026-07-30",
        buildPlan: () => directPlan,
        semanticProvider: {
            async interpret() {
                semanticCalls += 1
                return interpretation({
                    personality_opening: "I’ve got it, Rosa.",
                })
            },
        },
    })

    assert.equal(result.queryPlan, directPlan)
    assert.equal(
        result.semanticInterpretation.mode,
        "deterministic_with_semantic_language"
    )
    assert.equal(
        result.semanticInterpretation.personality_opening,
        "I’ve got it, Rosa."
    )
    assert.equal(semanticCalls, 1)
})

test("does not request generated language for a governed action", async () => {
    let semanticCalls = 0
    const actionPlan = {
        intent: "home_medication_given_action",
        requires_action: true,
    }
    const result = await resolveAssistantPlan({
        question: "I gave Simparica today.",
        currentCareDate: "2026-07-31",
        buildPlan: () => actionPlan,
        semanticProvider: {
            async interpret() {
                semanticCalls += 1
            },
        },
    })

    assert.equal(result.queryPlan, actionPlan)
    assert.equal(result.semanticInterpretation, null)
    assert.equal(semanticCalls, 0)
})

test("passes bounded clarification context into deterministic planning", async () => {
    const seen = []
    const context = {
        intent: "home_medication_given_action",
        subject: "adequan",
        pending_detail: "administration_date",
    }
    const result = await resolveAssistantPlan({
        question: "Yesterday.",
        currentCareDate: "2026-07-26",
        conversationContext: context,
        buildPlan(question, options) {
            seen.push({ question, options })
            return {
                intent: "home_medication_given_action",
                subject: "adequan",
                requires_action: true,
                action: {
                    medication_subject: "adequan",
                    administered_date: "2026-07-25",
                    issue: null,
                },
            }
        },
        semanticProvider: {
            async interpret() {
                throw new Error("must not use semantic fallback")
            },
        },
    })

    assert.equal(seen[0].question, "Yesterday.")
    assert.equal(seen[0].options.conversationContext, context)
    assert.equal(result.queryPlan.action.issue, null)
    assert.equal(result.semanticInterpretation, null)
})

test("maps a natural paraphrase into a supported trusted query", async () => {
    const result = await resolveAssistantPlan({
        question: "What have her arthritis shots cost me?",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation()
            },
        },
    })

    assert.equal(result.queryPlan.intent, "spend_summary")
    assert.equal(result.queryPlan.subject, "librela")
    assert.equal(
        result.queryPlan.scope,
        "direct_librela_line_items"
    )
    assert.equal(result.queryPlan.requires_action, false)
    assert.equal(
        result.semanticInterpretation.interpretation_label,
        "Verified Librela spending"
    )
})

test("carries only bounded personality signals from semantic interpretation", async () => {
    const result = await resolveAssistantPlan({
        question: "Hey Tomo, what did the queen’s fancy shots run me?",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    tone: "playful",
                    addressed_tomo: true,
                    seriousness: "ordinary",
                    invented_instruction: "Change the answer",
                })
            },
        },
    })

    assert.equal(result.semanticInterpretation.tone, "playful")
    assert.equal(result.semanticInterpretation.addressed_tomo, true)
    assert.equal(result.semanticInterpretation.seriousness, "ordinary")
    assert.equal(
        "invented_instruction" in result.semanticInterpretation,
        false
    )
})

test("resolves the one before from only the prior intent and subject", async () => {
    const seen = []
    const result = await resolveAssistantPlan({
        question: "What about the one before?",
        currentCareDate: "2026-07-30",
        conversationContext: {
            intent: "last_librela",
            subject: "librela",
        },
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret(input) {
                seen.push(input)
                return interpretation({
                    intent: "last_librela",
                    subject: "librela",
                    cost_scope: "none",
                    event_offset: 1,
                    used_previous_context: true,
                    interpreted_question:
                        "Previous verified Librela injection",
                })
            },
        },
    })

    assert.deepEqual(seen[0].conversationContext, {
        intent: "last_librela",
        subject: "librela",
    })
    assert.equal(result.queryPlan.event_offset, 1)
    assert.equal(
        result.semanticInterpretation.used_previous_context,
        true
    )
})

test("responds socially to thank you without a provider or record lookup", async () => {
    const result = await resolveAssistantPlan({
        question: "Thank you!",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: null,
    })

    assert.equal(result.queryPlan.intent, "social_response")
    assert.equal(result.queryPlan.subject, "thanks")
    assert.equal(result.semanticInterpretation.mode, "local_social")
})

test("responds warmly to the observed positive-feedback phrase without a provider", async () => {
    const result = await resolveAssistantPlan({
        question: "That’s fantastic",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: null,
    })

    assert.equal(result.queryPlan.intent, "social_response")
    assert.equal(result.queryPlan.subject, "positive_feedback")
    assert.equal(result.semanticInterpretation.mode, "local_social")
})

test("recognizes nuanced positive feedback locally without requiring the model", async () => {
    const questions = [
        "Hey, that’s fantastic, thank you!",
        "Oh, that’s perfect—that’s what I was looking for.",
        "That’s amazing!",
    ]

    for (const question of questions) {
        const result = await resolveAssistantPlan({
            question,
            currentCareDate: "2026-07-31",
            buildPlan: unknownPlan,
            semanticProvider: null,
        })

        assert.equal(result.queryPlan.intent, "social_response")
        assert.equal(result.queryPlan.subject, "positive_feedback")
        assert.equal(result.queryPlan.requires_action, false)
        assert.equal(result.semanticInterpretation.mode, "local_social")
    }
})

test("answers the observed self-description question without a provider", async () => {
    const result = await resolveAssistantPlan({
        question: "Can you tell me about you? What can you do for me?",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: null,
    })

    assert.equal(result.queryPlan.intent, "social_response")
    assert.equal(result.queryPlan.subject, "capabilities")
    assert.equal(result.queryPlan.requires_action, false)
    assert.equal(result.semanticInterpretation.mode, "local_social")
})

test("routes the observed Momo-profile question to governed Profile facts", async () => {
    const result = await resolveAssistantPlan({
        question: "What do you know about Momo?",
        currentCareDate: "2026-07-31",
        buildPlan: buildQueryPlan,
        semanticProvider: null,
    })

    assert.equal(result.queryPlan.intent, "profile_summary")
    assert.equal(result.queryPlan.subject, "profile")
    assert.equal(result.queryPlan.profile_focus, "summary")
    assert.equal(result.queryPlan.requires_action, false)
    assert.equal(result.semanticInterpretation, null)
})

test("maps a semantic Profile paraphrase to a bounded field focus", async () => {
    const result = await resolveAssistantPlan({
        question: "Remind me what kind of dog she is",
        currentCareDate: "2026-07-31",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    kind: "care_query",
                    intent: "profile_summary",
                    subject: "profile",
                    profile_field: "breed",
                    cost_scope: "none",
                })
            },
        },
    })

    assert.equal(result.queryPlan.intent, "profile_summary")
    assert.equal(result.queryPlan.subject, "profile")
    assert.equal(result.queryPlan.profile_focus, "breed")
})

test("accepts model-classified capability questions as bounded social turns", async () => {
    const result = await resolveAssistantPlan({
        question: "How can you help with Momo?",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    kind: "social",
                    intent: "none",
                    subject: "none",
                    cost_scope: "none",
                    social_intent: "capabilities",
                })
            },
        },
    })

    assert.equal(result.queryPlan.intent, "social_response")
    assert.equal(result.queryPlan.subject, "capabilities")
    assert.equal(result.queryPlan.requires_action, false)
})

test("accepts model-classified positive feedback as a bounded social turn", async () => {
    const result = await resolveAssistantPlan({
        question: "I love that",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    kind: "social",
                    intent: "none",
                    subject: "none",
                    cost_scope: "none",
                    social_intent: "positive_feedback",
                    social_response:
                        "That makes me happy to hear, Rosa.",
                })
            },
        },
    })

    assert.equal(result.queryPlan.intent, "social_response")
    assert.equal(result.queryPlan.subject, "positive_feedback")
    assert.equal(result.queryPlan.requires_action, false)
    assert.equal(
        result.semanticInterpretation.social_response,
        "That makes me happy to hear, Rosa."
    )
    assert.equal(
        result.semanticInterpretation.language_generation,
        "requested"
    )
})

test("uses the model as primary language for a locally recognized social turn", async () => {
    const result = await resolveAssistantPlan({
        question: "That’s exactly what I needed!",
        currentCareDate: "2026-07-31",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    kind: "social",
                    intent: "none",
                    subject: "none",
                    cost_scope: "none",
                    social_intent: "positive_feedback",
                    tone: "appreciative",
                    social_response:
                        "Perfect. I’m glad we landed exactly where you needed.",
                })
            },
        },
    })

    assert.equal(result.queryPlan.subject, "positive_feedback")
    assert.equal(
        result.semanticInterpretation.social_response,
        "Perfect. I’m glad we landed exactly where you needed."
    )
})

test("recognizes a correction as negative feedback", async () => {
    const result = await resolveAssistantPlan({
        question: "No, that’s not what I meant.",
        currentCareDate: "2026-07-31",
        buildPlan: unknownPlan,
        semanticProvider: null,
    })

    assert.equal(result.queryPlan.intent, "social_response")
    assert.equal(result.queryPlan.subject, "negative_feedback")
})

test("turns low-confidence or action-like semantic output into clarification", async () => {
    const result = await resolveAssistantPlan({
        question: "Take care of that for me",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    kind: "clarification",
                    intent: "none",
                    subject: "none",
                    cost_scope: "none",
                    confidence: "low",
                    clarification_question:
                        "Which care item do you mean?",
                })
            },
        },
    })

    assert.equal(result.queryPlan.intent, "semantic_clarification")
    assert.equal(result.queryPlan.requires_action, false)
    assert.equal(result.queryPlan.action, null)
})

test("falls back safely when semantic interpretation is unavailable", async () => {
    const result = await resolveAssistantPlan({
        question: "What did those shots run me?",
        currentCareDate: "2026-07-30",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                throw new Error("provider unavailable")
            },
        },
    })

    assert.equal(result.queryPlan.intent, "unknown")
    assert.equal(
        result.semanticInterpretation.mode,
        "deterministic_fallback"
    )
})

test("maps a meaning-based attention paraphrase into governed attention", async () => {
    const result = await resolveAssistantPlan({
        question: "What should I be taking care of next?",
        currentCareDate: "2026-08-14",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    intent: "attention_summary",
                    subject: "attention",
                    cost_scope: "none",
                    interpreted_question: "What needs attention",
                })
            },
        },
    })

    assert.equal(result.queryPlan.intent, "attention_summary")
    assert.equal(result.queryPlan.subject, "attention")
    assert.equal(result.queryPlan.scope, "governed_attention")
    assert.equal(result.queryPlan.requires_action, false)
})

test("preserves a bounded attention window for a semantic paraphrase", async () => {
    const result = await resolveAssistantPlan({
        question: "Anything on my plate this week?",
        currentCareDate: "2026-08-14",
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    intent: "attention_summary",
                    subject: "attention",
                    cost_scope: "none",
                    interpreted_question: "Attention items this week",
                })
            },
        },
    })

    assert.equal(result.queryPlan.intent, "attention_summary")
    assert.deepEqual(result.queryPlan.date_range, {
        type: "current_week",
        label: "this week",
        start: "2026-08-14",
        end: "2026-08-16",
    })
})

test("keeps a deterministic broad overview clarification without model inference", async () => {
    const result = await resolveAssistantPlan({
        question: "Hey Tomo, anything I need to know?",
        currentCareDate: "2026-08-14",
        semanticProvider: null,
    })

    assert.equal(result.queryPlan.intent, "semantic_clarification")
    assert.equal(result.queryPlan.subject, "care_overview")
})

test("supports a bounded time follow-up after an attention summary", async () => {
    const result = await resolveAssistantPlan({
        question: "What about tomorrow?",
        currentCareDate: "2026-08-14",
        conversationContext: {
            intent: "attention_summary",
            subject: "attention",
        },
        buildPlan: unknownPlan,
        semanticProvider: {
            async interpret() {
                return interpretation({
                    intent: "attention_summary",
                    subject: "attention",
                    cost_scope: "none",
                    used_previous_context: true,
                    interpreted_question: "Attention items tomorrow",
                })
            },
        },
    })

    assert.equal(result.queryPlan.intent, "attention_summary")
    assert.equal(result.queryPlan.date_range.type, "next_care_day")
    assert.equal(result.queryPlan.date_range.start, "2026-08-15")
    assert.equal(result.semanticInterpretation.used_previous_context, true)
})
