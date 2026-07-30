import { TOMO_PERSONALITY_V1 } from "./tomoPersonality.js"

const DEFAULT_MAX_CHARACTERS = 360
const REVIEW_ANSWER_TYPES = new Set([
    "action_prepared",
    "message_draft_prepared",
])

function splitSentences(text) {
    return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()) || []
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

export function composeSpokenAnswer(
    assistantResponse,
    { maxCharacters = DEFAULT_MAX_CHARACTERS } = {}
) {
    const writtenAnswer = assistantResponse?.answer?.trim()

    if (!writtenAnswer) {
        return "I don’t have enough verified information to answer that yet."
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