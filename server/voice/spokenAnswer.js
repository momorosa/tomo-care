import { TOMO_PERSONALITY_V1 } from "./tomoPersonality.js"

const DEFAULT_MAX_CHARACTERS = 360
const REVIEW_ANSWER_TYPES = new Set([
    "action_prepared",
    "message_draft_prepared",
])
const PROTECTED_PERIOD = "\uE000"

function splitSentences(text) {
    const protectedText = text
        .replace(/(\d)\.(?=\d)/g, `$1${PROTECTED_PERIOD}`)
        .replace(/\b(?:e\.g|i\.e)\./gi, (match) =>
            match.replaceAll(".", PROTECTED_PERIOD)
        )
        .replace(/\b(?:Dr|Mr|Mrs|Ms|St|vs|etc|No)\./gi, (match) =>
            match.replace(".", PROTECTED_PERIOD)
        )

    return (
        protectedText
            .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
            ?.map((part) =>
                part.replaceAll(PROTECTED_PERIOD, ".").trim()
            ) || []
    )
}

function fitSentences(text, maxCharacters) {
    const sentences = splitSentences(text)
    const selected = []

    for (const sentence of sentences) {
        const candidate = [...selected, sentence].join(" ")

        if (candidate.length > maxCharacters || selected.length === 2) {
            break
        }

        selected.push(sentence)
    }

    if (selected.length > 0) {
        return selected.join(" ")
    }

    return `${text.slice(0, Math.max(0, maxCharacters - 1)).trim()}…`
}

function trimTerminalPunctuation(value) {
    return String(value || "").trim().replace(/[.!?]+$/, "")
}

function fitAttentionSummary(assistantResponse, maxCharacters) {
    const writtenAnswer = assistantResponse.answer.trim()
    const sentences = splitSentences(writtenAnswer)

    if (writtenAnswer.length <= maxCharacters && sentences.length <= 2) {
        return writtenAnswer
    }

    const opening = sentences[0] || "Here’s what needs your attention."
    const items = assistantResponse.attention_items || []

    for (let visibleCount = items.length; visibleCount >= 1; visibleCount -= 1) {
        const details = items
            .slice(0, visibleCount)
            .map((item) =>
                trimTerminalPunctuation(
                    item.reason || `${item.title || "This item"} needs attention.`
                )
            )
        const remainingCount = items.length - visibleCount

        if (remainingCount > 0) {
            details.push(
                `${remainingCount} more ${remainingCount === 1 ? "item is" : "items are"} listed on screen`
            )
        }

        const candidate = `${opening} ${details.join("; ")}.`
        if (candidate.length <= maxCharacters) return candidate
    }

    const screenFallback = `${opening} The details are listed on screen.`
    return screenFallback.length <= maxCharacters
        ? screenFallback
        : fitSentences(writtenAnswer, maxCharacters)
}

export function composeSpokenAnswer(
    assistantResponse,
    { maxCharacters = DEFAULT_MAX_CHARACTERS } = {}
) {
    const writtenAnswer = assistantResponse?.answer?.trim()

    if (!writtenAnswer) {
        return "I don’t have enough verified information to answer that yet."
    }

    if (assistantResponse.answer_type === "attention_summary") {
        return fitAttentionSummary(assistantResponse, maxCharacters)
    }

    if (assistantResponse.answer_type === "profile_summary") {
        const governedAnswer =
            assistantResponse.governed_answer?.trim() || writtenAnswer
        const governedStart = writtenAnswer.indexOf(governedAnswer)
        const profileAnswer =
            governedStart >= 0
                ? writtenAnswer.slice(governedStart)
                : writtenAnswer

        return profileAnswer.length <= maxCharacters
            ? profileAnswer
            : fitSentences(governedAnswer, maxCharacters)
    }

    const reviewTransition = REVIEW_ANSWER_TYPES.has(
        assistantResponse.answer_type
    )
        ? TOMO_PERSONALITY_V1.reviewTransition
        : ""
    const answerBudget = reviewTransition
        ? maxCharacters - reviewTransition.length - 1
        : maxCharacters
    const conciseAnswer = fitSentences(writtenAnswer, answerBudget)

    return [conciseAnswer, reviewTransition].filter(Boolean).join(" ")
}
