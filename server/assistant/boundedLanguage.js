const SOCIAL_INTENTS = new Set([
    "acknowledgement",
    "goodbye",
    "greeting",
    "negative_feedback",
    "positive_feedback",
    "thanks",
])

const FACT_OR_ACTION_PATTERNS = [
    /\d/u,
    /[$€£¥]/u,
    /https?:\/\/|www\./iu,
    /\b(?:according to|the records? (?:show|say)|verified|citation|source)\b/iu,
    /\b(?:dose|injection|appointment|reminder|calendar|weight|kilograms?|kg|pounds?|cost|spent)\b/iu,
    /\b(?:diagnos(?:e|ed|is)|medical advice|veterinary advice)\b/iu,
    /\b(?:i|we)\s+(?:already\s+)?(?:sent|scheduled|booked|approved|completed|updated|recorded|filed|submitted|added|changed|cancelled|executed)\b/iu,
]

function sentenceCount(value) {
    const endings = value.match(/[.!?]+(?=\s|$)/gu)
    return endings?.length || 1
}

function sanitizeCandidate(value, { maxLength, maxSentences }) {
    if (typeof value !== "string") return null

    const normalized = value.replace(/\s+/gu, " ").trim()

    if (
        !normalized ||
        normalized.length > maxLength ||
        sentenceCount(normalized) > maxSentences ||
        FACT_OR_ACTION_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
        return null
    }

    return normalized
}

export function getGeneratedSocialResponse({
    queryPlan,
    semanticInterpretation,
}) {
    if (
        queryPlan?.intent !== "social_response" ||
        !SOCIAL_INTENTS.has(queryPlan?.subject)
    ) {
        return null
    }

    return sanitizeCandidate(semanticInterpretation?.social_response, {
        maxLength: 220,
        maxSentences: 2,
    })
}

export function getGeneratedFraming({
    semanticInterpretation,
    allowFraming,
}) {
    if (!allowFraming) {
        return { opening: null, closing: null }
    }

    const opening = sanitizeCandidate(
        semanticInterpretation?.personality_opening,
        { maxLength: 120, maxSentences: 1 }
    )
    const closing = sanitizeCandidate(
        semanticInterpretation?.personality_closing,
        { maxLength: 120, maxSentences: 1 }
    )

    if (opening && closing) {
        return { opening: null, closing: null }
    }

    return { opening, closing }
}
