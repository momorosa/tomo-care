import { useMemo, useState } from "react"
import { stopWheelIfScrollable } from "./stopWheelIfScrollable"

function QueueItem({ doc, active, onSelect }) {
  const verified = doc.status === "verified"

  return (
    <button
      className={`w-full text-left px-4 py-3 border-b border-tomo-border/50 border-l-2 transition-colors ${
        active
          ? "border-l-tomo-accent bg-white/[0.06]"
          : "border-l-transparent hover:bg-white/[0.03]"
      }`}
      onClick={() => onSelect(doc.id)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium truncate text-tomo-text-h">
          {doc.title || doc.doc_type}
        </p>
        <span
          className={`tomo-badge ${
            verified ? "tomo-badge--success" : "tomo-badge--brand"
          }`}
        >
          {doc.status || "ingested"}
        </span>
      </div>
      <p className="text-xs text-tomo-text mt-1 truncate">
        {doc.source_org || "Unknown source"} · {doc.doc_date || ""}
      </p>
    </button>
  )
}

export default function ReviewQueuePanel({ docs, selectedId, onSelect, loading }) {
  const [showVerified, setShowVerified] = useState(true)

  const { pendingDocs, verifiedDocs } = useMemo(() => {
    const pending = []
    const verified = []

    docs.forEach((d) => {
      if (d.status === "verified") verified.push(d)
      else pending.push(d)
    })

    pending.sort((a, b) => {
      const aDate = a.doc_date || ""
      const bDate = b.doc_date || ""
      return bDate.localeCompare(aDate)
    })

    verified.sort((a, b) => {
      const aDate = a.doc_date || ""
      const bDate = b.doc_date || ""
      return bDate.localeCompare(aDate)
    })

    return { pendingDocs: pending, verifiedDocs: verified }
  }, [docs])

  return (
    <div className="col-span-12 md:col-span-3 min-h-0 rounded-xl overflow-hidden tomo-surface flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-tomo-border flex items-center justify-between">
        <p className="text-sm text-tomo-text-h">Review queue</p>
        <span className="tomo-badge tomo-badge--brand tabular-nums">
          {loading ? "…" : docs.length}
        </span>
      </div>

      {/* <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        onWheel={stopWheelIfScrollable}
      > */}
      <div
  className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
  onWheel={stopWheelIfScrollable}
>
        <div className="border-b border-tomo-border/60">
          <div className="px-4 py-2 bg-white/[0.03]">
            <p className="text-[11px] uppercase tracking-[0.12em] text-tomo-text">
              Needs review · {pendingDocs.length}
            </p>
          </div>

          {pendingDocs.length ? (
            pendingDocs.map((d) => (
              <QueueItem
                key={d.id}
                doc={d}
                active={d.id === selectedId}
                onSelect={onSelect}
              />
            ))
          ) : (
            <div className="px-4 py-4">
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 tomo-badge--success border">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 shrink-0 text-tomo-success"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-tomo-success">You&rsquo;re all caught up.</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <button
            className="w-full px-4 py-2 text-left bg-white/[0.03] border-b border-tomo-border/60 hover:bg-white/[0.05]"
            onClick={() => setShowVerified((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.12em] text-tomo-text">
                Verified archive · {verifiedDocs.length}
              </p>
              <span className="text-xs text-tomo-text-h">
                {showVerified ? "Hide" : "Show"}
              </span>
            </div>
          </button>

          {showVerified && (
            verifiedDocs.length ? (
              verifiedDocs.map((d) => (
                <QueueItem
                  key={d.id}
                  doc={d}
                  active={d.id === selectedId}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-tomo-text">No verified items yet.</div>
            )
          )}
        </div>
      </div>
    </div>
  )
}