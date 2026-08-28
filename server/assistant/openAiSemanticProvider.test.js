import test from "node:test"
import assert from "node:assert/strict"
import {
    createOpenAiSemanticProvider,
    DEFAULT_SEMANTIC_MODEL,
    SemanticProviderError,
} from "./openAiSemanticProvider.js"

function semanticResult(overrides = {}) {
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

test("requests a stateless schema-constrained semantic interpretation", async () => {
    const calls = []
    const provider = createOpenAiSemanticProvider({
        apiKey: "test-key",
        fetchImpl: async (url, options) => {
            calls.push({ url, options })
            return new Response(
                JSON.stringify({
                    output_text: JSON.stringify(semanticResult()),
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            )
        },
    })

    const result = await provider.interpret({
        question: "What did her arthritis shots cost?",
        currentCareDate: "2026-07-30",
        conversationContext: null,
    })

    assert.equal(result.intent, "spend_summary")
    assert.equal(calls[0].url, "https://api.openai.com/v1/responses")

    const request = JSON.parse(calls[0].options.body)
    assert.equal(request.model, DEFAULT_SEMANTIC_MODEL)
    assert.equal(request.store, false)
    assert.deepEqual(request.reasoning, { effort: "none" })
    assert.equal(request.text.format.type, "json_schema")
    assert.equal(request.text.format.strict, true)
    assert.ok(
        request.text.format.schema.properties.social_intent.enum.includes(
            "positive_feedback"
        )
    )
    assert.ok(
        request.text.format.schema.properties.intent.enum.includes(
            "attention_summary"
        )
    )
    assert.ok(
        request.text.format.schema.properties.subject.enum.includes(
            "attention"
        )
    )
    assert.ok(
        request.text.format.schema.properties.social_intent.enum.includes(
            "capabilities"
        )
    )
    assert.ok(
        request.text.format.schema.properties.intent.enum.includes(
            "profile_summary"
        )
    )
    assert.ok(
        request.text.format.schema.properties.subject.enum.includes("profile")
    )
    assert.ok(request.text.format.schema.required.includes("profile_field"))
    assert.ok(
        request.text.format.schema.properties.profile_field.enum.includes(
            "microchip_id"
        )
    )
    assert.equal(
        request.text.format.schema.properties.social_intent.enum.includes(
            "momo_profile"
        ),
        false
    )
    assert.ok(
        request.text.format.schema.properties.social_intent.enum.includes(
            "negative_feedback"
        )
    )
    assert.ok(
        request.text.format.schema.properties.tone.enum.includes(
            "playful"
        )
    )
    assert.deepEqual(
        request.text.format.schema.properties.seriousness.enum,
        ["ordinary", "sensitive"]
    )
    assert.ok(
        request.text.format.schema.required.includes("addressed_tomo")
    )
    assert.ok(
        request.text.format.schema.required.includes("social_response")
    )
    assert.ok(
        request.text.format.schema.required.includes(
            "personality_opening"
        )
    )
    assert.ok(
        request.text.format.schema.required.includes(
            "personality_closing"
        )
    )
    assert.equal(
        request.text.format.schema.additionalProperties,
        false
    )
    assert.doesNotMatch(
        calls[0].options.body,
        /trustedEvents|verifiedEvents|cost_items|provider_contacts/i
    )
    assert.match(calls[0].options.body, /fresh social_response/)
    assert.match(calls[0].options.body, /must not include/)
    assert.match(calls[0].options.body, /Urgency and ordering will be calculated/)
    assert.match(calls[0].options.body, /whether they need to do anything/)
    assert.match(calls[0].options.body, /what's new\?/)
    assert.match(calls[0].options.body, /Return\\nclarification/)
    assert.match(calls[0].options.body, /what about tomorrow\?/)
})

test("requires server configuration without exposing a credential", async () => {
    const provider = createOpenAiSemanticProvider({ apiKey: "" })

    await assert.rejects(
        () =>
            provider.interpret({
                question: "What did her shots cost?",
                currentCareDate: "2026-07-30",
                conversationContext: null,
            }),
        (err) =>
            err instanceof SemanticProviderError &&
            err.status === 503 &&
            err.reason === "semantic_not_configured" &&
            !err.message.includes("test-key")
    )
})

test("does not expose provider response details on failure", async () => {
    const provider = createOpenAiSemanticProvider({
        apiKey: "test-key",
        fetchImpl: async () =>
            new Response("private provider detail", { status: 400 }),
    })

    await assert.rejects(
        () =>
            provider.interpret({
                question: "What did her shots cost?",
                currentCareDate: "2026-07-30",
                conversationContext: null,
            }),
        (err) =>
            err instanceof SemanticProviderError &&
            err.reason === "semantic_interpretation_failed" &&
            !err.message.includes("private provider detail")
    )
})
