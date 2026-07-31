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
        confidence: "high",
        social_intent: "none",
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
    assert.equal(
        request.text.format.schema.additionalProperties,
        false
    )
    assert.doesNotMatch(
        calls[0].options.body,
        /trustedEvents|citations|medical record/i
    )
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
