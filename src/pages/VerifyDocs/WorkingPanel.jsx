import { useEffect, useMemo, useRef } from "react"
import { formatDisplayDate } from "../../lib/displayDate.js"
import { formatDisplayMoney } from "./formatDisplayMoney.js"
import { stopWheelIfScrollable } from "./stopWheelIfScrollable.js"
import { isLegacyVerificationReview } from "./triageReviewState.js"
import {
    getVerificationRecoveryPresentation,
    shouldOfferVerificationRecheck,
} from "./verificationRecoveryPresentation.js"
import OrchestrationTrace from "../../components/OrchestrationTrace.jsx"
import VaccineEvidenceBlock from "./VaccineEvidenceBlock.jsx"

// ─────────────────────────────────────────────
// Triage helpers
// ─────────────────────────────────────────────

function buildTriageMap(triageResult) {
    const map = {}

    if (!triageResult?.fields) return map

    for (const f of triageResult.fields) {
        map[f.path] = f
    }

    return map
}

const STATE_LABELS = {
    "auto-confirmed": "Confirmed",
    "needs-confirmation": "Needs review",
    "unreadable-source": "Unreadable source",
    consistent_pattern: "Consistent",
    new_or_limited_history: "Limited history",
    changed_from_pattern: "Changed",
    conflict_or_uncertainty: "Check this",
    not_captured: "Not captured",
    manual_review: "Manual review",
    historical_review: "Historical review",
    accepted: "Accepted",
    verified: "Verified",
}

const STATE_BADGE = {
    "auto-confirmed": "tomo-badge--success",
    "needs-confirmation": "tomo-badge--warning",
    "unreadable-source": "tomo-badge--danger",
    consistent_pattern: "tomo-badge--success",
    new_or_limited_history: "tomo-badge--neutral",
    changed_from_pattern: "tomo-badge--warning",
    conflict_or_uncertainty: "tomo-badge--danger",
    not_captured: "tomo-badge--neutral",
    manual_review: "tomo-badge--warning",
    historical_review: "tomo-badge--neutral",
    accepted: "tomo-badge--success",
    verified: "tomo-badge--success",
}

// Card tint (background + border) per state, driven by the semantic status
// tokens so flagged/confirmed cards stay consistent with the badges.
const STATE_CARD_CLASS = {
    "needs-confirmation": "tomo-review-card--needs-review",
    "unreadable-source": "tomo-review-card--unreadable",
    changed_from_pattern: "tomo-review-card--needs-review",
    conflict_or_uncertainty: "tomo-review-card--unreadable",
    manual_review: "tomo-review-card--needs-review",
    accepted: "tomo-review-card--accepted",
}

function reviewState(field) {
    return field?.outcome || field?.state || null
}

function isAttentionField(field) {
    return (
        field?.blocks_approval === true ||
        field?.outcome === "changed_from_pattern" ||
        field?.outcome === "conflict_or_uncertainty" ||
        field?.outcome === "manual_review" ||
        field?.state === "needs-confirmation" ||
        field?.state === "unreadable-source"
    )
}

function isContextField(field) {
    return (
        field?.outcome === "consistent_pattern" ||
        field?.outcome === "new_or_limited_history" ||
        field?.state === "auto-confirmed"
    )
}

function displayReviewValue(value) {
    if (value == null || value === "") return "—"
    if (Array.isArray(value)) return value.join(", ") || "—"
    if (typeof value !== "object") return String(value)
    if (value.label && value.amount != null) {
        return `${value.label} · $${Number(value.amount).toFixed(2)}`
    }
    if (value.value != null && value.unit) {
        return `${value.value} ${value.unit}`
    }
    if (value.calculated_line_total != null) {
        return `Calculated $${Number(value.calculated_line_total).toFixed(2)}${
            value.source_paid_total != null
                ? ` · source $${Number(value.source_paid_total).toFixed(2)}`
                : " · source total missing"
        }`
    }
    return JSON.stringify(value)
}

function displayReviewLabel(path) {
    const labels = {
        "checks.date_consistency": "Visit and line-item dates",
        "checks.invoice_arithmetic": "Invoice total",
        "checks.weight_comparison": "Weight comparison",
        invoice_id: "Invoice number",
        doc_date: "Document date",
        source_org: "Clinic",
        summary: "Visit summary",
        "totals.paid": "Paid total",
    }
    if (labels[path]) return labels[path]

    const costMatch = path.match(
        /cost_items\[(\d+)\]\.(label|amount|service_date)/
    )
    if (costMatch) {
        const suffix = {
            label: "description",
            amount: "amount",
            service_date: "date",
        }[costMatch[2]]
        return `Line item ${Number(costMatch[1]) + 1} ${
            suffix
        }`
    }

    const patternMatch = path.match(/patterns\.cost_items\[(\d+)\]/)
    if (patternMatch) {
        return `Repeated line item ${Number(patternMatch[1]) + 1}`
    }

    if (path === "weight_measurement.value") return "Weight value"
    if (path === "weight_measurement.unit") return "Weight unit"
    if (path === "weight_measurement.measured_date") return "Weight date"
    const eventMatch = path.match(
        /events\[(\d+)\]\.(event_type|event_date|description)/
    )
    if (eventMatch) {
        const suffix = {
            event_type: "type",
            event_date: "date",
            description: "description",
        }[eventMatch[2]]
        return `Care event ${Number(eventMatch[1]) + 1} ${suffix}`
    }
    return "Review item"
}

function getValueAtPath(value, path) {
    const parts = String(path || "")
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean)

    return parts.reduce((current, part) => current?.[part], value)
}

function TriageBadge({ state }) {
    if (!state) return null

    return (
        <span className={`tomo-badge ${STATE_BADGE[state] || "tomo-badge--neutral"}`}>
            {STATE_LABELS[state] || state}
        </span>
    )
}

function ReviewStatusBadge({ state, accepted = false, isVerified = false }) {
    if (isVerified || accepted) {
        return <TriageBadge state="accepted" />
    }

    return <TriageBadge state={state} />
}

function TriageReason({ reason }) {
    if (!reason) return null

    return (
        <p className="mt-2 text-[11px] leading-relaxed text-tomo-text">
            {reason}
        </p>
    )
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function WorkingPanel({
    tab,
    setTab,
    extracted,
    rawText,
    detailJson,
    counts,
    error,
    isVerified = false,
    editMode = false,
    draftExtracted = null,
    editTargetPath = null,
    dirty = false,
    validationErrors = {},
    onStartEdit = null,
    onCancelEdit = null,
    onSaveDraft = null,
    onSaveAndVerify = null,
    onUpdateInvoiceId = null,
    onUpdateSourceOrg = null,
    onUpdateDocDate = null,
    onUpdateWeightMeasurement = null,
    onUpdateVaccineEvidence = null,
    onAddRabiesEvidence = null,
    onRemoveVaccineEvidence = null,
    onUpdateEvent = null,
    onAddEvent = null,
    onRemoveEvent = null,
    onUpdateCostItem = null,
    onAddCostItem = null,
    onRemoveCostItem = null,
    triageResult = null,
    orchestrationTrace = null,
    triageLoading = false,
    triageFailure = null,
    acceptedPaths = new Set(),
    onAcceptField = null,
    onAcceptAllConfirmed = null,
    onRetryReview = null,
    onReviewLater = null,
}) {
    const data = editMode ? draftExtracted || {} : extracted || {}
    const reviewBodyRef = useRef(null)

    const triageMap = useMemo(() => buildTriageMap(triageResult), [triageResult])

    const hasTriage =
        triageResult &&
        Array.isArray(triageResult.fields) &&
        triageResult.fields.length > 0

    const isLegacyReview = isLegacyVerificationReview({
        triageResult,
        isVerified,
    })

    const flaggedCount = useMemo(() => {
        if (!hasTriage) return 0
        if (isVerified) return 0

        return triageResult.fields.filter(isAttentionField).length
    }, [triageResult, hasTriage, isVerified])

    const rawFlaggedCount = useMemo(() => {
        if (!hasTriage) return 0

        return triageResult.fields.filter(isAttentionField).length
    }, [triageResult, hasTriage])

    const confirmedCount = useMemo(() => {
        if (!hasTriage) return 0
        return triageResult.fields.filter(isContextField).length
    }, [triageResult, hasTriage])

    const reviewedFieldCount = hasTriage ? triageResult.fields.length : 0
    const recovery = useMemo(
        () =>
            getVerificationRecoveryPresentation({
                triageResult,
                triageFailure,
            }),
        [triageResult, triageFailure]
    )
    const showVerificationRecheck = shouldOfferVerificationRecheck({
        isVerified,
        editMode,
        hasCandidateData: Object.keys(data).length > 0,
        recovery,
    })

    function continueManualReview() {
        setTab("fields")
        window.requestAnimationFrame(() => {
            reviewBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            reviewBodyRef.current?.focus()
        })
    }

    return (
        <div className="col-span-12 md:col-span-3 min-h-0 rounded-xl tomo-surface flex flex-col">
            <div className="shrink-0 px-4 py-3 border-b border-tomo-border">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-tomo-text-h">Working panel</p>
                    <p className="text-[11px] text-tomo-text">
                        events {counts.events} · costs {counts.cost_items} · facts{" "}
                        {counts.facts || 0}
                    </p>
                </div>

                {triageLoading && (
                    <div className="mt-2 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-2 border-tomo-accent border-t-transparent animate-spin" />
                        <p className="text-[11px] text-tomo-text">
                            AI reviewer is checking extraction…
                        </p>
                    </div>
                )}

                {hasTriage && !triageLoading && isVerified && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-tomo-border px-3 py-2.5 bg-[rgba(255,255,255,0.025)]">
                        <TriageBadge
                            state={
                                isLegacyReview
                                    ? "historical_review"
                                    : "verified"
                            }
                        />
                        <p className="text-[11px] text-tomo-text">
                            {isLegacyReview
                                ? `${reviewedFieldCount} legacy review item${
                                      reviewedFieldCount === 1 ? "" : "s"
                                  } preserved`
                                : `${reviewedFieldCount} review item${
                                      reviewedFieldCount === 1 ? "" : "s"
                                  } recorded${
                                      rawFlaggedCount > 0
                                          ? ` · ${rawFlaggedCount} originally flagged`
                                          : ""
                                  }`}
                        </p>
                    </div>
                )}

                {hasTriage && !triageLoading && !isVerified && (
                    <div className="mt-2 flex items-center gap-3">
                        <TriageBadge
                            state={
                                flaggedCount > 0
                                    ? "needs-confirmation"
                                    : "consistent_pattern"
                            }
                        />
                        <p className="text-[11px] text-tomo-text">
                            {flaggedCount > 0
                                ? `${flaggedCount} item${
                                      flaggedCount > 1 ? "s" : ""
                                  } need attention · ${confirmedCount} grouped`
                                : `${confirmedCount} review items grouped`}
                        </p>
                    </div>
                )}

                {triageResult?.history?.unavailable &&
                    !triageLoading &&
                    !isVerified && (
                        <p className="mt-2 text-[11px] text-tomo-warning">
                            Recent verified history is unavailable. No repeated
                            pattern was assumed.
                        </p>
                    )}

                <OrchestrationTrace trace={orchestrationTrace} />

                {recovery && !triageLoading && !isVerified && (
                    <section
                        className="mt-3 rounded-lg border border-tomo-warning/50 bg-tomo-warning/10 px-3 py-3"
                        aria-live="polite"
                    >
                        <p className="text-sm font-medium text-tomo-warning">
                            {recovery.title}
                        </p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-tomo-text-h">
                            {recovery.message}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-tomo-text">
                            {recovery.nextStep}
                        </p>

                        <div className="mt-3 grid gap-2">
                            {recovery.retryable && (
                                <button
                                    className="tomo-btn tomo-btn-secondary w-full"
                                    onClick={onRetryReview || undefined}
                                    disabled={!onRetryReview}
                                >
                                    Retry AI review
                                </button>
                            )}

                            {recovery.manualReviewAvailable && (
                                <button
                                    className="tomo-btn tomo-btn-primary w-full"
                                    onClick={continueManualReview}
                                >
                                    Continue with manual review
                                </button>
                            )}

                            {recovery.reviewLaterAvailable && (
                                <button
                                    className="tomo-btn tomo-btn-secondary w-full"
                                    onClick={onReviewLater || undefined}
                                    disabled={!onReviewLater}
                                >
                                    Review later
                                </button>
                            )}
                        </div>
                    </section>
                )}

                <div
                    className="flex gap-6 mt-4 border-b border-tomo-border"
                    role="tablist"
                    aria-label="Working panel mode"
                >
                    {["fields", "raw", "json"].map((t) => (
                        <button
                            key={t}
                            role="tab"
                            aria-selected={tab === t}
                            className={`tomo-tab ${
                                tab === t ? "tomo-tab--active" : ""
                            }`}
                            onClick={() => setTab(t)}
                        >
                            {t === "fields"
                                ? "Key fields"
                                : t === "raw"
                                  ? "Raw text"
                                  : "JSON"}
                        </button>
                    ))}
                </div>

                {tab === "fields" && (
                    <div className="mt-3">
                        {isVerified && !editMode ? (
                            <div className="rounded-lg border           border-tomo-border px-3 py-2 bg-[rgba(255,255,255,0.025)]">
                                <p className="text-[11px] text-tomo-text">
                                    {isLegacyReview
                                        ? "Verified record · historical review used legacy rules"
                                        : "Verified record · read-only audit view"}
                                </p>
                            </div>
                        ) : !editMode ? (
                            <div className="grid gap-2">
                                <button
                                    className="tomo-btn tomo-btn-secondary w-full"
                                    onClick={() => onStartEdit?.()}
                                    disabled={!onStartEdit || triageLoading}
                                    title="Edit extracted fields (candidate truth)"
                                >
                                    Edit
                                </button>

                                {showVerificationRecheck && (
                                    <>
                                        <button
                                            className="tomo-btn tomo-btn-secondary w-full disabled:opacity-50"
                                            onClick={onRetryReview || undefined}
                                            disabled={
                                                !onRetryReview || triageLoading
                                            }
                                        >
                                            {triageLoading
                                                ? "AI review running…"
                                                : "Recheck with AI"}
                                        </button>
                                        <p className="text-[11px] leading-relaxed text-tomo-text">
                                            Rechecks the saved candidate. It does
                                            not approve or add anything to trusted
                                            records automatically.
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        className="tomo-btn tomo-btn-secondary w-full"
                                        onClick={onCancelEdit || undefined}
                                        disabled={!onCancelEdit}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        className="tomo-btn tomo-btn-secondary w-full disabled:opacity-50"
                                        onClick={onSaveDraft || undefined}
                                        disabled={!onSaveDraft || !dirty}
                                    >
                                        Save draft
                                    </button>

                                    <button
                                        className="tomo-btn tomo-btn-primary w-full disabled:opacity-50"
                                        onClick={onSaveAndVerify || undefined}
                                        disabled={!onSaveAndVerify || !dirty}
                                    >
                                        Save &amp; recheck
                                    </button>
                                </div>

                                <p className="mt-2 text-[11px] text-tomo-text">
                                    Editing candidate truth
                                    {dirty ? " · unsaved changes" : ""}
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <div className="shrink-0 px-4 py-3 text-sm text-red-200 border-b border-tomo-border bg-red-500/10">
                    {error}
                </div>
            )}

            <div
                ref={reviewBodyRef}
                tabIndex={-1}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4"
                onWheel={stopWheelIfScrollable}
            >
                {tab === "fields" && (
                    <FieldsView
                        data={data}
                        editMode={editMode}
                        editTargetPath={editTargetPath}
                        isVerified={isVerified}
                        triageMap={triageMap}
                        hasTriage={hasTriage}
                        isLegacyReview={isLegacyReview}
                        acceptedPaths={acceptedPaths}
                        onAcceptField={onAcceptField}
                        onCorrectField={onStartEdit}
                        onAcceptAllConfirmed={onAcceptAllConfirmed}
                        validationErrors={validationErrors}
                        onUpdateInvoiceId={onUpdateInvoiceId}
                        onUpdateSourceOrg={onUpdateSourceOrg}
                        onUpdateDocDate={onUpdateDocDate}
                        onUpdateWeightMeasurement={onUpdateWeightMeasurement}
                        onUpdateVaccineEvidence={onUpdateVaccineEvidence}
                        onAddRabiesEvidence={onAddRabiesEvidence}
                        onRemoveVaccineEvidence={onRemoveVaccineEvidence}
                        onUpdateEvent={onUpdateEvent}
                        onAddEvent={onAddEvent}
                        onRemoveEvent={onRemoveEvent}
                        onUpdateCostItem={onUpdateCostItem}
                        onAddCostItem={onAddCostItem}
                        onRemoveCostItem={onRemoveCostItem}
                    />
                )}

                {tab === "raw" && (
                    <pre className="whitespace-pre-wrap text-xs text-tomo-text leading-relaxed tomo-code p-3 rounded-lg border border-tomo-border">
                        {rawText || "—"}
                    </pre>
                )}

                {tab === "json" && (
                    <pre className="whitespace-pre-wrap text-xs text-tomo-text leading-relaxed tomo-code p-3 rounded-lg border border-tomo-border">
                        {detailJson || "—"}
                    </pre>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Fields View
// ─────────────────────────────────────────────

function FieldsView({
    data,
    editMode,
    editTargetPath,
    isVerified,
    triageMap,
    hasTriage,
    isLegacyReview,
    acceptedPaths,
    onAcceptField,
    onCorrectField,
    onAcceptAllConfirmed,
    validationErrors,
    onUpdateInvoiceId,
    onUpdateSourceOrg,
    onUpdateDocDate,
    onUpdateWeightMeasurement,
    onUpdateVaccineEvidence,
    onAddRabiesEvidence,
    onRemoveVaccineEvidence,
    onUpdateEvent,
    onAddEvent,
    onRemoveEvent,
    onUpdateCostItem,
    onAddCostItem,
    onRemoveCostItem,
}) {
    if (hasTriage && !editMode && !isLegacyReview) {
        return (
            <div className="space-y-5 pb-6">
                <VaccineEvidenceBlock
                    candidates={data?.vaccine_evidence || []}
                    isVerified={isVerified}
                    triageMap={triageMap}
                    acceptedPaths={acceptedPaths}
                    onAcceptField={onAcceptField}
                />
                <FlaggedFieldsSection
                    data={data}
                    triageMap={triageMap}
                    acceptedPaths={acceptedPaths}
                    onAcceptField={onAcceptField}
                    onCorrectField={onCorrectField}
                    isVerified={isVerified}
                />

                <NotCapturedSection triageMap={triageMap} />

                <ConfirmedFieldsSection
                    data={data}
                    triageMap={triageMap}
                    acceptedPaths={acceptedPaths}
                    onAcceptField={onAcceptField}
                    onAcceptAllConfirmed={onAcceptAllConfirmed}
                    isVerified={isVerified}
                />
            </div>
        )
    }

    return (
        <div className="space-y-5 pb-6">
            {isLegacyReview && (
                <LegacyReviewSection data={data} triageMap={triageMap} />
            )}

            {!editMode ? (
                <Field
                    label="Document date"
                    value={formatDisplayDate(data?.doc_date)}
                    triage={isLegacyReview ? null : triageMap["doc_date"]}
                    isVerified={isVerified}
                />
            ) : (
                <FieldEdit
                    label="Document date"
                    type="date"
                    value={data?.doc_date || ""}
                    error={validationErrors["doc_date"]}
                    onChange={(value) => onUpdateDocDate?.(value)}
                />
            )}

            {!editMode ? (
                <Field
                    label="Invoice"
                    value={data?.invoice_id}
                    triage={
                        isLegacyReview ? null : triageMap["invoice_id"]
                    }
                    isVerified={isVerified}
                />
            ) : (
                <FieldEdit
                    label="Invoice"
                    value={data?.invoice_id || ""}
                    placeholder="e.g., i-11250003597"
                    error={validationErrors["invoice_id"]}
                    onChange={(v) => onUpdateInvoiceId && onUpdateInvoiceId(v)}
                />
            )}

            {!editMode ? (
                <Field
                    label="Clinic"
                    value={data?.source_org}
                    triage={
                        isLegacyReview ? null : triageMap["source_org"]
                    }
                    isVerified={isVerified}
                />
            ) : (
                <FieldEdit
                    label="Clinic"
                    value={data?.source_org || ""}
                    placeholder="e.g., SoMa Animal Hospital"
                    error={validationErrors["source_org"]}
                    onChange={(value) =>
                        onUpdateSourceOrg?.(value)
                    }
                    focusOnMount={editTargetPath === "source_org"}
                />
            )}

            <Field
                label="Paid"
                value={
                    data?.totals?.paid != null
                        ? formatDisplayMoney(
                              data.totals.paid,
                              data?.totals?.currency
                          )
                        : null
                }
                triage={isLegacyReview ? null : triageMap["totals.paid"]}
                isVerified={isVerified}
            />

            <WeightMeasurementBlock
                measurement={data?.weight_measurement || null}
                editMode={editMode}
                isVerified={isVerified}
                triageMap={isLegacyReview ? {} : triageMap}
                errors={validationErrors}
                fallbackDate={data?.doc_date || ""}
                onUpdate={onUpdateWeightMeasurement}
            />

            <VaccineEvidenceBlock
                candidates={data?.vaccine_evidence || []}
                editMode={editMode}
                isVerified={isVerified}
                triageMap={isLegacyReview ? {} : triageMap}
                errors={validationErrors}
                onUpdate={onUpdateVaccineEvidence}
                onAdd={onAddRabiesEvidence}
                onRemove={onRemoveVaccineEvidence}
            />

            <Field
                label="Summary"
                value={data?.summary}
                triage={isLegacyReview ? null : triageMap["summary"]}
                isVerified={isVerified}
            />

            <EventsBlock
                editMode={editMode}
                isVerified={isVerified}
                events={data?.events || []}
                errors={validationErrors}
                triageMap={isLegacyReview ? {} : triageMap}
                onAdd={onAddEvent}
                onRemove={onRemoveEvent}
                onUpdate={onUpdateEvent}
            />

            <CostItemsBlock
                editMode={editMode}
                isVerified={isVerified}
                costItems={data?.cost_items || []}
                errors={validationErrors}
                triageMap={isLegacyReview ? {} : triageMap}
                onAdd={onAddCostItem}
                onRemove={onRemoveCostItem}
                onUpdate={onUpdateCostItem}
            />
        </div>
    )
}

function LegacyReviewSection({ data, triageMap }) {
    const items = Object.values(triageMap)

    if (!items.length) return null

    return (
        <details className="group">
            <summary className="cursor-pointer list-none">
                <div className="p-3 rounded-lg border border-tomo-border hover:border-tomo-border/80 transition-colors">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-tomo-text group-open:rotate-90 transition-transform">
                            ▶
                        </span>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-tomo-text">
                            Historical review details · {items.length}
                        </p>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-tomo-text">
                        Preserved from the rules used when this document was
                        verified. This is not a current risk-weighted assessment.
                    </p>
                </div>
            </summary>

            <div className="mt-2 space-y-1">
                {items.map((field) => (
                    <div
                        key={field.path}
                        className="px-3 py-2 rounded-lg tomo-subtle-row"
                    >
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-mono text-tomo-text break-all">
                                {displayReviewLabel(field.path)}
                            </p>
                            <TriageBadge state="accepted" />
                        </div>
                        <p className="text-sm text-tomo-text-h break-words">
                            {displayReviewValue(
                                field.extracted_value ??
                                    getValueAtPath(data, field.path)
                            )}
                        </p>
                        <TriageReason reason={field.reason} />
                    </div>
                ))}
            </div>
        </details>
    )
}

function NotCapturedSection({ triageMap }) {
    const items = Object.values(triageMap).filter(
        (field) => field.outcome === "not_captured"
    )

    if (!items.length) return null

    return (
        <div>
            <p className="tomo-section-label mb-3">
                Seen in source · not captured
            </p>
            <div className="space-y-2">
                {items.map((field) => (
                    <div
                        key={field.path}
                        className="tomo-review-card border-tomo-border"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-tomo-text-h">
                                {displayReviewValue(field.extracted_value)}
                            </p>
                            <TriageBadge state="not_captured" />
                        </div>
                        <TriageReason reason={field.reason} />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Flagged fields
// ─────────────────────────────────────────────

function FlaggedFieldsSection({
    triageMap,
    acceptedPaths,
    onAcceptField,
    onCorrectField,
    isVerified,
}) {
    const flagged = Object.values(triageMap)
        .filter(isAttentionField)
        .filter((field) => field.group !== "vaccine_evidence")

    if (flagged.length === 0) {
        return (
            <div className="p-3 rounded-lg border border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)]">
                <p className="text-sm text-tomo-success">
                    {isVerified
                        ? "No fields were escalated during review."
                        : "All fields look good. Review the confirmed summary below, then approve."}
                </p>
            </div>
        )
    }

    return (
        <div>
            <p className="tomo-section-label mb-3">
                {isVerified
                    ? `Accepted review flags · ${flagged.length} field${
                          flagged.length > 1 ? "s" : ""
                      }`
                    : `Needs your review · ${flagged.length} field${
                          flagged.length > 1 ? "s" : ""
                      }`}
            </p>

            <div className="space-y-2">
                {flagged.map((f) => {
                    const accepted = isVerified || acceptedPaths.has(f.path)

                    const cardClass = accepted
                        ? STATE_CARD_CLASS.accepted
                        : STATE_CARD_CLASS[reviewState(f)] ||
                          STATE_CARD_CLASS["needs-confirmation"]

                    return (
                        <div
                            key={f.path}
                            className={`tomo-review-card ${cardClass}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-xs font-mono text-tomo-accent break-all">
                                            {displayReviewLabel(f.path)}
                                        </p>

                                        <ReviewStatusBadge
                                            state={reviewState(f)}
                                            accepted={accepted}
                                            isVerified={isVerified}
                                        />
                                    </div>

                                    <p className="text-sm font-medium text-tomo-text-h break-words">
                                        {displayReviewValue(f.extracted_value)}
                                    </p>

                                    <TriageReason reason={f.reason} />
                                </div>

                                {!accepted && (
                                    <div className="flex shrink-0 flex-col gap-2">
                                        {f.path === "source_org" && (
                                            <button
                                                className="text-xs px-3 py-1.5 rounded-full border border-tomo-border text-tomo-text-h hover:border-tomo-accent"
                                                onClick={() =>
                                                    onCorrectField?.(f.path)
                                                }
                                            >
                                                Correct
                                            </button>
                                        )}
                                        <button
                                            className="text-xs px-3 py-1.5 rounded-full border transition-colors border-[color:var(--tomo-success-border)] text-tomo-success hover:bg-[var(--tomo-success-bg)]"
                                            onClick={() => onAcceptField?.(f.path)}
                                        >
                                            Accept
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Grouped nonblocking review context
// ─────────────────────────────────────────────

function ConfirmedFieldsSection({
    triageMap,
    acceptedPaths,
    onAcceptField,
    onAcceptAllConfirmed,
    isVerified,
}) {
    const confirmed = Object.values(triageMap)
        .filter(isContextField)
        .filter((field) => field.group !== "vaccine_evidence")

    if (confirmed.length === 0) return null

    const legacyConfirmed = confirmed.filter(
        (field) => field.state === "auto-confirmed" && !field.outcome
    )
    const allAccepted =
        isVerified ||
        legacyConfirmed.length === 0 ||
        legacyConfirmed.every((field) => acceptedPaths.has(field.path))

    return (
        <details className="group">
            <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between p-3 rounded-lg border border-tomo-border hover:border-tomo-border/80 transition-colors">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-tomo-text group-open:rotate-90 transition-transform">
                            ▶
                        </span>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-tomo-text">
                            {isVerified
                                ? `Accepted review context · ${confirmed.length}`
                                : `Grouped review context · ${confirmed.length}`}
                        </p>

                        {allAccepted && (
                            <span className="text-[10px] text-tomo-success">
                                {legacyConfirmed.length > 0
                                    ? "All accepted"
                                    : "No action needed"}
                            </span>
                        )}
                    </div>

                    {!isVerified && !allAccepted && legacyConfirmed.length > 0 && (
                        <button
                            className="text-xs px-3 py-1 rounded-full border transition-colors border-[color:var(--tomo-success-border)] text-tomo-success hover:bg-[var(--tomo-success-bg)]"
                            onClick={(e) => {
                                e.preventDefault()
                                onAcceptAllConfirmed?.()
                            }}
                        >
                            Accept all
                        </button>
                    )}
                </div>
            </summary>

            <div className="mt-2 space-y-1">
                {confirmed.map((f) => {
                    const requiresAcceptance =
                        f.state === "auto-confirmed" && !f.outcome
                    const accepted =
                        isVerified ||
                        !requiresAcceptance ||
                        acceptedPaths.has(f.path)

                    return (
                        <div
                            key={f.path}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg tomo-subtle-row"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-mono text-tomo-text break-all">
                                        {displayReviewLabel(f.path)}
                                    </p>
                                    <TriageBadge state={reviewState(f)} />
                                </div>

                                <p className="text-sm text-tomo-text-h truncate">
                                    {displayReviewValue(f.extracted_value)}
                                </p>
                                <TriageReason reason={f.reason} />
                            </div>

                            {!accepted && requiresAcceptance && (
                                <button
                                    className="shrink-0 text-[11px] px-2 py-1 rounded-full border border-tomo-border text-tomo-text hover:text-tomo-text-h transition-colors"
                                    onClick={() => onAcceptField?.(f.path)}
                                >
                                    Accept
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </details>
    )
}

// ─────────────────────────────────────────────
// Shared field components
// ─────────────────────────────────────────────

function Field({ label, value, triage, isVerified = false }) {
    return (
        <div>
            <div className="flex items-center gap-2">
                <p className="text-xs text-tomo-text">{label}</p>
                {triage && (
                    <ReviewStatusBadge
                        state={reviewState(triage)}
                        accepted={isVerified}
                        isVerified={isVerified}
                    />
                )}
            </div>

            <p className="text-sm text-tomo-text-h">{value || "—"}</p>

            {triage && <TriageReason reason={triage.reason} />}
        </div>
    )
}

function FieldEdit({
    label,
    value,
    onChange,
    placeholder,
    error,
    type = "text",
    focusOnMount = false,
}) {
    const inputRef = useRef(null)

    useEffect(() => {
        if (!focusOnMount || !inputRef.current) return
        inputRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
        inputRef.current.focus()
    }, [focusOnMount])

    return (
        <div>
            <p className="text-xs text-tomo-text">{label}</p>

            <input
                ref={inputRef}
                type={type}
                className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange?.(e.target.value)}
            />

            {error && <p className="text-xs text-red-200 mt-1">{error}</p>}
        </div>
    )
}

function WeightMeasurementBlock({
    measurement,
    editMode,
    isVerified,
    triageMap,
    errors,
    fallbackDate,
    onUpdate,
}) {
    const valuePath = "weight_measurement.value"
    const unitPath = "weight_measurement.unit"
    const datePath = "weight_measurement.measured_date"
    const triage =
        triageMap[valuePath] || triageMap[unitPath] || triageMap[datePath]

    if (!measurement && !editMode) return null

    if (!measurement && editMode) {
        return (
            <div>
                <p className="text-xs text-tomo-text">Weight measurement</p>
                <button
                    type="button"
                    className="mt-2 text-xs px-2 py-1 rounded-md border border-tomo-border text-tomo-text hover:text-tomo-text-h"
                    onClick={() =>
                        onUpdate?.({
                            value: "",
                            unit: "kg",
                            measured_date: fallbackDate,
                            source_label: "Manually verified weight",
                            extraction_method: "manual_verified_weight",
                        })
                    }
                >
                    + Add weight
                </button>
            </div>
        )
    }

    if (!editMode) {
        return (
            <div className="p-2 rounded-lg border border-tomo-border">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-tomo-text-h">
                        Weight · {measurement.value} {measurement.unit}
                    </p>
                    {triage && (
                        <ReviewStatusBadge
                            state={reviewState(triage)}
                            accepted={isVerified}
                            isVerified={isVerified}
                        />
                    )}
                </div>
                <p className="text-xs text-tomo-text">
                    Measured {formatDisplayDate(measurement.measured_date)}
                </p>
                {measurement.source_context && (
                    <p className="mt-1 text-[11px] leading-relaxed text-tomo-text">
                        Source: {measurement.source_context}
                    </p>
                )}
                {triage && <TriageReason reason={triage.reason} />}
            </div>
        )
    }

    return (
        <div className="p-3 rounded-lg border border-tomo-border space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-tomo-text">Weight measurement</p>
                <button
                    type="button"
                    className="text-xs text-tomo-text hover:text-red-200"
                    onClick={() => onUpdate?.(null)}
                >
                    Remove
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-tomo-text">Value</label>
                    <input
                        className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                        value={measurement.value ?? ""}
                        onChange={(event) =>
                            onUpdate?.({ value: event.target.value })
                        }
                    />
                    {errors[valuePath] && (
                        <p className="text-xs text-red-200 mt-1">
                            {errors[valuePath]}
                        </p>
                    )}
                </div>

                <div>
                    <label className="text-xs text-tomo-text">Unit</label>
                    <select
                        className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                        value={measurement.unit || "kg"}
                        onChange={(event) =>
                            onUpdate?.({ unit: event.target.value })
                        }
                    >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                    </select>
                    {errors[unitPath] && (
                        <p className="text-xs text-red-200 mt-1">
                            {errors[unitPath]}
                        </p>
                    )}
                </div>
            </div>

            <div>
                <label className="text-xs text-tomo-text">Measured date</label>
                <input
                    className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                    value={measurement.measured_date || ""}
                    placeholder="YYYY-MM-DD"
                    onChange={(event) =>
                        onUpdate?.({ measured_date: event.target.value })
                    }
                />
                {errors[datePath] && (
                    <p className="text-xs text-red-200 mt-1">
                        {errors[datePath]}
                    </p>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Events block
// ─────────────────────────────────────────────

function EventsBlock({
    editMode,
    isVerified,
    events,
    errors,
    triageMap = {},
    onAdd,
    onRemove,
    onUpdate,
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-tomo-text">Detected events</p>

                {editMode && (
                    <button
                        className="text-xs px-2 py-1 rounded-md border border-tomo-border text-tomo-text hover:text-tomo-text-h"
                        onClick={() => onAdd?.()}
                        disabled={!onAdd}
                    >
                        + Add
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {events?.length ? (
                    events.map((e, idx) => {
                        const typePath = `events.${idx}.event_type`
                        const datePath = `events.${idx}.event_date`
                        const descPath = `events.${idx}.description`

                        const typePathAlt = `events[${idx}].event_type`
                        const datePathAlt = `events[${idx}].event_date`
                        const descPathAlt = `events[${idx}].description`

                        if (!editMode) {
                            const triage =
                                triageMap[typePathAlt] ||
                                triageMap[datePathAlt] ||
                                triageMap[descPathAlt]

                            return (
                                <div
                                    key={idx}
                                    className="p-2 rounded-lg border border-tomo-border"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-tomo-text-h">
                                            {e?.event_type ?? "—"} ·{" "}
                                            {formatDisplayDate(e?.event_date)}
                                        </p>

                                        {triage && (
                                            <ReviewStatusBadge
                                                state={reviewState(triage)}
                                                accepted={isVerified}
                                                isVerified={isVerified}
                                            />
                                        )}
                                    </div>

                                    {e?.details_json?.description && (
                                        <p className="text-xs text-tomo-text">
                                            {e.details_json.description}
                                        </p>
                                    )}

                                    {triage && (
                                        <TriageReason reason={triage.reason} />
                                    )}
                                </div>
                            )
                        }

                        return (
                            <div
                                key={idx}
                                className="p-3 rounded-lg border border-tomo-border space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-tomo-text">
                                        Event {idx + 1}
                                    </p>

                                    <button
                                        className="text-xs text-tomo-text hover:text-red-200"
                                        onClick={() => onRemove?.(idx)}
                                        disabled={!onRemove}
                                        title="Remove event"
                                    >
                                        Remove
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-tomo-text">
                                            Type
                                        </label>

                                        <select
                                            className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                            value={e?.event_type || ""}
                                            onChange={(ev) =>
                                                onUpdate?.(idx, {
                                                    event_type: ev.target.value,
                                                })
                                            }
                                        >
                                            <option value="" disabled>
                                                Select…
                                            </option>
                                            <option value="appointment">
                                                appointment
                                            </option>
                                            <option value="injection">
                                                injection
                                            </option>
                                            <option value="vaccine">vaccine</option>
                                            <option value="med_admin">
                                                med_admin
                                            </option>
                                            <option value="other">other</option>
                                        </select>

                                        {errors[typePath] && (
                                            <p className="text-xs text-red-200 mt-1">
                                                {errors[typePath]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs text-tomo-text">
                                            Date
                                        </label>

                                        <input
                                            className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                            value={e?.event_date || ""}
                                            placeholder="YYYY-MM-DD"
                                            onChange={(ev) =>
                                                onUpdate?.(idx, {
                                                    event_date: ev.target.value,
                                                })
                                            }
                                        />

                                        {errors[datePath] && (
                                            <p className="text-xs text-red-200 mt-1">
                                                {errors[datePath]}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-tomo-text">
                                        Description
                                    </label>

                                    <input
                                        className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                        value={e?.details_json?.description || ""}
                                        placeholder="e.g., Injection Librela"
                                        onChange={(ev) =>
                                            onUpdate?.(idx, {
                                                details_json: {
                                                    ...(e.details_json || {}),
                                                    description: ev.target.value,
                                                },
                                            })
                                        }
                                    />

                                    {errors[descPath] && (
                                        <p className="text-xs text-red-200 mt-1">
                                            {errors[descPath]}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-tomo-text">—</p>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Cost items block
// ─────────────────────────────────────────────

function CostItemsBlock({
    editMode,
    isVerified,
    costItems,
    errors,
    triageMap = {},
    onAdd,
    onRemove,
    onUpdate,
}) {
    const items = Array.isArray(costItems) ? costItems : []
    const visible = editMode ? items : items.slice(0, 6)

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-tomo-text">Cost items</p>

                {editMode && (
                    <button
                        className="text-xs px-2 py-1 rounded-md border border-tomo-border text-tomo-text hover:text-tomo-text-h"
                        onClick={() => onAdd?.()}
                        disabled={!onAdd}
                    >
                        + Add
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {visible.length ? (
                    visible.map((ci, idx) => {
                        const labelPath = `cost_items.${idx}.label`
                        const datePath = `cost_items.${idx}.service_date`
                        const amountPath = `cost_items.${idx}.amount`
                        const currencyPath = `cost_items.${idx}.currency`

                        const labelPathAlt = `cost_items[${idx}].label`
                        const amountPathAlt = `cost_items[${idx}].amount`
                        const serviceDatePathAlt = `cost_items[${idx}].service_date`

                        if (!editMode) {
                            const triage =
                                triageMap[labelPathAlt] ||
                                triageMap[amountPathAlt] ||
                                triageMap[serviceDatePathAlt]

                            return (
                                <div
                                    key={idx}
                                    className="p-2 rounded-lg border border-tomo-border"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-tomo-text-h">
                                            {ci?.label || "—"}
                                        </p>

                                        {triage && (
                                            <ReviewStatusBadge
                                                state={reviewState(triage)}
                                                accepted={isVerified}
                                                isVerified={isVerified}
                                            />
                                        )}
                                    </div>

                                    <p className="text-xs text-tomo-text">
                                        {formatDisplayDate(ci?.service_date)} ·{" "}
                                        {ci?.category || "—"} ·{" "}
                                        {formatDisplayMoney(
                                            ci?.amount,
                                            ci?.currency
                                        )}
                                    </p>

                                    {triage && (
                                        <TriageReason reason={triage.reason} />
                                    )}
                                </div>
                            )
                        }

                        return (
                            <div
                                key={idx}
                                className="p-3 rounded-lg border border-tomo-border space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-tomo-text">
                                        Item {idx + 1}
                                    </p>

                                    <button
                                        className="text-xs text-tomo-text hover:text-red-200"
                                        onClick={() => onRemove?.(idx)}
                                        disabled={!onRemove}
                                        title="Remove item"
                                    >
                                        Remove
                                    </button>
                                </div>

                                <div>
                                    <label className="text-xs text-tomo-text">
                                        Label
                                    </label>

                                    <input
                                        className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                        value={ci?.label || ""}
                                        onChange={(ev) =>
                                            onUpdate?.(idx, {
                                                label: ev.target.value,
                                            })
                                        }
                                    />

                                    {errors[labelPath] && (
                                        <p className="text-xs text-red-200 mt-1">
                                            {errors[labelPath]}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-tomo-text">
                                            Service date
                                        </label>

                                        <input
                                            className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                            value={ci?.service_date || ""}
                                            placeholder="YYYY-MM-DD"
                                            onChange={(ev) =>
                                                onUpdate?.(idx, {
                                                    service_date:
                                                        ev.target.value,
                                                })
                                            }
                                        />

                                        {errors[datePath] && (
                                            <p className="text-xs text-red-200 mt-1">
                                                {errors[datePath]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs text-tomo-text">
                                            Category
                                        </label>

                                        <input
                                            className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                            value={ci?.category || ""}
                                            onChange={(ev) =>
                                                onUpdate?.(idx, {
                                                    category: ev.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-tomo-text">
                                            Amount
                                        </label>

                                        <input
                                            className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                            value={ci?.amount ?? ""}
                                            onChange={(ev) =>
                                                onUpdate?.(idx, {
                                                    amount: ev.target.value,
                                                })
                                            }
                                        />

                                        {errors[amountPath] && (
                                            <p className="text-xs text-red-200 mt-1">
                                                {errors[amountPath]}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs text-tomo-text">
                                            Currency
                                        </label>

                                        <input
                                            className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                                            value={ci?.currency || "USD"}
                                            onChange={(ev) =>
                                                onUpdate?.(idx, {
                                                    currency: ev.target.value,
                                                })
                                            }
                                        />

                                        {errors[currencyPath] && (
                                            <p className="text-xs text-red-200 mt-1">
                                                {errors[currencyPath]}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-tomo-text">—</p>
                )}
            </div>

            {!editMode && items.length > 6 && (
                <p className="text-xs text-tomo-text mt-2">
                    +{items.length - 6} more…
                </p>
            )}
        </div>
    )
}
