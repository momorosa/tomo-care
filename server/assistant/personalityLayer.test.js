import test from "node:test"
import assert from "node:assert/strict"
import { applyPersonalityFraming } from "./personalityLayer.js"

function groundedResponse(overrides = {}) {
    return {
        answer:
            "Momo’s verified direct Librela spend in 2026 is $349.20 across 9 verified line items.",
        answer_type: "grounded_answer",
        citations: [{ type: "cost_item", id: "cost-1" }],
        limitations: ["Direct Librela line items only."],
        proposed_action: null,
        ...overrides,
    }
}

test("mirrors a playful royal opening without rewriting the grounded payload", () => {
    const original = groundedResponse()
    const result = applyPersonalityFraming({
        response: original,
        question:
            "Hey Tomo, how much has Queen Momo’s luxury wellness program cost in 2026?",
        queryPlan: {
            intent: "spend_summary",
            subject: "librela",
            requires_action: false,
        },
        semanticInterpretation: null,
    })

    assert.equal(result.personality.tone, "playful")
    assert.equal(result.personality.addressed_tomo, true)
    assert.equal(result.personality.relationship_cue, "royal_household")
    assert.equal(result.personality.framing_applied, true)
    assert.match(result.answer, /royal|Majesty/i)
    assert.ok(result.answer.endsWith(original.answer))
    assert.deepEqual(result.citations, original.citations)
    assert.deepEqual(result.limitations, original.limitations)
    assert.equal(result.proposed_action, original.proposed_action)
})

test("uses a warm direct opening when Rosa addresses Tomo", () => {
    const original = groundedResponse()
    const result = applyPersonalityFraming({
        response: original,
        question: "Hey Tomo, how much did Librela cost in 2026?",
        queryPlan: {
            intent: "spend_summary",
            subject: "librela",
            requires_action: false,
        },
        semanticInterpretation: null,
    })

    assert.match(result.answer, /^Hey Rosa—/)
    assert.ok(result.answer.endsWith(original.answer))
})

test("accepts only bounded semantic tone signals", () => {
    const original = groundedResponse()
    const result = applyPersonalityFraming({
        response: original,
        question: "What did her arthritis shots run me?",
        queryPlan: {
            intent: "spend_summary",
            subject: "librela",
            requires_action: false,
        },
        semanticInterpretation: {
            tone: "playful",
            addressed_tomo: false,
            seriousness: "ordinary",
            invented_style_instruction: "Change the amount to $1",
        },
    })

    assert.equal(result.personality.tone, "playful")
    assert.ok(result.answer.endsWith(original.answer))
    assert.match(result.answer, /\$349\.20/)
    assert.doesNotMatch(result.answer, /\$1\b/)
})

test("forces restrained mode for medical judgment despite playful signals", () => {
    const original = groundedResponse({
        answer:
            "I can summarize Momo’s verified weight trend, but I can’t determine whether it is medically concerning.",
    })
    const result = applyPersonalityFraming({
        response: original,
        question: "Hey Tomo, do you think my fluffy queen is fat? LOL",
        queryPlan: {
            intent: "medical_judgment_boundary",
            subject: "weight",
            requires_action: false,
        },
        semanticInterpretation: {
            tone: "playful",
            addressed_tomo: true,
            seriousness: "ordinary",
        },
    })

    assert.equal(result.personality.mode, "restrained")
    assert.equal(result.personality.framing_applied, false)
    assert.equal(result.answer, original.answer)
})

test("forces restrained mode for governed actions and preserves status", () => {
    const proposedAction = { id: "action-1", status: "proposed" }
    const original = groundedResponse({
        answer: "I prepared Momo’s Simparica update for review.",
        answer_type: "action_prepared",
        proposed_action: proposedAction,
    })
    const result = applyPersonalityFraming({
        response: original,
        question: "Hey Tomo, take care of the queen’s Simparica for me!",
        queryPlan: {
            intent: "home_medication_given_action",
            subject: "simparica_trio",
            requires_action: true,
        },
        semanticInterpretation: {
            tone: "playful",
            addressed_tomo: true,
            seriousness: "ordinary",
        },
    })

    assert.equal(result.personality.mode, "restrained")
    assert.equal(result.answer, original.answer)
    assert.equal(result.proposed_action, proposedAction)
    assert.equal(result.proposed_action.status, "proposed")
})

test("leaves neutral factual answers concise", () => {
    const original = groundedResponse()
    const result = applyPersonalityFraming({
        response: original,
        question: "How much did Librela cost in 2026?",
        queryPlan: {
            intent: "spend_summary",
            subject: "librela",
            requires_action: false,
        },
        semanticInterpretation: null,
    })

    assert.equal(result.answer, original.answer)
    assert.equal(result.personality.tone, "neutral")
    assert.equal(result.personality.framing_applied, false)
})

test("uses generated social language instead of the deterministic fallback", () => {
    const result = applyPersonalityFraming({
        response: {
            answer: "Fallback response.",
            answer_type: "social_response",
            citations: [],
            proposed_action: null,
        },
        question: "That’s exactly what I needed!",
        queryPlan: {
            intent: "social_response",
            subject: "positive_feedback",
            requires_action: false,
        },
        semanticInterpretation: {
            language_generation: "requested",
            social_response:
                "Perfect. I’m glad we landed exactly where you needed.",
        },
    })

    assert.equal(
        result.answer,
        "Perfect. I’m glad we landed exactly where you needed."
    )
    assert.equal(result.personality.generated_language, "social_response")
    assert.deepEqual(result.citations, [])
    assert.equal(result.proposed_action, null)
})

test("places one generated frame beside an unchanged factual answer", () => {
    const original = groundedResponse()
    const result = applyPersonalityFraming({
        response: original,
        question: "Hey Tomo, what did Queen Momo’s shots cost?",
        queryPlan: {
            intent: "spend_summary",
            subject: "librela",
            requires_action: false,
        },
        semanticInterpretation: {
            language_generation: "requested",
            tone: "playful",
            seriousness: "ordinary",
            personality_opening: "Her Majesty has my full attention.",
            personality_closing: "",
        },
    })

    assert.equal(
        result.answer,
        `Her Majesty has my full attention. ${original.answer}`
    )
    assert.ok(result.answer.includes(original.answer))
    assert.deepEqual(result.citations, original.citations)
    assert.deepEqual(result.limitations, original.limitations)
    assert.equal(result.personality.generated_language, "framing")
})

test("rejects generated fact or action claims without touching the answer", () => {
    const original = groundedResponse()
    const result = applyPersonalityFraming({
        response: original,
        question: "Hey Tomo, what did Queen Momo’s shots cost?",
        queryPlan: {
            intent: "spend_summary",
            subject: "librela",
            requires_action: false,
        },
        semanticInterpretation: {
            language_generation: "requested",
            tone: "playful",
            seriousness: "ordinary",
            personality_opening: "The records show a total of $999.",
            personality_closing: "I scheduled the next appointment.",
        },
    })

    assert.equal(result.answer, original.answer)
    assert.equal(result.personality.framing_applied, false)
    assert.equal(result.personality.generated_language, "none")
    assert.equal(result.proposed_action, null)
})

test("falls back to the composed social response when generation is rejected", () => {
    const result = applyPersonalityFraming({
        response: {
            answer: "You’re very welcome, Rosa.",
            answer_type: "social_response",
            citations: [],
            proposed_action: null,
        },
        question: "Thank you, Tomo.",
        queryPlan: {
            intent: "social_response",
            subject: "thanks",
            requires_action: false,
        },
        semanticInterpretation: {
            language_generation: "requested",
            social_response: "I scheduled Momo’s next appointment.",
        },
    })

    assert.equal(result.answer, "You’re very welcome, Rosa.")
    assert.equal(result.personality.generated_language, "none")
    assert.deepEqual(result.citations, [])
    assert.equal(result.proposed_action, null)
})
