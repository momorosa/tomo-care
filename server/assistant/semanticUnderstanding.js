import {
    resolveAttentionDateRange,
    resolveDateRange,
} from "./dateRanges.js"
import { buildQueryPlan } from "./queryPlanner.js"

const PLAN_CONFIG = {
    active_reminders: {
        subjects: ["reminders"],
        scope: "planned_reminders",
    },
    attention_summary: {
        subjects: ["attention"],
        scope: "governed_attention",
    },
    ambiguous_health_question: {
        subjects: ["health"],
        scope: "clarification_needed",
    },
    appointment_status: {
        subjects: ["appointment", "librela"],
        scope: "scheduled_appointments",
    },
    care_recommendation_boundary: {
        subjects: ["diet"],
        scope: "medical_recommendation",
    },
    care_timeline_summary: {
        subjects: ["care_timeline"],
        scope: "verified_care_records",
    },
    count_events: {
        subjects: ["librela"],
        scope: "verified_injections",
    },
    home_medication_due: {
        subjects: ["adequan", "simparica_trio"],
        scope: "planned_home_medication_reminders",
    },
    home_medication_status: {
        subjects: ["adequan", "simparica_trio"],
        scope: "verified_home_medication_administrations",
    },
    last_librela: {
        subjects: ["librela"],
        scope: "verified_injections",
    },
    last_weight: {
        subjects: ["weight"],
        scope: "verified_weight_facts",
    },
    medical_judgment_boundary: {
        subjects: ["health", "librela", "pain", "weight"],
        scope: "medical_interpretation",
    },
    next_librela_due: {
        subjects: ["librela"],
        scope: "care_schedule",
    },
    next_librela_reminder: {
        subjects: ["librela"],
        scope: "planned_reminders",
    },
    recent_verified_records: {
        subjects: ["documents"],
        scope: "verified_documents",
    },
    spend_summary: {
        subjects: ["librela"],
        scope: "direct_librela_line_items",
    },
    vaccine_record_lookup: {
        subjects: ["rabies_vaccine", "vaccine"],
        scope: "verified_events",
    },
    weight_change: {
        subjects: ["weight"],
        scope: "verified_weight_facts",
    },
    weight_trend: {
        subjects: ["weight"],
        scope: "verified_weight_facts",
    },
}

const INTERPRETATION_LABELS = {
    active_reminders: "Active care reminders",
    attention_summary: "What needs attention",
    ambiguous_health_question: "A request for more specific care details",
    appointment_status: "Appointment status",
    care_recommendation_boundary: "A care recommendation question",
    care_timeline_summary: "Momo’s verified care timeline",
    count_events: "Number of verified Librela injections",
    home_medication_due: "Next home-medication due date",
    home_medication_status: "Last verified home-medication dose",
    last_librela: "Last verified Librela injection",
    last_weight: "Latest verified weight",
    medical_judgment_boundary: "A medical judgment question",
    next_librela_due: "Next Librela due date",
    next_librela_reminder: "Next Librela reminder",
    recent_verified_records: "Recently verified records",
    spend_summary: "Verified Librela spending",
    vaccine_record_lookup: "Verified vaccine records",
    weight_change: "Verified weight change",
    weight_trend: "Verified weight trend",
}

const GENERATED_SOCIAL_INTENTS = new Set([
    "acknowledgement",
    "goodbye",
    "greeting",
    "negative_feedback",
    "positive_feedback",
    "thanks",
])

const RESTRAINED_LANGUAGE_INTENTS = new Set([
    "action_request",
    "ambiguous_health_question",
    "care_recommendation_boundary",
    "home_medication_given_action",
    "librela_appointment_message",
    "medical_judgment_boundary",
    "semantic_clarification",
])

function normalizeSocialUtterance(question) {
    return question
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function getLocalSocialIntent(question) {
    const normalized = normalizeSocialUtterance(question)
    const words = normalized.split(" ").filter(Boolean)

    if (
        /\b(?:tell me about you|tell me about yourself|who are you)\b/.test(
            normalized
        ) ||
        /^(?:tomo )?(?:what can you do(?: for me)?|how can you help(?: me)?)$/.test(
            normalized
        )
    ) {
        return "capabilities"
    }

    if (
        /^(?:tomo )?(?:what do you know about momo|tell me about momo|who is momo|describe momo)$/.test(
            normalized
        )
    ) {
        return "momo_profile"
    }

    if (
        /^(thank you|thanks|thank you tomo|thanks tomo|much appreciated)$/.test(
            normalized
        )
    ) {
        return "thanks"
    }

    if (
        /^(?:(?:hey|oh|yes|wow)(?: tomo)? )?(?:(?:that s|that is|it s|it is) )?(?:fantastic|great|amazing|wonderful|perfect|awesome|excellent)(?: (?:that s|that is) (?:exactly )?what i (?:was )?looking for)?(?: thank you| thanks(?: tomo)?)?$/.test(
            normalized
        ) ||
        /^(?:oh )?(?:(?:that s|that is) )?(?:exactly what i (?:was )?looking for|exactly what i needed|just what i needed)(?: thank you| thanks(?: tomo)?)?$/.test(
            normalized
        )
    ) {
        return "positive_feedback"
    }

    if (
        /^(?:(?:no|sorry|wait)(?: tomo)? )?(?:(?:that s|that is|it s|it is) )?(?:wrong|not right|not correct|not what i meant|not what i asked|not helpful|not working)(?: at all)?$/.test(
            normalized
        ) ||
        /^(?:no )?(?:that|it) (?:didn t|did not) (?:help|answer my question|work)$/.test(
            normalized
        )
    ) {
        return "negative_feedback"
    }

    if (words.length > 8) return null

    if (/^(hi|hello|hey|hi tomo|hello tomo|hey tomo)$/.test(normalized)) {
        return "greeting"
    }

    if (
        /^(bye|goodbye|good night|see you|see you later|bye tomo)$/.test(
            normalized
        )
    ) {
        return "goodbye"
    }

    return null
}

function socialPlan(socialIntent, dateRange) {
    return {
        intent: "social_response",
        subject: socialIntent,
        scope: "conversation",
        date_range: dateRange,
        trusted_only: true,
        requires_action: false,
        action: null,
    }
}

function clarificationPlan(dateRange) {
    return {
        intent: "semantic_clarification",
        subject: null,
        scope: "clarification_needed",
        date_range: dateRange,
        trusted_only: true,
        requires_action: false,
        action: null,
    }
}

function semanticPlan(interpretation, question, currentCareDate) {
    const config = PLAN_CONFIG[interpretation.intent]

    if (!config || !config.subjects.includes(interpretation.subject)) {
        return null
    }

    const scope =
        interpretation.intent === "spend_summary" &&
        interpretation.cost_scope === "whole_visit"
            ? "librela_visit_total"
            : config.scope

    return {
        intent: interpretation.intent,
        subject: interpretation.subject,
        scope,
        date_range:
            interpretation.intent === "attention_summary"
                ? resolveAttentionDateRange(question, currentCareDate)
                : resolveDateRange(question, currentCareDate),
        trusted_only: true,
        requires_action: false,
        action: null,
        event_offset:
            interpretation.intent === "last_librela"
                ? interpretation.event_offset
                : 0,
    }
}

function semanticMetadata(interpretation, plan) {
    const previous =
        interpretation.used_previous_context === true

    return {
        status: "applied",
        mode: "semantic",
        confidence: interpretation.confidence,
        used_previous_context: previous,
        interpretation_label:
            plan.event_offset === 1
                ? "Previous verified Librela injection"
                : INTERPRETATION_LABELS[plan.intent],
        ...personalityMetadata(interpretation),
        ...languageMetadata(interpretation),
    }
}

function personalityMetadata(interpretation) {
    const supportedTones = new Set([
        "neutral",
        "warm",
        "playful",
        "appreciative",
        "concerned",
        "frustrated",
    ])

    return {
        tone: supportedTones.has(interpretation?.tone)
            ? interpretation.tone
            : "neutral",
        addressed_tomo: interpretation?.addressed_tomo === true,
        seriousness:
            interpretation?.seriousness === "sensitive"
                ? "sensitive"
                : "ordinary",
    }
}

function languageMetadata(interpretation) {
    return {
        language_generation: "requested",
        social_response:
            typeof interpretation?.social_response === "string"
                ? interpretation.social_response
                : "",
        personality_opening:
            typeof interpretation?.personality_opening === "string"
                ? interpretation.personality_opening
                : "",
        personality_closing:
            typeof interpretation?.personality_closing === "string"
                ? interpretation.personality_closing
                : "",
    }
}

async function trySemanticInterpretation(semanticProvider, input) {
    if (!semanticProvider) return null

    try {
        return await semanticProvider.interpret(input)
    } catch {
        return null
    }
}

function shouldRequestDeterministicFraming(queryPlan) {
    return (
        queryPlan?.requires_action !== true &&
        !RESTRAINED_LANGUAGE_INTENTS.has(queryPlan?.intent)
    )
}

export async function resolveAssistantPlan({
    question,
    currentCareDate,
    conversationContext,
    buildPlan = buildQueryPlan,
    semanticProvider = null,
}) {
    const deterministicPlan = buildPlan(question, { currentCareDate })

    if (deterministicPlan.intent !== "unknown") {
        if (
            semanticProvider &&
            shouldRequestDeterministicFraming(deterministicPlan)
        ) {
            const interpretation = await trySemanticInterpretation(
                semanticProvider,
                { question, currentCareDate, conversationContext }
            )

            if (interpretation) {
                return {
                    queryPlan: deterministicPlan,
                    semanticInterpretation: {
                        status: "applied",
                        mode: "deterministic_with_semantic_language",
                        confidence: interpretation.confidence || "low",
                        used_previous_context: false,
                        interpretation_label:
                            INTERPRETATION_LABELS[
                                deterministicPlan.intent
                            ] || null,
                        ...personalityMetadata(interpretation),
                        ...languageMetadata(interpretation),
                    },
                }
            }
        }

        return {
            queryPlan: deterministicPlan,
            semanticInterpretation: null,
        }
    }

    const localSocialIntent = getLocalSocialIntent(question)

    if (localSocialIntent) {
        const canGenerate = GENERATED_SOCIAL_INTENTS.has(localSocialIntent)
        const interpretation = canGenerate
            ? await trySemanticInterpretation(semanticProvider, {
                  question,
                  currentCareDate,
                  conversationContext,
              })
            : null
        const matchesLocalIntent =
            interpretation?.kind === "social" &&
            interpretation?.social_intent === localSocialIntent

        return {
            queryPlan: socialPlan(
                localSocialIntent,
                deterministicPlan.date_range
            ),
            semanticInterpretation: {
                status: "applied",
                mode: "local_social",
                confidence: "high",
                used_previous_context: false,
                interpretation_label: null,
                ...(matchesLocalIntent
                    ? {
                          ...personalityMetadata(interpretation),
                          ...languageMetadata(interpretation),
                      }
                    : {}),
            },
        }
    }

    if (!semanticProvider) {
        return {
            queryPlan: deterministicPlan,
            semanticInterpretation: {
                status: "unavailable",
                mode: "deterministic_fallback",
            },
        }
    }

    const interpretation = await trySemanticInterpretation(
        semanticProvider,
        { question, currentCareDate, conversationContext }
    )

    if (!interpretation) {
        return {
            queryPlan: deterministicPlan,
            semanticInterpretation: {
                status: "unavailable",
                mode: "deterministic_fallback",
            },
        }
    }

    if (interpretation?.kind === "social") {
        const supportedSocial = new Set([
            "acknowledgement",
            "capabilities",
            "goodbye",
            "greeting",
            "momo_profile",
            "negative_feedback",
            "positive_feedback",
            "thanks",
        ])

        if (supportedSocial.has(interpretation.social_intent)) {
            return {
                queryPlan: socialPlan(
                    interpretation.social_intent,
                    deterministicPlan.date_range
                ),
                semanticInterpretation: {
                    status: "applied",
                    mode: "semantic",
                    confidence: interpretation.confidence,
                    used_previous_context: false,
                    interpretation_label: null,
                    ...personalityMetadata(interpretation),
                    ...languageMetadata(interpretation),
                },
            }
        }
    }

    if (
        interpretation?.kind === "clarification" ||
        interpretation?.confidence === "low"
    ) {
        return {
            queryPlan: clarificationPlan(deterministicPlan.date_range),
            semanticInterpretation: {
                status: "clarification_needed",
                mode: "semantic",
                confidence: interpretation?.confidence || "low",
                used_previous_context: Boolean(
                    interpretation?.used_previous_context
                ),
                interpretation_label: null,
                ...personalityMetadata(interpretation),
                ...languageMetadata(interpretation),
            },
        }
    }

    if (interpretation?.kind === "care_query") {
        const plan = semanticPlan(
            interpretation,
            question,
            currentCareDate
        )

        if (plan) {
            return {
                queryPlan: plan,
                semanticInterpretation: semanticMetadata(
                    interpretation,
                    plan
                ),
            }
        }
    }

    return {
        queryPlan: deterministicPlan,
        semanticInterpretation: {
            status: "not_supported",
            mode: "semantic",
            confidence: interpretation?.confidence || "low",
            used_previous_context: false,
            interpretation_label: null,
            ...personalityMetadata(interpretation),
            ...languageMetadata(interpretation),
        },
    }
}
