import { useId, useMemo, useState } from "react"

import { buildVerifiedWeightTrendChartModel } from "./verifiedWeightTrendPresentation.js"

export default function VerifiedWeightTrendChart({
    visualization,
    citations = [],
}) {
    const chartId = useId()
    const [selectedFactId, setSelectedFactId] = useState(null)
    const [displayUnit, setDisplayUnit] = useState("lb")
    const model = useMemo(
        () =>
            buildVerifiedWeightTrendChartModel(visualization, citations, {
                displayUnit,
            }),
        [visualization, citations, displayUnit]
    )

    if (!model) return null

    const selectedPoint =
        model.points.find((point) => point.fact_id === selectedFactId) ||
        model.points.find(
            (point) => point.fact_id === model.latest_fact_id
        ) ||
        model.points.at(-1)
    const titleId = `${chartId}-title`
    const descriptionId = `${chartId}-description`

    function selectPoint(point) {
        setSelectedFactId(point.fact_id)
    }

    function handlePointKeyDown(event, point) {
        if (event.key !== "Enter" && event.key !== " ") return

        event.preventDefault()
        selectPoint(point)
    }

    return (
        <section
            className="tomo-weight-trend"
            aria-labelledby={titleId}
        >
            <header className="tomo-weight-trend__header">
                <div>
                    <p className="tomo-section-label">Verified history</p>
                    <h3 id={titleId}>Momo’s weight</h3>
                </div>
                <div className="tomo-weight-trend__header-actions">
                    <p className="tomo-weight-trend__count">
                        {model.points.length} verified{" "}
                        {model.points.length === 1 ? "reading" : "readings"}
                    </p>
                    <div
                        className="tomo-weight-trend__unit-switch"
                        role="group"
                        aria-label="Weight display unit"
                    >
                        {["lb", "kg"].map((unit) => (
                            <button
                                key={unit}
                                type="button"
                                aria-pressed={displayUnit === unit}
                                onClick={() => setDisplayUnit(unit)}
                            >
                                {unit}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="tomo-weight-trend__summary">
                {model.summary_metrics.map((metric) => (
                    <button
                        key={metric.label}
                        type="button"
                        className={`tomo-weight-trend__metric ${
                            metric.fact_id === selectedPoint.fact_id
                                ? "tomo-weight-trend__metric--selected"
                                : ""
                        }`}
                        aria-pressed={metric.fact_id === selectedPoint.fact_id}
                        onClick={() => setSelectedFactId(metric.fact_id)}
                    >
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <small>
                            {metric.secondary} · {metric.detail}
                        </small>
                    </button>
                ))}
            </div>

            <div className="tomo-weight-trend__plot-wrap">
                <div className="tomo-weight-trend__legend" aria-label="Chart point key">
                    <span>
                        <i className="tomo-weight-trend__legend-dot" aria-hidden="true" />
                        Verified reading
                    </span>
                    <span>
                        <i
                            className="tomo-weight-trend__legend-dot tomo-weight-trend__legend-dot--selected"
                            aria-hidden="true"
                        />
                        Selected
                    </span>
                </div>
                <svg
                    className="tomo-weight-trend__plot"
                    viewBox="0 0 640 280"
                    role="group"
                    aria-labelledby={`${titleId} ${descriptionId}`}
                >
                    <desc id={descriptionId}>{model.accessible_label}</desc>

                    {model.y_ticks.map((tick) => (
                        <g key={tick.value} aria-hidden="true">
                            <line
                                className="tomo-weight-trend__grid"
                                x1="58"
                                x2="616"
                                y1={tick.y}
                                y2={tick.y}
                            />
                            <text
                                className="tomo-weight-trend__axis-label"
                                x="50"
                                y={tick.y + 4}
                                textAnchor="end"
                            >
                                {tick.label}
                            </text>
                        </g>
                    ))}

                    {model.x_ticks.map((tick) => (
                        <text
                            key={tick.fact_date}
                            className="tomo-weight-trend__axis-label"
                            x={tick.x}
                            y="256"
                            textAnchor="middle"
                            aria-hidden="true"
                        >
                            {tick.label}
                        </text>
                    ))}

                    {model.path && (
                        <path
                            className="tomo-weight-trend__line"
                            d={model.path}
                            aria-hidden="true"
                        />
                    )}

                    {model.points.map((point) => {
                        const selected = point.fact_id === selectedPoint.fact_id

                        return (
                            <circle
                                key={point.fact_id}
                                className={`tomo-weight-trend__point ${
                                    selected
                                        ? "tomo-weight-trend__point--selected"
                                        : ""
                                }`}
                                cx={point.x}
                                cy={point.y}
                                r={point.radius}
                                role="button"
                                tabIndex="0"
                                aria-label={point.accessible_label}
                                aria-pressed={selected}
                                onClick={() => selectPoint(point)}
                                onFocus={() => selectPoint(point)}
                                onKeyDown={(event) =>
                                    handlePointKeyDown(event, point)
                                }
                            />
                        )
                    })}
                </svg>
                <p className="tomo-weight-trend__scale">{model.scale_label}</p>
            </div>

            <div
                className="tomo-weight-trend__selected"
                aria-live="polite"
                aria-atomic="true"
            >
                <div
                    key={selectedPoint.fact_id}
                    className="tomo-weight-trend__selected-content"
                >
                    <p className="tomo-section-label">Selected reading</p>
                    <p className="tomo-weight-trend__selected-value">
                        {selectedPoint.accessible_label.replace(
                            " Select to review its verified source.",
                            ""
                        )}
                    </p>
                    <p className="tomo-weight-trend__source">
                        Source: {selectedPoint.citation?.source_title || "Verified TomoCare record"}
                    </p>
                </div>
                <div className="tomo-weight-trend__actions">
                    {selectedPoint.source_url ? (
                        <a
                            className="tomo-btn tomo-btn-secondary px-3 py-1.5 text-xs"
                            href={selectedPoint.source_url}
                        >
                            Open verification record
                        </a>
                    ) : (
                        <span className="text-xs text-tomo-text">
                            Source link unavailable
                        </span>
                    )}
                </div>
            </div>
        </section>
    )
}
