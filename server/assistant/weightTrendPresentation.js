import { dateInRange } from "./dateRanges.js"

export const VERIFIED_WEIGHT_TREND_SCHEMA_VERSION = 1
export const VERIFIED_WEIGHT_TREND_TYPE = "verified_weight_trend"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KG_TO_LB = 2.2046226218

export function buildVerifiedWeightTrendPresentation(
    facts = [],
    dateRange = null
) {
    const points = (Array.isArray(facts) ? facts : [])
        .map(toVerifiedWeightPoint)
        .filter(Boolean)
        .filter((point) => dateInRange(point.fact_date, dateRange))
        .sort(compareWeightPoints)

    if (!points.length) return null

    const first = points[0]
    const latest = points.at(-1)
    const lowValueKg = Math.min(...points.map((point) => point.value_kg))
    const highValueKg = Math.max(...points.map((point) => point.value_kg))
    const lowFactIds = points
        .filter((point) => point.value_kg === lowValueKg)
        .map((point) => point.fact_id)
    const highFactIds = points
        .filter((point) => point.value_kg === highValueKg)
        .map((point) => point.fact_id)
    const recentPoints = points.slice(-4)
    const recentFirst = recentPoints[0]
    const overallChangeKg = round(latest.value_kg - first.value_kg)
    const recentChangeKg = round(
        latest.value_kg - recentFirst.value_kg
    )

    return {
        schema_version: VERIFIED_WEIGHT_TREND_SCHEMA_VERSION,
        type: VERIFIED_WEIGHT_TREND_TYPE,
        unit: "kg",
        points,
        summary: {
            reading_count: points.length,
            first_fact_id: first.fact_id,
            latest_fact_id: latest.fact_id,
            low_fact_ids: lowFactIds,
            high_fact_ids: highFactIds,
            overall_change_kg: overallChangeKg,
            latest_from_high_kg: round(latest.value_kg - highValueKg),
            overall_direction: describeOverallDirection(
                overallChangeKg,
                points.length
            ),
            recent_first_fact_id: recentFirst.fact_id,
            recent_reading_count: recentPoints.length,
            recent_change_kg: recentChangeKg,
            recent_direction: describeRecentDirection(recentPoints),
        },
    }
}

function toVerifiedWeightPoint(fact) {
    if (!fact || fact.status !== "verified" || fact.fact_type !== "weight") {
        return null
    }

    if (!fact.id || !isValidIsoDate(fact.fact_date)) return null

    const valueKg = getWeightKg(fact)
    if (!Number.isFinite(valueKg)) return null

    const valueLb = getWeightLb(fact, valueKg)

    return {
        fact_id: String(fact.id),
        fact_date: fact.fact_date,
        value_kg: round(valueKg),
        value_lb: round(valueLb),
        doc_id: fact.doc_id || null,
    }
}

function compareWeightPoints(a, b) {
    return (
        a.fact_date.localeCompare(b.fact_date) ||
        a.fact_id.localeCompare(b.fact_id)
    )
}

function getWeightKg(fact) {
    const valueJson = fact.value_json || {}
    const canonicalKg = toFiniteNumber(valueJson.value_kg)

    if (canonicalKg !== null) return canonicalKg

    const value = toFiniteNumber(valueJson.value)
    if (value === null) return NaN

    const unit = String(valueJson.unit || "kg").toLowerCase()
    return unit === "lb" || unit === "lbs" ? value / KG_TO_LB : value
}

function getWeightLb(fact, valueKg) {
    const storedLb = toFiniteNumber(fact.value_json?.value_lb)
    return storedLb === null ? valueKg * KG_TO_LB : storedLb
}

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === "") return null
    if (typeof value === "boolean") return null

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

function isValidIsoDate(value) {
    if (!DATE_RE.test(String(value || ""))) return false

    const date = new Date(`${value}T00:00:00.000Z`)
    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    )
}

function describeOverallDirection(changeKg, readingCount) {
    if (readingCount < 2) return "insufficient_readings"

    const absChangeKg = Math.abs(changeKg)

    if (absChangeKg < 0.05) return "stable"
    if (absChangeKg <= 0.25) {
        return changeKg > 0 ? "slightly_upward" : "slightly_downward"
    }

    return changeKg > 0 ? "upward" : "downward"
}

function describeRecentDirection(points) {
    if (points.length < 2) return "insufficient_readings"

    const values = points.map((point) => point.value_kg)
    const nonDecreasing = values.every(
        (value, index) => index === 0 || value >= values[index - 1] - 0.01
    )
    const nonIncreasing = values.every(
        (value, index) => index === 0 || value <= values[index - 1] + 0.01
    )
    const netChange = round(values.at(-1) - values[0])

    if (nonIncreasing && netChange < -0.05) return "gradual_downward"
    if (nonDecreasing && netChange > 0.05) return "gradual_upward"
    if (Math.abs(netChange) < 0.05) return "stable"

    return "mixed"
}

function round(value, decimals = 2) {
    return Number(Number(value).toFixed(decimals))
}
