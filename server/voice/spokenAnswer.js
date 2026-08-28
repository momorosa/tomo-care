import { TOMO_PERSONALITY_V1 } from "./tomoPersonality.js"

const DEFAULT_MAX_CHARACTERS = 360
const VERIFIED_WEIGHT_TREND_TYPE = "verified_weight_trend"
const VERIFIED_WEIGHT_TREND_SCHEMA_VERSION = 1
const KG_TO_LB = 2.2046226218
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

function fitVerifiedWeightTrendSummary(visualization, maxCharacters) {
    if (
        visualization?.type !== VERIFIED_WEIGHT_TREND_TYPE ||
        visualization?.schema_version !== VERIFIED_WEIGHT_TREND_SCHEMA_VERSION ||
        visualization?.unit !== "kg" ||
        !Array.isArray(visualization.points) ||
        visualization.points.length === 0 ||
        !visualization.summary
    ) {
        return null
    }

    const summary = visualization.summary
    const first = findWeightPoint(
        visualization.points,
        summary.first_fact_id
    )
    const latest = findWeightPoint(
        visualization.points,
        summary.latest_fact_id
    )

    if (
        !first ||
        !latest ||
        !isIsoDate(first.fact_date) ||
        !isIsoDate(latest.fact_date) ||
        !Number.isFinite(latest.value_lb) ||
        !Number.isFinite(summary.overall_change_kg) ||
        summary.reading_count !== visualization.points.length
    ) {
        return null
    }

    const latestSentence =
        visualization.points.length === 1
            ? `Momo’s one verified weight reading is ${formatPounds(latest.value_lb)} as of ${formatDate(latest.fact_date)}.`
            : `Momo’s latest verified weight is ${formatPounds(latest.value_lb)} as of ${formatDate(latest.fact_date)}.`
    const trendSentence = buildWeightTrendSentence(summary, first.fact_date)
    const spoken = [latestSentence, trendSentence].filter(Boolean).join(" ")

    return spoken.length <= maxCharacters
        ? spoken
        : fitSentences(spoken, maxCharacters)
}

function buildWeightTrendSentence(summary, firstFactDate) {
    if (
        summary.reading_count < 2 ||
        summary.overall_direction === "insufficient_readings"
    ) {
        return "One reading is not enough to establish a weight trend."
    }

    const changePounds = round(
        Math.abs(summary.overall_change_kg) * KG_TO_LB
    )
    const period = `Across ${summary.reading_count} verified readings since ${formatDate(firstFactDate)}`

    if (changePounds === 0 || summary.overall_direction === "stable") {
        return `${period}, her verified weight is unchanged overall.`
    }

    const changeDirection = summary.overall_change_kg > 0 ? "up" : "down"
    const trendDirection = {
        slightly_upward: "a slightly upward trend",
        slightly_downward: "a slightly downward trend",
        upward: "an upward trend",
        downward: "a downward trend",
    }[summary.overall_direction]
    const trendSuffix = trendDirection ? `—${trendDirection}` : ""

    return `${period}, she is ${changeDirection} ${formatPounds(changePounds)} overall${trendSuffix}.`
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

    const weightTrendSummary = fitVerifiedWeightTrendSummary(
        assistantResponse.visualization,
        maxCharacters
    )
    if (weightTrendSummary) return weightTrendSummary

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

function findWeightPoint(points, factId) {
    return points.find((point) => point?.fact_id === factId) || null
}

function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false

    const date = new Date(`${value}T00:00:00.000Z`)
    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    )
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatPounds(value) {
    const rounded = round(value)
    return `${rounded} ${rounded === 1 ? "pound" : "pounds"}`
}

function round(value) {
    return Number(Number(value).toFixed(2))
}
