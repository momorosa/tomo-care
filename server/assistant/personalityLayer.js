import { TOMO_RELATIONSHIP_PROFILE_V1 } from "./relationshipProfile.js"
import {
    getGeneratedFraming,
    getGeneratedSocialResponse,
} from "./boundedLanguage.js"

const SUPPORTED_TONES = new Set([
    "neutral",
    "warm",
    "playful",
    "appreciative",
    "concerned",
    "frustrated",
])

const RESTRAINED_INTENTS = new Set([
    "action_request",
    "ambiguous_health_question",
    "care_recommendation_boundary",
    "home_medication_given_action",
    "librela_appointment_message",
    "medical_judgment_boundary",
    "semantic_clarification",
])

const RESTRAINED_ANSWER_TYPES = new Set([
    "action_prepared",
    "action_request",
    "clarification_needed",
    "message_draft_prepared",
])

const ROYAL_CUES = [
    "queen momo",
    "her majesty",
    "royal",
    "luxury wellness",
    "premium wellness",
]

const PLAYFUL_CUES = [
    "lol",
    "haha",
    "hehe",
    "fancy",
    "diva",
    "pookie",
    "la momo",
]

function normalizeQuestion(question) {
    return String(question || "")
        .toLowerCase()
        .replace(/[’]/g, "'")
        .replace(/\s+/g, " ")
        .trim()
}

function includesCue(question, cues) {
    return cues.some((cue) => question.includes(cue))
}

function detectLocalSignals(question) {
    const normalized = normalizeQuestion(question)
    const addressedTomo = /(?:^|\s|[,!?.])tomo(?:$|\s|[,!?.])/.test(
        normalized
    )
    const greetedTomo = /^(?:hi|hey|hello)(?: there)?(?:,)? tomo\b/.test(
        normalized
    )
    const relationshipCue = includesCue(normalized, ROYAL_CUES)
        ? "royal_household"
        : includesCue(normalized, ["ball", "purple ball"])
          ? "ball_royalty"
          : null

    let tone = addressedTomo || greetedTomo ? "warm" : "neutral"

    if (/\b(thank you|thanks|appreciate it)\b/.test(normalized)) {
        tone = "appreciative"
    }

    if (
        /\b(worried|worry|concerned|scared|anxious|hurting|in pain|sick)\b/.test(
            normalized
        )
    ) {
        tone = "concerned"
    } else if (
        /\b(frustrated|frustrating|annoyed|annoying|ugh)\b/.test(
            normalized
        )
    ) {
        tone = "frustrated"
    } else if (
        relationshipCue ||
        includesCue(normalized, PLAYFUL_CUES) ||
        /[😂🤣😄😆😉]/u.test(question)
    ) {
        tone = "playful"
    }

    return {
        tone,
        addressed_tomo: addressedTomo,
        relationship_cue: relationshipCue,
    }
}

function getSemanticSignals(semanticInterpretation) {
    const tone = SUPPORTED_TONES.has(semanticInterpretation?.tone)
        ? semanticInterpretation.tone
        : "neutral"

    return {
        tone,
        addressed_tomo: semanticInterpretation?.addressed_tomo === true,
        seriousness:
            semanticInterpretation?.seriousness === "sensitive"
                ? "sensitive"
                : "ordinary",
    }
}

function stableVariant(question, variants) {
    const text = String(question || "")
    let hash = 0

    for (const character of text) {
        hash = (hash * 31 + character.codePointAt(0)) >>> 0
    }

    return variants[hash % variants.length]
}

function selectOpening({ tone, addressedTomo, relationshipCue, question }) {
    if (tone === "playful" && relationshipCue === "royal_household") {
        return stableVariant(question, [
            "Her Majesty’s care ledger is open—",
            "The royal records are ready—",
        ])
    }

    if (tone === "playful" && relationshipCue === "ball_royalty") {
        return "Ball-catching royalty deserves organized records—"
    }

    if (tone === "playful") {
        return stableVariant(question, [
            "Okay, that made me smile—",
            "I appreciate the framing—",
        ])
    }

    if (tone === "appreciative") {
        return "Always happy to help—"
    }

    if (addressedTomo || tone === "warm") {
        return "Hey Rosa—I’ve got it—"
    }

    if (tone === "concerned" || tone === "frustrated") {
        return "Let’s look at the verified record—"
    }

    return null
}

function isRestrained({ queryPlan, response, semanticSignals }) {
    return (
        queryPlan?.requires_action === true ||
        RESTRAINED_INTENTS.has(queryPlan?.intent) ||
        RESTRAINED_ANSWER_TYPES.has(response?.answer_type) ||
        semanticSignals.seriousness === "sensitive"
    )
}

export function applyPersonalityFraming({
    response,
    question,
    queryPlan,
    semanticInterpretation,
}) {
    if (!response || typeof response !== "object") return response

    const localSignals = detectLocalSignals(question)
    const semanticSignals = getSemanticSignals(semanticInterpretation)
    const restrained = isRestrained({
        queryPlan,
        response,
        semanticSignals,
    })
    const tone =
        semanticSignals.tone !== "neutral"
            ? semanticSignals.tone
            : localSignals.tone
    const addressedTomo =
        semanticSignals.addressed_tomo || localSignals.addressed_tomo
    const relationshipCue = localSignals.relationship_cue
    const canFrame =
        !restrained &&
        response.answer_type !== "social_response" &&
        typeof response.answer === "string" &&
        response.answer.trim().length > 0
    const modelLanguageWasRequested =
        semanticInterpretation?.language_generation === "requested"
    const generatedSocialResponse = getGeneratedSocialResponse({
        queryPlan,
        semanticInterpretation,
    })
    const generatedFraming = getGeneratedFraming({
        semanticInterpretation,
        allowFraming: canFrame,
    })
    const fallbackOpening =
        canFrame && !modelLanguageWasRequested
            ? selectOpening({
                  tone,
                  addressedTomo,
                  relationshipCue,
                  question,
              })
            : null
    const opening = generatedFraming.opening || fallbackOpening
    const closing = generatedFraming.closing
    const baseAnswer = generatedSocialResponse || response.answer
    const answer = [opening, baseAnswer, closing].filter(Boolean).join(" ")
    const generatedLanguage = generatedSocialResponse
        ? "social_response"
        : generatedFraming.opening || generatedFraming.closing
          ? "framing"
          : "none"

    return {
        ...response,
        answer,
        personality: {
            profile_version: TOMO_RELATIONSHIP_PROFILE_V1.version,
            tone,
            mode: restrained ? "restrained" : "relational",
            addressed_tomo: addressedTomo,
            relationship_cue: relationshipCue,
            framing_applied: Boolean(opening || closing),
            generated_language: generatedLanguage,
        },
    }
}
