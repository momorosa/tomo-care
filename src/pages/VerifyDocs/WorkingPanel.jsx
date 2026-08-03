import { useMemo } from "react"
import { formatDisplayDate } from "../../lib/displayDate.js"
import { stopWheelIfScrollable } from "./stopWheelIfScrollable.js"

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
    accepted: "Accepted",
    verified: "Verified",
}

const STATE_BADGE = {
    "auto-confirmed": "tomo-badge--success",
    "needs-confirmation": "tomo-badge--warning",
    "unreadable-source": "tomo-badge--danger",
    accepted: "tomo-badge--success",
    verified: "tomo-badge--success",
}

// Card tint (background + border) per state, driven by the semantic status
// tokens so flagged/confirmed cards stay consistent with the badges.
const STATE_CARD_CLASS = {
    "needs-confirmation": "tomo-review-card--needs-review",
    "unreadable-source": "tomo-review-card--unreadable",
    accepted: "tomo-review-card--accepted",
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
    dirty = false,
    validationErrors = {},
    onStartEdit = null,
    onCancelEdit = null,
    onSaveDraft = null,
    onSaveAndVerify = null,
    onUpdateInvoiceId = null,
    onUpdateEvent = null,
    onAddEvent = null,
    onRemoveEvent = null,
    onUpdateCostItem = null,
    onAddCostItem = null,
    onRemoveCostItem = null,
    triageResult = null,
    triageLoading = false,
    acceptedPaths = new Set(),
    onAcceptField = null,
    onAcceptAllConfirmed = null,
}) {
    const data = editMode ? draftExtracted || {} : extracted || {}

    const triageMap = useMemo(() => buildTriageMap(triageResult), [triageResult])

    const hasTriage =
        triageResult &&
        Array.isArray(triageResult.fields) &&
        triageResult.fields.length > 0

    const isFailSafe =
        triageResult?.fail_safe === true ||
        (triageResult &&
            triageResult.overall_confidence === "low" &&
            triageResult.fields?.length === 0)

    const flaggedCount = useMemo(() => {
        if (!hasTriage) return 0
        if (isVerified) return 0

        return triageResult.fields.filter(
            (f) =>
                f.state === "needs-confirmation" ||
                f.state === "unreadable-source"
        ).length
    }, [triageResult, hasTriage, isVerified])

    const rawFlaggedCount = useMemo(() => {
        if (!hasTriage) return 0

        return triageResult.fields.filter(
            (f) =>
                f.state === "needs-confirmation" ||
                f.state === "unreadable-source"
        ).length
    }, [triageResult, hasTriage])

    const confirmedCount = useMemo(() => {
        if (!hasTriage) return 0
        return triageResult.fields.filter((f) => f.state === "auto-confirmed").length
    }, [triageResult, hasTriage])

    const reviewedFieldCount = hasTriage ? triageResult.fields.length : 0

    return (
        <div className="col-span-12 md:col-span-3 min-h-0 rounded-xl tomo-surface flex flex-col">
            <div className="shrink-0 px-4 py-3 border-b border-tomo-border">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-tomo-text-h">Working panel</p>
                    <p className="text-[11px] text-tomo-text">
                        events {counts.events} · costs {counts.cost_items} · labs{" "}
                        {counts.labs}
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
                        <TriageBadge state="verified" />
                        <p className="text-[11px] text-tomo-text">
                            {reviewedFieldCount} field
                            {reviewedFieldCount === 1 ? "" : "s"} accepted
                            {rawFlaggedCount > 0
                                ? ` · ${rawFlaggedCount} originally flagged`
                                : ""}
                        </p>
                    </div>
                )}

                {hasTriage && !triageLoading && !isVerified && (
                    <div className="mt-2 flex items-center gap-3">
                        <TriageBadge
                            state={
                                triageResult.overall_confidence === "high"
                                    ? "auto-confirmed"
                                    : "needs-confirmation"
                            }
                        />
                        <p className="text-[11px] text-tomo-text">
                            {flaggedCount > 0
                                ? `${flaggedCount} field${
                                      flaggedCount > 1 ? "s" : ""
                                  } flagged · ${confirmedCount} confirmed`
                                : `All ${confirmedCount} fields confirmed`}
                        </p>
                    </div>
                )}

                {isFailSafe && !triageLoading && !isVerified && (
                    <div className="mt-2">
                        <p className="text-[11px] text-tomo-warning">
                            Triage unavailable — all fields shown for manual review.
                        </p>
                    </div>
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
                                    Verified record · read-only audit view
                                </p>
                            </div>
                        ) : !editMode ? (
                            <button
                                className="tomo-btn tomo-btn-secondary w-full"
                                onClick={onStartEdit || undefined}
                                disabled={!onStartEdit}
                                title="Edit extracted fields (candidate truth)"
                            >
                                Edit
                            </button>
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
                                        Save &amp; verify
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
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4"
                onWheel={stopWheelIfScrollable}
            >
                {tab === "fields" && (
                    <FieldsView
                        data={data}
                        editMode={editMode}
                        isVerified={isVerified}
                        triageMap={triageMap}
                        hasTriage={hasTriage}
                        isFailSafe={isFailSafe}
                        acceptedPaths={acceptedPaths}
                        onAcceptField={onAcceptField}
                        onAcceptAllConfirmed={onAcceptAllConfirmed}
                        validationErrors={validationErrors}
                        onUpdateInvoiceId={onUpdateInvoiceId}
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
    isVerified,
    triageMap,
    hasTriage,
    isFailSafe,
    acceptedPaths,
    onAcceptField,
    onAcceptAllConfirmed,
    validationErrors,
    onUpdateInvoiceId,
    onUpdateEvent,
    onAddEvent,
    onRemoveEvent,
    onUpdateCostItem,
    onAddCostItem,
    onRemoveCostItem,
}) {
    if (hasTriage && !editMode && !isFailSafe) {
        return (
            <div className="space-y-5 pb-6">
                <FlaggedFieldsSection
                    data={data}
                    triageMap={triageMap}
                    acceptedPaths={acceptedPaths}
                    onAcceptField={onAcceptField}
                    isVerified={isVerified}
                />

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
            {!editMode ? (
                <Field
                    label="Invoice"
                    value={data?.invoice_id}
                    triage={triageMap["invoice_id"]}
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

            <Field
                label="Paid"
                value={
                    data?.totals?.paid != null
                        ? `${data.totals.paid} ${
                              data?.totals?.currency || ""
                          }`.trim()
                        : null
                }
                triage={triageMap["totals.paid"]}
                isVerified={isVerified}
            />

            <Field
                label="Summary"
                value={data?.summary}
                triage={triageMap["summary"]}
                isVerified={isVerified}
            />

            <EventsBlock
                editMode={editMode}
                isVerified={isVerified}
                events={data?.events || []}
                errors={validationErrors}
                triageMap={triageMap}
                onAdd={onAddEvent}
                onRemove={onRemoveEvent}
                onUpdate={onUpdateEvent}
            />

            <CostItemsBlock
                editMode={editMode}
                isVerified={isVerified}
                costItems={data?.cost_items || []}
                errors={validationErrors}
                triageMap={triageMap}
                onAdd={onAddCostItem}
                onRemove={onRemoveCostItem}
                onUpdate={onUpdateCostItem}
            />
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
    isVerified,
}) {
    const flagged = Object.values(triageMap).filter(
        (f) =>
            f.state === "needs-confirmation" ||
            f.state === "unreadable-source"
    )

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
                        : STATE_CARD_CLASS[f.state] || STATE_CARD_CLASS["needs-confirmation"]

                    return (
                        <div
                            key={f.path}
                            className={`tomo-review-card ${cardClass}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-xs font-mono text-tomo-accent break-all">
                                            {f.path}
                                        </p>

                                        <ReviewStatusBadge
                                            state={f.state}
                                            accepted={accepted}
                                            isVerified={isVerified}
                                        />
                                    </div>

                                    <p className="text-sm font-medium text-tomo-text-h break-words">
                                        {f.extracted_value != null
                                            ? String(f.extracted_value)
                                            : "—"}
                                    </p>

                                    <TriageReason reason={f.reason} />
                                </div>

                                {!accepted && (
                                    <button
                                        className="shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors border-[color:var(--tomo-success-border)] text-tomo-success hover:bg-[var(--tomo-success-bg)]"
                                        onClick={() => onAcceptField?.(f.path)}
                                    >
                                        Accept
                                    </button>
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
// Confirmed fields
// ─────────────────────────────────────────────

function ConfirmedFieldsSection({
    triageMap,
    acceptedPaths,
    onAcceptField,
    onAcceptAllConfirmed,
    isVerified,
}) {
    const confirmed = Object.values(triageMap).filter(
        (f) => f.state === "auto-confirmed"
    )

    if (confirmed.length === 0) return null

    const allAccepted =
        isVerified || confirmed.every((f) => acceptedPaths.has(f.path))

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
                                ? `Accepted auto-confirmed fields · ${confirmed.length}`
                                : `Auto-confirmed · ${confirmed.length} field${
                                      confirmed.length > 1 ? "s" : ""
                                  }`}
                        </p>

                        {allAccepted && (
                            <span className="text-[10px] text-tomo-success">
                                All accepted
                            </span>
                        )}
                    </div>

                    {!isVerified && !allAccepted && (
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
                    const accepted = isVerified || acceptedPaths.has(f.path)

                    return (
                        <div
                            key={f.path}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg tomo-subtle-row"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-mono text-tomo-text break-all">
                                        {f.path}
                                    </p>
                                    {accepted && (
                                        <span className="text-[10px] text-tomo-success">
                                            Accepted
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-tomo-text-h truncate">
                                    {f.extracted_value != null
                                        ? String(f.extracted_value)
                                        : "—"}
                                </p>
                            </div>

                            {!accepted && (
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
                        state={triage.state}
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

function FieldEdit({ label, value, onChange, placeholder, error }) {
    return (
        <div>
            <p className="text-xs text-tomo-text">{label}</p>

            <input
                className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange?.(e.target.value)}
            />

            {error && <p className="text-xs text-red-200 mt-1">{error}</p>}
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
                                                state={triage.state}
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
                                                state={triage.state}
                                                accepted={isVerified}
                                                isVerified={isVerified}
                                            />
                                        )}
                                    </div>

                                    <p className="text-xs text-tomo-text">
                                        {formatDisplayDate(ci?.service_date)} ·{" "}
                                        {ci?.category || "—"} ·{" "}
                                        {ci?.amount ?? "—"} {ci?.currency || ""}
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
