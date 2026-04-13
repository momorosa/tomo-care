import { stopWheelIfScrollable } from "./stopWheelIfScrollable.js"

export default function WorkingPanel({ tab, setTab, extracted, rawText, detailJson, counts, error }) {
  return (
    <div className="col-span-12 md:col-span-3 rounded-xl overflow-hidden tomo-surface">
      <div className="px-4 py-3 border-b border-tomo-border">
        <div className="flex items-center justify-between">
          <p className="text-sm text-tomo-text-h">Working panel</p>
          <p className="text-[11px] text-tomo-text-h">
            events {counts.events} · costs {counts.cost_items} · labs {counts.labs}
          </p>
        </div>

        <div className="flex gap-2 mt-3">
          {["fields", "raw", "json"].map((t) => (
            <button
              key={t}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                tab === t
                  ? "border-tomo-accent text-tomo-accent tomo-accent-surface"
                  : "border-tomo-border text-tomo-text"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "fields" ? "Key fields" : t === "raw" ? "Raw text" : "JSON"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-red-200 border-b border-tomo-border bg-red-500/10">
          {error}
        </div>
      )}

      <div className="h-full overflow-y-auto overscroll-contain px-4 py-4" onWheel={stopWheelIfScrollable}>
        {tab === "fields" && (
          <div className="space-y-4">
            <Field label="Invoice" value={extracted?.invoice_id} />
            <Field
              label="Paid"
              value={
                extracted?.totals?.paid != null
                  ? `${extracted.totals.paid} ${extracted?.totals?.currency || ""}`.trim()
                  : null
              }
            />
            <Field label="Summary" value={extracted?.summary} />

            <ListBlock
                title="Detected events"
                items={(extracted?.events || []).map((e) => ({
                    title: `${e?.event_type ?? "—"} · ${e?.event_date ?? "—"}`,
                    meta: e?.details_json?.description || "",
                }))}
                empty="—"
            />

            <ListBlock
              title="Cost items"
              items={(extracted?.cost_items || []).slice(0, 6).map((ci) => ({
                title: ci.label,
                meta: `${ci.service_date} · ${ci.category} · ${ci.amount} ${ci.currency}`,
              }))}
              footer={
                (extracted?.cost_items || []).length > 6
                  ? `+${(extracted.cost_items.length - 6)} more…`
                  : null
              }
              empty="—"
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

function ListBlock({ title, items, empty, footer }) {
  return (
    <div>
      <p className="text-xs text-tomo-text mb-2">{title}</p>
      <div className="space-y-2">
        {items?.length ? (
          items.map((it, idx) => (
            <div key={idx} className="p-2 rounded-lg border border-tomo-border">
              <p className="text-sm font-medium text-tomo-text-h">{it.title}</p>
              {it.meta && <p className="text-xs text-tomo-text">{it.meta}</p>}
            </div>
          ))
        ) : (
          <p className="text-sm text-tomo-text">{empty}</p>
        )}
      </div>
      {footer && <p className="text-xs text-tomo-text mt-2">{footer}</p>}
    </div>
  )
}