import process from "node:process"

export const DEFAULT_SEMANTIC_MODEL = "gpt-5.6-terra"

const SEMANTIC_SCHEMA = {
    type: "object",
    properties: {
        kind: {
            type: "string",
            enum: ["care_query", "social", "clarification", "unknown"],
        },
        intent: {
            type: "string",
            enum: [
                "active_reminders",
                "attention_summary",
                "ambiguous_health_question",
                "appointment_status",
                "care_recommendation_boundary",
                "care_timeline_summary",
                "count_events",
                "home_medication_due",
                "home_medication_status",
                "last_librela",
                "last_weight",
                "medical_judgment_boundary",
                "next_librela_due",
                "next_librela_reminder",
                "profile_summary",
                "recent_verified_records",
                "spend_summary",
                "vaccine_record_lookup",
                "weight_change",
                "weight_trend",
                "none",
            ],
        },
        subject: {
            type: "string",
            enum: [
                "adequan",
                "appointment",
                "attention",
                "care_timeline",
                "diet",
                "documents",
                "health",
                "librela",
                "pain",
                "profile",
                "rabies_vaccine",
                "reminders",
                "simparica_trio",
                "vaccine",
                "weight",
                "none",
            ],
        },
        cost_scope: {
            type: "string",
            enum: ["direct_medication", "whole_visit", "none"],
        },
        event_offset: {
            type: "integer",
            enum: [0, 1],
        },
        profile_field: {
            type: "string",
            enum: [
                "summary",
                "name",
                "species",
                "breed",
                "birth_date",
                "age",
                "sex",
                "reproductive_status",
                "microchip_id",
                "none",
            ],
        },
        confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
        },
        social_intent: {
            type: "string",
            enum: [
                "acknowledgement",
                "capabilities",
                "goodbye",
                "greeting",
                "negative_feedback",
                "positive_feedback",
                "thanks",
                "none",
            ],
        },
        tone: {
            type: "string",
            enum: [
                "neutral",
                "warm",
                "playful",
                "appreciative",
                "concerned",
                "frustrated",
            ],
        },
        addressed_tomo: {
            type: "boolean",
        },
        seriousness: {
            type: "string",
            enum: ["ordinary", "sensitive"],
        },
        social_response: {
            type: "string",
        },
        personality_opening: {
            type: "string",
        },
        personality_closing: {
            type: "string",
        },
        interpreted_question: {
            type: "string",
        },
        clarification_question: {
            type: "string",
        },
        used_previous_context: {
            type: "boolean",
        },
    },
    required: [
        "kind",
        "intent",
        "subject",
        "cost_scope",
        "event_offset",
        "profile_field",
        "confidence",
        "social_intent",
        "tone",
        "addressed_tomo",
        "seriousness",
        "social_response",
        "personality_opening",
        "personality_closing",
        "interpreted_question",
        "clarification_question",
        "used_previous_context",
    ],
    additionalProperties: false,
}

const SEMANTIC_INSTRUCTIONS = `
You classify one utterance for TomoCare, a trusted pet-care record assistant.
Do not answer the user and do not invent care facts.
Return only the supplied schema.

Choose only a supported intent. Care facts will be retrieved separately from
verified TomoCare records. A previous turn contains only an intent and subject;
use it only when the current utterance clearly refers back with language such
as "that", "it", or "the one before". When the previous intent is
attention_summary, a bounded follow-up such as "what about tomorrow?" or "how
about this month?" may keep attention_summary and apply the new time window.

Use event_offset 1 only when the user asks for the Librela injection before the
most recently discussed one. Otherwise use 0.
Use whole_visit only when the user asks for the full appointment or visit cost.
Use direct_medication for Librela medication spend.

Never infer an approval, execution, medication administration, booking, send,
text, email, calendar change, or other external action. For an action request
that is not already handled by TomoCare, return clarification.
Treat a request to change, update, edit, correct, or set a Profile field as a
consequential action request. Do not return profile_summary and do not imply
that the pets row was changed.

Treat "calendar" as the user's TomoCare care schedule or planned reminders when
the utterance asks what is listed or whether a care item is listed. Use
active_reminders for a general calendar question and home_medication_due for a
supported home medication such as Adequan or Simparica Trio. Do not claim that
an item is synced to Google Calendar.

Use attention_summary with subject attention when the user asks generally what
needs attention, whether they need to do anything, what needs review, what is
waiting for them, or what they should handle or take care of next. This intent
may include today, tomorrow, this week, or this month; the deterministic planner
will calculate that window. Urgency and ordering will be calculated separately
from governed state.

Broad overview prompts such as "what's new?", "what do I need to know?", or
"anything I need to know?" do not necessarily mean actionable work. Return
clarification unless the utterance or bounded previous context identifies a
supported subject. Ask whether the user wants current attention items, recently
verified records, or a specific part of Momo's care. Do not invent an update.

Use social only for ordinary conversation that contains no care question.
Classify questions about who Tomo is, what Tomo can do, or how Tomo can help as
social with social_intent capabilities.
Classify questions asking who Momo is, what is known about Momo, what is in her
Profile, or asking for her name, species, breed, birth date, age, sex,
spay/neuter status, or microchip number as care_query with intent profile_summary and subject
profile. Set profile_field to the requested field, or summary for a broad
Profile question. These facts are retrieved only from the governed pets row.
Never confuse Momo, the pet, with Tomo, the assistant. “How is Momo?” is
ambiguous health language, not a Profile request; return clarification.
Classify praise or delight such as "That's fantastic", "Great", or "Amazing"
as positive_feedback, not acknowledgement. Use acknowledgement for neutral
confirmations such as "okay" or "got it". Use unknown when the utterance is
outside the supported TomoCare scope. Use clarification when the care meaning
or referent is genuinely ambiguous.

Classify a correction or disappointed reaction such as "that's not what I
meant", "that's wrong", or "no, that didn't help" as negative_feedback when it
contains no new care question.

Tone is a bounded conversational signal only. Use playful for obvious jokes or
lighthearted framing, appreciative for thanks, concerned for worry, frustrated
for frustration, warm for an ordinary friendly greeting, and neutral otherwise.
Set addressed_tomo true only when the user directly names Tomo. Set seriousness
to sensitive for pain, medical judgment, health uncertainty, or consequential
actions; otherwise use ordinary. These fields never change facts or authority.

You may write bounded personality language in the three language fields. Tomo
is Rosa's warm, clever, caring sidekick for Momo, with light affectionate humor
and occasional references to Queen Momo or Her Majesty when Rosa's tone invites
it. Keep the language natural and concise rather than formulaic.

For greeting, thanks, positive_feedback, negative_feedback, acknowledgement,
or goodbye, write a fresh social_response of no more than two short sentences.
For capabilities, leave social_response empty because those claims are
assembled from deterministic configuration.

For an ordinary care_query, you may write one brief personality_opening or one
brief personality_closing, but never both. It must be fact-free framing only. It must not include
dates, numbers, amounts, citations, medical conclusions, record claims, or any
claim that an action occurred. Do not restate or anticipate the factual answer.
Leave both fields empty when personality would add little value.

For sensitive questions, clarification, actions, approvals, sending, booking,
medication administration, or any other consequential turn, leave all three
language fields empty. Never claim that Tomo sent, scheduled, recorded, updated,
approved, or completed anything.
`.trim()

export class SemanticProviderError extends Error {
    constructor(
        message,
        { status = 502, reason = "semantic_provider_error" } = {}
    ) {
        super(message)
        this.name = "SemanticProviderError"
        this.status = status
        this.reason = reason
    }
}

function getOutputText(data) {
    if (typeof data?.output_text === "string") {
        return data.output_text.trim()
    }

    return (data?.output || [])
        .filter((item) => item?.type === "message")
        .flatMap((item) => item.content || [])
        .filter((part) => part?.type === "output_text")
        .map((part) => part.text || "")
        .join("")
        .trim()
}

async function discardProviderBody(response) {
    await response.arrayBuffer().catch(() => null)
}

export function createOpenAiSemanticProvider({
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.TOMO_SEMANTIC_MODEL || DEFAULT_SEMANTIC_MODEL,
    fetchImpl = globalThis.fetch,
} = {}) {
    return {
        async interpret({
            question,
            currentCareDate,
            conversationContext,
        }) {
            if (!apiKey) {
                throw new SemanticProviderError(
                    "Semantic understanding is not configured.",
                    {
                        status: 503,
                        reason: "semantic_not_configured",
                    }
                )
            }

            const response = await fetchImpl(
                "https://api.openai.com/v1/responses",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model,
                        store: false,
                        reasoning: { effort: "none" },
                        instructions: SEMANTIC_INSTRUCTIONS,
                        input: JSON.stringify({
                            question,
                            current_care_date: currentCareDate,
                            previous_turn: conversationContext,
                        }),
                        text: {
                            format: {
                                type: "json_schema",
                                name: "tomo_semantic_interpretation",
                                strict: true,
                                schema: SEMANTIC_SCHEMA,
                            },
                        },
                        max_output_tokens: 550,
                    }),
                }
            )

            if (!response.ok) {
                await discardProviderBody(response)
                throw new SemanticProviderError(
                    "Tomo could not interpret that phrasing right now.",
                    {
                        reason: "semantic_interpretation_failed",
                    }
                )
            }

            const data = await response.json()
            const outputText = getOutputText(data)

            if (!outputText) {
                throw new SemanticProviderError(
                    "Tomo could not interpret that phrasing right now.",
                    {
                        reason: "empty_semantic_interpretation",
                    }
                )
            }

            try {
                return JSON.parse(outputText)
            } catch {
                throw new SemanticProviderError(
                    "Tomo could not interpret that phrasing right now.",
                    {
                        reason: "invalid_semantic_interpretation",
                    }
                )
            }
        },
    }
}
