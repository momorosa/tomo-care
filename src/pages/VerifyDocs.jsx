import { useEffect, useMemo, useState } from "react"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

function stopWheelIfScrollable(e) {
    const el = e.currentTarget
    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    const goingUp = e.deltaY < 0
    const goingDown = e.deltaY > 0
    if ((!atTop && goingUp) || (!atBottom && goingDown)) e.stopPropagation()
}

export default function VerifyDocs() {
    const [docs, setDocs] = useState([])
    const [selectedId, setSelectedId] = useState(null)

    const [detail, setDetail] = useState(null)
    const [counts, setCounts] = useState({ events: 0, labs: 0, cost_items: 0 })
    const [viewUrl, setViewUrl] = useState(null)

    const [tab, setTab] = useState("fields") // fields | raw | json
    const [loading, setLoading] = useState(false)
    const [approving, setApproving] = useState(false)
    const [error, setError] = useState("")

    const selectedDoc = useMemo(
        () => docs.find((d) => d.id === selectedId) || null,
        [docs, selectedId]
    )

    // 1) Load doc list (left panel)
    useEffect(() => {
        let ignore = false
        setLoading(true)
        fetch(`/api/pets/${PET_ID}/documents?status=all&limit=50`)
            .then((r) => r.json())
            .then((j) => {
                if (ignore) return
                const list = j.documents || j.data || []
                setDocs(list)
                setSelectedId((prev) => prev ?? (list[0]?.id || null))
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
        return () => {
            ignore = true
        }
    }, [])

    // 2) Load selected doc detail + signed URL
    useEffect(() => {
        if (!selectedId) return
        let ignore = false
        setError("")
        setDetail(null)
        setViewUrl(null)

        Promise.all([
            fetch(`/api/documents/${selectedId}`).then((r) => r.json()),
            fetch(`/api/documents/${selectedId}/view-url`).then((r) => r.json()),
        ])
        .then(([d, u]) => {
            if (ignore) return
            if (d.error) throw new Error(d.error)
            if (u.error) throw new Error(u.error)
            setDetail(d.doc || d)
            setCounts(d.counts || { events: 0, labs: 0, cost_items: 0 })
            setViewUrl(u.url)
        })
        .catch((e) => setError(e.message))

        return () => {
            ignore = true
        }
    }, [selectedId])

    async function approveDoc() {
        if (!selectedId) return
        setApproving(true)
        setError("")
        try {
            const r = await fetch(`/api/documents/${selectedId}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ verifiedBy: "rosa",  notes: "" }),
            })
            const j = await r.json()
            if (!r.ok || j.error) throw new Error(j.error || "Approve failed")

            // Update UI state
            setCounts(j.materialized || counts)
            setDocs((prev) =>
                prev.map((x) => (x.id === selectedId ? { ...x, status: "verified" } : x))
            )
            setDetail((prev) => (prev ? { ...prev, status: "verified" } : prev))
        } catch (e) {
            setError(e.message)
        } finally {
            setApproving(false)
        }
    }

    const extracted = detail?.text_extracted || {}
    const rawText = detail?.raw_text || ""

    return (
        <div className="h-[100svh] w-screen overflow-hidden bg-warm-gray text-white">
            <div className="max-w-[1280px] mx-auto h-full px-4 md:px-8 py-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <p className="text-yellow-mellow-light uppercase tracking-wide text-xs">
                            TomoCare · Phase 0.5
                        </p>
                        <h1 className="text-2xl md:text-3xl font-semibold">
                            Verification UI (Trust Surface)
                        </h1>
                        <p className="text-gray-300 mt-2">
                            Review extracted candidates against the source before they become automation-ready.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            className="px-4 py-2 rounded-lg bg-yellow-mellow text-black font-medium disabled:opacity-50"
                            onClick={approveDoc}
                            disabled={!selectedId || approving || selectedDoc?.status === "verified"}
                            title="Approve and materialize verified rows (events/cost items/labs)"
                        >
                            {approving ? "Approving…" : selectedDoc?.status === "verified" ? "Verified" : "Approve"}
                        </button>

                        <button
                            className="px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:text-white disabled:opacity-40"
                            disabled
                            title="Phase 1 action (separate approval): sync reminder to Google Calendar"
                        >
                            Sync to calendar
                        </button>
                    </div>
                </div>

                {/* Main 3-panel layout */}
                <div className="grid grid-cols-12 gap-4 h-[calc(100svh-140px)]">
                    {/* Left panel */}
                    <div
                        className="col-span-12 md:col-span-3 rounded-xl border border-white/10 bg-black/20 overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                            <p className="text-sm text-white/80">Review queue</p>
                            <p className="text-xs text-white/50">{loading ? "Loading…" : `${docs.length}`}</p>
                        </div>

                        <div
                            className="h-full overflow-y-auto overscroll-contain"
                            onWheel={stopWheelIfScrollable}
                        >
                            {docs.map((d) => (
                                <button
                                    key={d.id}
                                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 ${
                                        d.id === selectedId ? "bg-white/10" : ""
                                    }`}
                                    onClick={() => setSelectedId(d.id)}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium truncate">{d.title || d.doc_type}</p>
                                        <span
                                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                                                d.status === "verified"
                                                ? "bg-green-500/20 text-green-200"
                                                : "bg-yellow-500/20 text-yellow-200"
                                            }`}
                                        >
                                            {d.status || "ingested"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/60 mt-1 truncate">
                                        {d.source_org || "Unknown source"} · {d.doc_date || ""}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>      

          {/* Middle panel: PDF preview */}
          <div className="col-span-12 md:col-span-6 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-sm text-white/80">Source document</p>
              {selectedDoc?.file_url && (
                <p className="text-xs text-white/50 truncate max-w-[60%]">{selectedDoc.file_url}</p>
              )}
            </div>

            <div className="h-full">
              {viewUrl ? (
                <iframe
                  title="pdf-viewer"
                  src={viewUrl}
                  className="w-full h-full"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-white/50">
                  Select a document…
                </div>
              )}
            </div>
          </div>

          {/* Right panel: fields/raw/json */}
          <div className="col-span-12 md:col-span-3 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/80">Working panel</p>
                <p className="text-[11px] text-white/50">
                  events {counts.events} · costs {counts.cost_items} · labs {counts.labs}
                </p>
              </div>

              <div className="flex gap-2 mt-3">
                {["fields", "raw", "json"].map((t) => (
                  <button
                    key={t}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      tab === t ? "border-yellow-mellow text-yellow-mellow" : "border-white/15 text-white/60"
                    }`}
                    onClick={() => setTab(t)}
                  >
                    {t === "fields" ? "Key fields" : t === "raw" ? "Raw text" : "JSON"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 text-sm text-red-200 border-b border-white/10 bg-red-500/10">
                {error}
              </div>
            )}

            <div
              className="h-full overflow-y-auto overscroll-contain px-4 py-4"
              onWheel={stopWheelIfScrollable}
            >
              {tab === "fields" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-white/50">Invoice</p>
                    <p className="text-sm">{extracted.invoice_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Paid</p>
                    <p className="text-sm">
                      {extracted?.totals?.paid ?? "—"} {extracted?.totals?.currency || ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Summary</p>
                    <p className="text-sm text-white/80">{extracted.summary || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/50 mb-2">Detected events</p>
                    <div className="space-y-2">
                      {(extracted.events || []).map((e, idx) => (
                        <div key={idx} className="p-2 rounded-lg border border-white/10">
                          <p className="text-sm font-medium">
                            {e.event_type} · {e.event_date}
                          </p>
                          <p className="text-xs text-white/60">
                            {e.details_json?.description || ""}
                          </p>
                        </div>
                      ))}
                      {(!extracted.events || extracted.events.length === 0) && (
                        <p className="text-sm text-white/50">—</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-white/50 mb-2">Cost items</p>
                    <div className="space-y-2">
                      {(extracted.cost_items || []).slice(0, 6).map((ci, idx) => (
                        <div key={idx} className="p-2 rounded-lg border border-white/10">
                          <p className="text-sm font-medium">{ci.label}</p>
                          <p className="text-xs text-white/60">
                            {ci.service_date} · {ci.category} · {ci.amount} {ci.currency}
                          </p>
                        </div>
                      ))}
                      {(extracted.cost_items || []).length > 6 && (
                        <p className="text-xs text-white/50">
                          +{(extracted.cost_items || []).length - 6} more…
                        </p>
                      )}
                      {(!extracted.cost_items || extracted.cost_items.length === 0) && (
                        <p className="text-sm text-white/50">—</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "raw" && (
                <pre className="whitespace-pre-wrap text-xs text-white/70 leading-relaxed">
                  {rawText || "—"}
                </pre>
              )}

              {tab === "json" && (
                <pre className="whitespace-pre-wrap text-xs text-white/70 leading-relaxed">
                  {detail?.text_extracted ? JSON.stringify(detail.text_extracted, null, 2) : "—"}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}