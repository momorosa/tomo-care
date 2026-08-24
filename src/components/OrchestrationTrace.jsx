import { getOrchestrationTracePresentation } from "../lib/orchestrationTracePresentation.js"

export default function OrchestrationTrace({ trace }) {
    const presentation = getOrchestrationTracePresentation(trace)

    if (!presentation) return null

    const specialistDetails = [
        presentation.specialistVersion
            ? `v${presentation.specialistVersion}`
            : null,
        presentation.specialistStatusLabel,
    ]
        .filter(Boolean)
        .join(" · ")

    return (
        <details
            className="tomo-orchestration-trace"
            aria-label="Tomo orchestration trace"
        >
            <summary className="tomo-orchestration-trace__summary">
                <span>
                    <span className="tomo-orchestration-trace__eyebrow">
                        How Tomo handled this
                    </span>
                    <span className="tomo-orchestration-trace__result">
                        {presentation.resultLabel}
                    </span>
                </span>
                <span
                    className="tomo-orchestration-trace__chevron"
                    aria-hidden="true"
                >
                    ›
                </span>
            </summary>

            <div
                className="tomo-orchestration-trace__route"
                role="list"
                aria-label="Route used for this response"
            >
                <RouteNode
                    kind="manager"
                    marker="T"
                    label="Manager"
                    title={presentation.managerLabel}
                    detail={presentation.decisionLabel}
                />

                {presentation.delegated && (
                    <>
                        <RouteConnector label="selected" />
                        <RouteNode
                            kind="specialist"
                            marker="S"
                            label="Specialist"
                            title={presentation.specialistLabel}
                            detail={specialistDetails}
                        />
                    </>
                )}

                <RouteConnector
                    label={presentation.delegated ? "checked" : "used"}
                />
                <RouteNode
                    kind="evidence"
                    marker="E"
                    label="Bounded evidence"
                    title={presentation.evidenceLabel}
                />

                <RouteConnector label="returned" />
                <RouteNode
                    kind="result"
                    tone={presentation.resultTone}
                    marker={getResultMarker(presentation.resultTone)}
                    label="Result"
                    title={presentation.resultLabel}
                />
            </div>

            {presentation.recoveryLabel && (
                <p className="tomo-orchestration-trace__recovery">
                    <span>Reused safely</span>
                    {presentation.recoveryLabel}
                </p>
            )}

            <section
                className="tomo-orchestration-trace__boundary"
                aria-label="Human control boundary"
            >
                <span
                    className="tomo-orchestration-trace__boundary-marker"
                    aria-hidden="true"
                >
                    H
                </span>
                <span>
                    <strong>Human control</strong>
                    <span>{presentation.humanControl}</span>
                </span>
            </section>
        </details>
    )
}

function RouteNode({
    kind,
    marker,
    label,
    title,
    detail = null,
    tone = null,
}) {
    const toneClass = tone
        ? ` tomo-orchestration-trace__node--${tone}`
        : ""

    return (
        <div
            className={`tomo-orchestration-trace__node tomo-orchestration-trace__node--${kind}${toneClass}`}
            role="listitem"
        >
            <span
                className="tomo-orchestration-trace__node-marker"
                aria-hidden="true"
            >
                {marker}
            </span>
            <span className="tomo-orchestration-trace__node-copy">
                <span>{label}</span>
                <strong>{title}</strong>
                {detail && <span>{detail}</span>}
            </span>
        </div>
    )
}

function RouteConnector({ label }) {
    return (
        <div className="tomo-orchestration-trace__connector" aria-hidden="true">
            <span>{label}</span>
        </div>
    )
}

function getResultMarker(tone) {
    if (tone === "success") return "✓"
    if (tone === "warning") return "?"
    return "•"
}
