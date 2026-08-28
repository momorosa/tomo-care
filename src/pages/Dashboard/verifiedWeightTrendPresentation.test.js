import assert from "node:assert/strict"
import test from "node:test"

import {
    buildVerifiedWeightTrendChartModel,
    isVerifiedWeightTrendVisualization,
} from "./verifiedWeightTrendPresentation.js"

function visualization(points, summary = {}) {
    return {
        schema_version: 1,
        type: "verified_weight_trend",
        unit: "kg",
        points,
        summary: {
            reading_count: points.length,
            first_fact_id: points[0]?.fact_id,
            latest_fact_id: points.at(-1)?.fact_id,
            low_fact_ids: points.length ? [points.at(-1).fact_id] : [],
            high_fact_ids: points.length ? [points[0].fact_id] : [],
            overall_change_kg: 0,
            ...summary,
        },
    }
}

function point(id, date, kg, lb = kg * 2.2046226218) {
    return {
        fact_id: id,
        fact_date: date,
        value_kg: kg,
        value_lb: Number(lb.toFixed(2)),
        doc_id: `doc-${id}`,
    }
}

test("builds all chart points independently of the ten-card citation view", () => {
    const points = Array.from({ length: 14 }, (_, index) =>
        point(
            `weight-${index + 1}`,
            new Date(Date.UTC(2025, index, 1)).toISOString().slice(0, 10),
            16 - index / 10
        )
    )
    const citations = points.map((item) => ({
        id: item.fact_id,
        verification_url: `/review/${item.doc_id}`,
        source_title: `Source ${item.fact_id}`,
    }))
    const model = buildVerifiedWeightTrendChartModel(
        visualization(points, {
            low_fact_ids: [points.at(-1).fact_id],
            high_fact_ids: [points[0].fact_id],
        }),
        citations
    )

    assert.equal(model.points.length, 14)
    assert.equal(model.points[0].source_url, "/review/doc-weight-1")
    assert.equal(model.points.at(-1).source_url, "/review/doc-weight-14")
})

test("uses time-proportional positions and the same x position for duplicate dates", () => {
    const points = [
        point("first", "2026-01-01", 15.4),
        point("same-a", "2026-02-01", 15.5),
        point("same-b", "2026-02-01", 15.3),
        point("latest", "2026-04-01", 15.2),
    ]
    const model = buildVerifiedWeightTrendChartModel(
        visualization(points, {
            low_fact_ids: ["latest"],
            high_fact_ids: ["same-a"],
        })
    )

    assert.equal(model.points[1].x, model.points[2].x)
    assert.ok(model.points[1].x < (model.points[0].x + model.points[3].x) / 2)
    assert.notEqual(model.points[1].y, model.points[2].y)
})

test("uses concentric markers when duplicate facts share date and value", () => {
    const points = [
        point("same-a", "2026-02-01", 15.4),
        point("same-b", "2026-02-01", 15.4),
    ]
    const model = buildVerifiedWeightTrendChartModel(
        visualization(points, {
            low_fact_ids: ["same-a", "same-b"],
            high_fact_ids: ["same-a", "same-b"],
        })
    )

    assert.equal(model.points[0].x, model.points[1].x)
    assert.equal(model.points[0].y, model.points[1].y)
    assert.notEqual(model.points[0].radius, model.points[1].radius)
    assert.equal(model.points[0].coincident_reading_count, 2)
})

test("defaults to pounds while retaining the canonical kg geometry", () => {
    const points = [
        point("first", "2026-01-01", 15.4),
        point("latest", "2026-02-01", 15.45),
    ]
    const model = buildVerifiedWeightTrendChartModel(
        visualization(points, {
            low_fact_ids: ["first"],
            high_fact_ids: ["latest"],
        })
    )

    assert.ok(model.y_domain.max - model.y_domain.min >= 1)
    assert.equal(model.display_unit, "lb")
    assert.equal(model.canonical_unit, "kg")
    assert.equal(model.summary_metrics[0].value, "34.06 lb")
    assert.equal(model.summary_metrics[0].secondary, "15.45 kg")
    assert.match(model.scale_label, /^Scale .* lb$/)
    assert.deepEqual(
        model.y_ticks.map((tick) => tick.label.endsWith(" lb")),
        [true, true, true]
    )
})

test("switches deterministic display labels to kg without changing positions", () => {
    const points = [
        point("first", "2026-01-01", 15.4),
        point("latest", "2026-02-01", 15.45),
    ]
    const payload = visualization(points, {
        low_fact_ids: ["first"],
        high_fact_ids: ["latest"],
    })
    const pounds = buildVerifiedWeightTrendChartModel(payload)
    const kilograms = buildVerifiedWeightTrendChartModel(payload, [], {
        displayUnit: "kg",
    })

    assert.equal(kilograms.display_unit, "kg")
    assert.equal(kilograms.summary_metrics[0].value, "15.45 kg")
    assert.equal(kilograms.summary_metrics[0].secondary, "34.06 lb")
    assert.match(kilograms.scale_label, /^Scale .* kg$/)
    assert.deepEqual(
        kilograms.y_ticks.map((tick) => tick.label.endsWith(" kg")),
        [true, true, true]
    )
    assert.deepEqual(
        kilograms.points.map(({ x, y }) => ({ x, y })),
        pounds.points.map(({ x, y }) => ({ x, y }))
    )
})

test("provides source-aware accessible labels for latest, high, and low points", () => {
    const points = [
        point("first", "2026-01-01", 15.4),
        point("high", "2026-02-01", 16),
        point("latest", "2026-03-01", 15.2),
    ]
    const model = buildVerifiedWeightTrendChartModel(
        visualization(points, {
            low_fact_ids: ["latest"],
            high_fact_ids: ["high"],
        })
    )

    assert.match(
        model.points.find((item) => item.fact_id === "latest").accessible_label,
        /Latest verified reading; lowest verified reading/i
    )
    assert.match(
        model.points.find((item) => item.fact_id === "high").accessible_label,
        /Highest verified reading/i
    )
    assert.ok(model.points.every((item) => item.source_url))
})

test("renders one reading without a manufactured trend line", () => {
    const only = point("only", "2026-08-03", 15.2)
    const model = buildVerifiedWeightTrendChartModel(
        visualization([only], {
            low_fact_ids: ["only"],
            high_fact_ids: ["only"],
        })
    )

    assert.equal(model.path, null)
    assert.equal(model.summary_metrics.length, 1)
    assert.equal(model.summary_metrics[0].label, "Verified reading")
    assert.match(model.accessible_label, /does not establish a trend/i)
})

test("draws equal readings as a horizontal factual line", () => {
    const points = [
        point("same-a", "2026-01-01", 15.4),
        point("same-b", "2026-02-01", 15.4),
        point("same-c", "2026-03-01", 15.4),
    ]
    const model = buildVerifiedWeightTrendChartModel(
        visualization(points, {
            low_fact_ids: points.map((item) => item.fact_id),
            high_fact_ids: points.map((item) => item.fact_id),
        })
    )

    assert.ok(model.points.every((item) => item.y === model.points[0].y))
    assert.match(model.path, /^M .* L .* L /)
})

test("rejects absent or unsupported visualization payloads", () => {
    assert.equal(isVerifiedWeightTrendVisualization(null), false)
    assert.equal(
        isVerifiedWeightTrendVisualization({
            schema_version: 1,
            type: "other_chart",
            unit: "kg",
            points: [],
            summary: {},
        }),
        false
    )
    assert.equal(
        isVerifiedWeightTrendVisualization(
            visualization([point("only", "2026-08-03", 15.2)], {
                latest_fact_id: "missing-fact",
            })
        ),
        false
    )
    assert.equal(buildVerifiedWeightTrendChartModel(null), null)
})
