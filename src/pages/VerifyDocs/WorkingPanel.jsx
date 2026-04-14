import { stopWheelIfScrollable } from "./stopWheelIfScrollable.js"

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isIsoDate = (v) => typeof v === "string" && ISO_DATE_RE.test(v)

const isNumberLike = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return true
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return true
  return false
}

// Minimal, Phase 0.5-friendly validator for Key Fields edits.
// Return an object keyed by path so you can show inline errors.
export function validateExtracted(ex) {
  const errs = {}

  if (ex?.invoice_id != null && typeof ex.invoice_id !== "string") {
    errs["invoice_id"] = "Invoice ID must be text."
  }

  // doc_date is often useful; keep optional but validate if present
  if (ex?.doc_date && !isIsoDate(ex.doc_date)) {
    errs["doc_date"] = "Use YYYY-MM-DD."
  }

  if (Array.isArray(ex?.events)) {
    ex.events.forEach((e, i) => {
      if (!e?.event_type) errs[`events.${i}.event_type`] = "Required."
      if (!e?.event_date) errs[`events.${i}.event_date`] = "Required."
      if (e?.event_date && !isIsoDate(e.event_date)) errs[`events.${i}.event_date`] = "YYYY-MM-DD."
      // Only edit description; allow empty, but keep it as string
      const desc = e?.details_json?.description
      if (desc != null && typeof desc !== "string") errs[`events.${i}.description`] = "Must be text."
    })
  }

  if (Array.isArray(ex?.cost_items)) {
    ex.cost_items.forEach((ci, i) => {
      if (!ci?.label) errs[`cost_items.${i}.label`] = "Required."
      if (ci?.service_date && !isIsoDate(ci.service_date)) errs[`cost_items.${i}.service_date`] = "YYYY-MM-DD."
      if (!isNumberLike(ci?.amount)) errs[`cost_items.${i}.amount`] = "Must be a number."
      if (!ci?.currency) errs[`cost_items.${i}.currency`] = "Required."
    })
  }

  return errs
}

export default function WorkingPanel({
    tab,
  setTab,
  extracted,
  rawText,
  detailJson,
  counts,
  error,
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
}) {
  const data = editMode ? (draftExtracted || {}) : (extracted || {})

    return (
    <div className="col-span-12 md:col-span-3 min-h-0 rounded-xl tomo-surface flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-tomo-border">
        <div className="flex items-center justify-between">
          <p className="text-sm text-tomo-text-h">Working panel</p>
          <p className="text-[11px] text-tomo-text-h">
            events {counts.events} · costs {counts.cost_items} · labs {counts.labs}
          </p>
        </div>

        <div className="flex gap-2 mt-3" role="tablist" aria-label="Working panel mode">
          {["fields", "raw", "json"].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`tomo-tab ${tab === t ? "tomo-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "fields" ? "Key fields" : t === "raw" ? "Raw text" : "JSON"}
            </button>
          ))}
        </div>

        {tab === "fields" && (
          <div className="mt-3">
            {!editMode ? (
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
                  Editing candidate truth{dirty ? " · unsaved changes" : ""}
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
          <div className="space-y-5 pb-6">
            {!editMode ? (
              <Field label="Invoice" value={data?.invoice_id} />
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
                  ? `${data.totals.paid} ${data?.totals?.currency || ""}`.trim()
                  : null
              }
            />

            <Field label="Summary" value={data?.summary} />

            <EventsBlock
              editMode={editMode}
              events={data?.events || []}
              errors={validationErrors}
              onAdd={onAddEvent}
              onRemove={onRemoveEvent}
              onUpdate={onUpdateEvent}
            />

            <CostItemsBlock
              editMode={editMode}
              costItems={data?.cost_items || []}
              errors={validationErrors}
              onAdd={onAddCostItem}
              onRemove={onRemoveCostItem}
              onUpdate={onUpdateCostItem}
            />
          </div>
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


function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-tomo-text">{label}</p>
      <p className="text-sm text-tomo-text-h">{value || "—"}</p>
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

function EventsBlock({ editMode, events, errors, onAdd, onRemove, onUpdate }) {
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

            if (!editMode) {
              return (
                <div key={idx} className="p-2 rounded-lg border border-tomo-border">
                  <p className="text-sm font-medium text-tomo-text-h">
                    {e?.event_type ?? "—"} · {e?.event_date ?? "—"}
                  </p>
                  {e?.details_json?.description && (
                    <p className="text-xs text-tomo-text">{e.details_json.description}</p>
                  )}
                </div>
              )
            }

            return (
              <div key={idx} className="p-3 rounded-lg border border-tomo-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-tomo-text">Event {idx + 1}</p>
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
                    <label className="text-xs text-tomo-text">Type</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                      value={e?.event_type || ""}
                      onChange={(ev) => onUpdate?.(idx, { event_type: ev.target.value })}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      <option value="appointment">appointment</option>
                      <option value="injection">injection</option>
                      <option value="vaccine">vaccine</option>
                      <option value="med_admin">med_admin</option>
                      <option value="other">other</option>
                    </select>
                    {errors[typePath] && <p className="text-xs text-red-200 mt-1">{errors[typePath]}</p>}
                  </div>

                  <div>
                    <label className="text-xs text-tomo-text">Date</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                      value={e?.event_date || ""}
                      placeholder="YYYY-MM-DD"
                      onChange={(ev) => onUpdate?.(idx, { event_date: ev.target.value })}
                    />
                    {errors[datePath] && <p className="text-xs text-red-200 mt-1">{errors[datePath]}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-tomo-text">Description</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                    value={e?.details_json?.description || ""}
                    placeholder="e.g., Injection Librela"
                    onChange={(ev) =>
                      onUpdate?.(idx, {
                        details_json: { ...(e.details_json || {}), description: ev.target.value },
                      })
                    }
                  />
                  {errors[descPath] && <p className="text-xs text-red-200 mt-1">{errors[descPath]}</p>}
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

function CostItemsBlock({ editMode, costItems, errors, onAdd, onRemove, onUpdate }) {
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

            if (!editMode) {
              return (
                <div key={idx} className="p-2 rounded-lg border border-tomo-border">
                  <p className="text-sm font-medium text-tomo-text-h">{ci?.label || "—"}</p>
                  <p className="text-xs text-tomo-text">
                    {ci?.service_date || "—"} · {ci?.category || "—"} · {ci?.amount ?? "—"} {ci?.currency || ""}
                  </p>
                </div>
              )
            }

            return (
              <div key={idx} className="p-3 rounded-lg border border-tomo-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-tomo-text">Item {idx + 1}</p>
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
                  <label className="text-xs text-tomo-text">Label</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                    value={ci?.label || ""}
                    onChange={(ev) => onUpdate?.(idx, { label: ev.target.value })}
                  />
                  {errors[labelPath] && <p className="text-xs text-red-200 mt-1">{errors[labelPath]}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-tomo-text">Service date</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                      value={ci?.service_date || ""}
                      placeholder="YYYY-MM-DD"
                      onChange={(ev) => onUpdate?.(idx, { service_date: ev.target.value })}
                    />
                    {errors[datePath] && <p className="text-xs text-red-200 mt-1">{errors[datePath]}</p>}
                  </div>

                  <div>
                    <label className="text-xs text-tomo-text">Category</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                      value={ci?.category || ""}
                      onChange={(ev) => onUpdate?.(idx, { category: ev.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-tomo-text">Amount</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                      value={ci?.amount ?? ""}
                      onChange={(ev) => onUpdate?.(idx, { amount: ev.target.value })}
                    />
                    {errors[amountPath] && <p className="text-xs text-red-200 mt-1">{errors[amountPath]}</p>}
                  </div>

                  <div>
                    <label className="text-xs text-tomo-text">Currency</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h outline-none focus:border-tomo-accent"
                      value={ci?.currency || "USD"}
                      onChange={(ev) => onUpdate?.(idx, { currency: ev.target.value })}
                    />
                    {errors[currencyPath] && <p className="text-xs text-red-200 mt-1">{errors[currencyPath]}</p>}
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
        <p className="text-xs text-tomo-text mt-2">+{items.length - 6} more…</p>
      )}
    </div>
  )
}