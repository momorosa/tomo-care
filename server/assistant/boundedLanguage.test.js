import test from "node:test"
import assert from "node:assert/strict"
import {
    getGeneratedFraming,
    getGeneratedSocialResponse,
} from "./boundedLanguage.js"

test("accepts a brief generated response for a harmless social turn", () => {
    const result = getGeneratedSocialResponse({
        queryPlan: {
            intent: "social_response",
            subject: "positive_feedback",
        },
        semanticInterpretation: {
            social_response:
                "That makes me happy to hear, Rosa. We found the right answer together.",
        },
    })

    assert.equal(
        result,
        "That makes me happy to hear, Rosa. We found the right answer together."
    )
})

test("does not replace the deterministic capability response", () => {
    assert.equal(
        getGeneratedSocialResponse({
            queryPlan: { intent: "social_response", subject: "capabilities" },
            semanticInterpretation: {
                social_response: "I can make up a charming answer.",
            },
        }),
        null
    )
})

test("rejects generated language containing facts or completed-action claims", () => {
    const unsafe = [
        "Momo weighs 15.2 kg.",
        "Your appointment is on August 4.",
        "I sent the message for you.",
        "The verified record shows the last dose.",
    ]

    for (const social_response of unsafe) {
        assert.equal(
            getGeneratedSocialResponse({
                queryPlan: {
                    intent: "social_response",
                    subject: "positive_feedback",
                },
                semanticInterpretation: { social_response },
            }),
            null
        )
    }
})

test("accepts one short fact-free frame and rejects it in restrained mode", () => {
    const semanticInterpretation = {
        personality_opening: "Her Majesty has my full attention.",
        personality_closing: "",
    }

    assert.deepEqual(
        getGeneratedFraming({
            semanticInterpretation,
            allowFraming: true,
        }),
        {
            opening: "Her Majesty has my full attention.",
            closing: null,
        }
    )
    assert.deepEqual(
        getGeneratedFraming({
            semanticInterpretation,
            allowFraming: false,
        }),
        { opening: null, closing: null }
    )
})

test("rejects framing that tries to add both an opening and closing", () => {
    assert.deepEqual(
        getGeneratedFraming({
            allowFraming: true,
            semanticInterpretation: {
                personality_opening: "Her Majesty has my attention.",
                personality_closing: "I’m here with you, Rosa.",
            },
        }),
        { opening: null, closing: null }
    )
})

test("rejects overlong or multi-sentence framing", () => {
    const result = getGeneratedFraming({
        allowFraming: true,
        semanticInterpretation: {
            personality_opening:
                "I’m here, Rosa. Let’s make this extra playful.",
            personality_closing: "x".repeat(121),
        },
    })

    assert.deepEqual(result, { opening: null, closing: null })
})
