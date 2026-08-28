export const WEIGHT_TREND_CHART_SIZE = Object.freeze({
    width: 640,
    height: 280,
    plotLeft: 58,
    plotRight: 616,
    plotTop: 30,
    plotBottom: 224,
})

const VERIFIED_WEIGHT_TREND_TYPE = "verified_weight_trend"
const VERIFIED_WEIGHT_TREND_SCHEMA_VERSION = 1

export function buildVerifiedWeightTrendChartModel(
    visualization,
    citations = [],
    { displayUnit = "lb" } = {}
) {
    if (!isVerifiedWeightTrendVisualization(visualization)) return null

    const normalizedDisplayUnit = displayUnit === "kg" ? "kg" : "lb"

    const citationByFactId = new Map(
        (Array.isArray(citations) ? citations : [])
            .filter((citation) => citation?.id)
            .map((citation) => [String(citation.id), citation])
    )
    const values = visualization.points.map((point) => point.value_kg)
    const dates = visualization.points.map((point) => toUtcTimestamp(point.fact_date))
    const yDomain = getWeightScaleDomain(values)
    const xDomain = {
        min: Math.min(...dates),
        max: Math.max(...dates),
    }
    const summary = visualization.summary
    const lowIds = new Set(summary.low_fact_ids || [])
    const highIds = new Set(summary.high_fact_ids || [])
    const positionedPoints = visualization.points.map((point, index) => {
        const roles = []
        const only = visualization.points.length === 1

        if (only) {
            roles.push("only verified reading")
        } else {
            if (point.fact_id === summary.latest_fact_id) {
                roles.push("latest verified reading")
            }
            if (lowIds.has(point.fact_id)) roles.push("lowest verified reading")
            if (highIds.has(point.fact_id)) roles.push("highest verified reading")
        }

        const citation = citationByFactId.get(point.fact_id) || null
        const sourceUrl =
            citation?.verification_url ||
            (point.doc_id ? `/review/${point.doc_id}` : null)

        return {
            ...point,
            index,
            x: scaleDate(dates[index], xDomain),
            y: scaleWeight(point.value_kg, yDomain),
            roles,
            citation,
            source_url: sourceUrl,
            accessible_label: getPointAccessibleLabel(
                point,
                roles,
                normalizedDisplayUnit
            ),
        }
    })
    const points = addConcentricPointRadii(positionedPoints)
    const first = points[0]
    const latest = points.at(-1)
    const low = points.find((point) => lowIds.has(point.fact_id)) || first
    const high = points.find((point) => highIds.has(point.fact_id)) || first

    return {
        type: VERIFIED_WEIGHT_TREND_TYPE,
        schema_version: VERIFIED_WEIGHT_TREND_SCHEMA_VERSION,
        points,
        path:
            points.length > 1
                ? points
                      .map(
                          (point, index) =>
                              `${index === 0 ? "M" : "L"} ${roundCoordinate(point.x)} ${roundCoordinate(point.y)}`
                      )
                      .join(" ")
                : null,
        y_domain: yDomain,
        y_ticks: getWeightTicks(yDomain, normalizedDisplayUnit),
        x_ticks: getDateTicks(points),
        summary_metrics:
            points.length === 1
                ? [
                      toSummaryMetric(
                          "Verified reading",
                          latest,
                          1,
                          normalizedDisplayUnit
                      ),
                  ]
                : [
                      toSummaryMetric(
                          "Latest",
                          latest,
                          1,
                          normalizedDisplayUnit
                      ),
                      toSummaryMetric(
                          "Lowest",
                          low,
                          lowIds.size,
                          normalizedDisplayUnit
                      ),
                      toSummaryMetric(
                          "Highest",
                          high,
                          highIds.size,
                          normalizedDisplayUnit
                      ),
                  ],
        latest_fact_id: summary.latest_fact_id,
        display_unit: normalizedDisplayUnit,
        canonical_unit: "kg",
        accessible_label: getChartAccessibleLabel({
            points,
            low,
            high,
            latest,
            displayUnit: normalizedDisplayUnit,
        }),
        scale_label: `Scale ${formatWeightValue(yDomain.min, normalizedDisplayUnit)}–${formatWeightValue(yDomain.max, normalizedDisplayUnit)} ${normalizedDisplayUnit}`,
    }
}

export function isVerifiedWeightTrendVisualization(value) {
    if (
        value?.type !== VERIFIED_WEIGHT_TREND_TYPE ||
        value?.schema_version !== VERIFIED_WEIGHT_TREND_SCHEMA_VERSION ||
        value?.unit !== "kg" ||
        !Array.isArray(value.points) ||
        value.points.length === 0 ||
        !value.summary
    ) {
        return false
    }

    const validPoints = value.points.every(
        (point) =>
            Boolean(point?.fact_id) &&
            Number.isFinite(toUtcTimestamp(point?.fact_date)) &&
            Number.isFinite(point?.value_kg) &&
            Number.isFinite(point?.value_lb)
    )
    if (!validPoints) return false

    const pointIds = new Set(value.points.map((point) => point.fact_id))
    const summaryIds = [
        value.summary.first_fact_id,
        value.summary.latest_fact_id,
        ...(value.summary.low_fact_ids || []),
        ...(value.summary.high_fact_ids || []),
    ]

    return (
        Number.isInteger(value.summary.reading_count) &&
        value.summary.reading_count === value.points.length &&
        Array.isArray(value.summary.low_fact_ids) &&
        value.summary.low_fact_ids.length > 0 &&
        Array.isArray(value.summary.high_fact_ids) &&
        value.summary.high_fact_ids.length > 0 &&
        summaryIds.every((factId) => pointIds.has(factId))
    )
}

function getWeightScaleDomain(values) {
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    let min = Math.floor(dataMin * 2) / 2
    let max = Math.ceil(dataMax * 2) / 2

    if (max - min < 1) {
        const center = (dataMin + dataMax) / 2
        min = Math.floor((center - 0.5) * 2) / 2
        max = min + 1

        if (max < dataMax) {
            max += 0.5
            min += 0.5
        }
    }

    return { min, max }
}

function scaleDate(timestamp, domain) {
    const { plotLeft, plotRight } = WEIGHT_TREND_CHART_SIZE
    if (domain.max === domain.min) return (plotLeft + plotRight) / 2

    const ratio = (timestamp - domain.min) / (domain.max - domain.min)
    return plotLeft + ratio * (plotRight - plotLeft)
}

function scaleWeight(value, domain) {
    const { plotTop, plotBottom } = WEIGHT_TREND_CHART_SIZE
    const ratio = (value - domain.min) / (domain.max - domain.min)
    return plotBottom - ratio * (plotBottom - plotTop)
}

function getWeightTicks(domain, displayUnit) {
    const values = [domain.max, (domain.min + domain.max) / 2, domain.min]

    return values.map((value) => ({
        value,
        label: `${formatWeightValue(value, displayUnit)} ${displayUnit}`,
        y: scaleWeight(value, domain),
    }))
}

function getDateTicks(points) {
    const indices =
        points.length === 1
            ? [0]
            : points.length === 2
              ? [0, 1]
              : [0, Math.floor((points.length - 1) / 2), points.length - 1]
    const seenDates = new Set()

    return indices
        .map((index) => points[index])
        .filter((point) => {
            if (seenDates.has(point.fact_date)) return false
            seenDates.add(point.fact_date)
            return true
        })
        .map((point) => ({
            fact_date: point.fact_date,
            label: formatShortDate(point.fact_date),
            x: point.x,
        }))
}

function addConcentricPointRadii(points) {
    const groups = new Map()

    for (const point of points) {
        const key = `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`
        const group = groups.get(key) || []
        group.push(point.fact_id)
        groups.set(key, group)
    }

    return points.map((point) => {
        const key = `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`
        const group = groups.get(key)
        const groupIndex = group.indexOf(point.fact_id)

        return {
            ...point,
            radius: 6 + (group.length - groupIndex - 1) * 3,
            coincident_reading_count: group.length,
        }
    })
}

function toSummaryMetric(label, point, tiedCount, displayUnit) {
    const secondaryUnit = displayUnit === "lb" ? "kg" : "lb"

    return {
        label,
        value: `${formatPointWeight(point, displayUnit)} ${displayUnit}`,
        secondary: `${formatPointWeight(point, secondaryUnit)} ${secondaryUnit}`,
        detail:
            tiedCount > 1
                ? `${tiedCount} verified readings`
                : formatLongDate(point.fact_date),
        fact_id: point.fact_id,
    }
}

function getPointAccessibleLabel(point, roles, displayUnit) {
    const rolePhrase = roles.length ? ` ${sentenceCase(roles.join("; "))}.` : ""
    const secondaryUnit = displayUnit === "lb" ? "kg" : "lb"

    return `${formatLongDate(point.fact_date)}: ${formatPointWeight(point, displayUnit)} ${displayUnit} (${formatPointWeight(point, secondaryUnit)} ${secondaryUnit}).${rolePhrase} Select to review its verified source.`
}

function getChartAccessibleLabel({ points, low, high, latest, displayUnit }) {
    if (points.length === 1) {
        return `Momo’s verified weight history contains one reading: ${formatPointWeight(latest, displayUnit)} ${displayUnit} on ${formatLongDate(latest.fact_date)}. One reading does not establish a trend.`
    }

    return `Momo’s verified weight history contains ${points.length} readings from ${formatLongDate(points[0].fact_date)} to ${formatLongDate(latest.fact_date)}. The verified range is ${formatPointWeight(low, displayUnit)} to ${formatPointWeight(high, displayUnit)} ${displayUnit}. The latest reading is ${formatPointWeight(latest, displayUnit)} ${displayUnit}.`
}

function formatPointWeight(point, unit) {
    return formatCompactNumber(unit === "lb" ? point.value_lb : point.value_kg)
}

function formatWeightValue(valueKg, unit) {
    const value = unit === "lb" ? valueKg * 2.2046226218 : valueKg
    return formatCompactNumber(value)
}

function toUtcTimestamp(value) {
    return new Date(`${value}T00:00:00.000Z`).getTime()
}

function formatShortDate(value) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatLongDate(value) {
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatCompactNumber(value) {
    return Number(Number(value).toFixed(2)).toString()
}

function roundCoordinate(value) {
    return Number(value.toFixed(2))
}

function sentenceCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}
