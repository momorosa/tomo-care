// src/pages/VerifyDocs/VerifyDocs.jsx
import { useEffect, useMemo, useState } from "react"
import VerifyHeader from "./VerifyHeader.jsx"
import ReviewQueuePanel from "./ReviewQueuePanel.jsx"
import SourcePreviewPanel from "./SourcePreviewPanel.jsx"
import WorkingPanel, { validateExtracted } from "./WorkingPanel.jsx"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

export default function VerifyDocs() {
  const [docs, setDocs] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const [detail, setDetail] = useState(null)
  const [counts, setCounts] = useState({ events: 0, labs: 0, cost_items: 0 })
  const [viewUrl, setViewUrl] = useState(null)

  const [tab, setTab] = useState("fields")
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState("")

  // Toast
  const [toast, setToast] = useState(null)
  function showToast(message) {
    setToast(message)
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(null), 2500)
  }

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedId) || null,
    [docs, selectedId]
  )

  // ----------------------------
  // Edit Mode State
  // ----------------------------
  const [editMode, setEditMode] = useState(false)
  const [draftExtracted, setDraftExtracted] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})

  function markDirty() {
  setDirty(true)
  if (Object.keys(validationErrors).length) setValidationErrors({})
}

  function resetEditState() {
    setEditMode(false)
    setDraftExtracted(null)
    setDirty(false)
    setValidationErrors({})
  }

  function startEdit() {
    setDraftExtracted(structuredClone(detail?.text_extracted || {}))
    setValidationErrors({})
    setDirty(false)
    setEditMode(true)
  }

  function cancelEdit() {
    resetEditState()
  }

  // If the user switches docs, exit edit mode to avoid editing the wrong doc.
  useEffect(() => {
    resetEditState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ----------------------------
  // API helpers
  // ----------------------------
  async function refreshSelectedDoc() {
    if (!selectedId) return
    const d = await fetch(`/api/documents/${selectedId}`).then((r) => r.json())
    if (d?.error) throw new Error(d.error)
    setDetail(d.doc || d)
    setCounts(d.counts || { events: 0, labs: 0, cost_items: 0 })
  }

  // ----------------------------
  // 1) Load document list (left panel)
  // ----------------------------
  useEffect(() => {
    let ignore = false
    setLoading(true)

    fetch(`/api/pets/${PET_ID}/documents?status=all&limit=50`)
      .then((r) => r.json())
      .then((j) => {
        if (ignore) return
        const list = j.documents || j.data || []
        setDocs(list)
        setSelectedId((prev) => {
  if (prev) return prev
  const firstPending = list.find((d) => d.status !== "verified")
  return firstPending?.id || list[0]?.id || null
})
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    return () => {
      ignore = true
    }
  }, [])

  // ----------------------------
  // 2) Load selected doc detail + signed URL (middle panel)
  // ----------------------------
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
        if (d?.error) throw new Error(d.error)
        if (u?.error) throw new Error(u.error)
        setDetail(d.doc || d)
        setCounts(d.counts || { events: 0, labs: 0, cost_items: 0 })
        setViewUrl(u.url)
      })
      .catch((e) => setError(e.message))

    return () => {
      ignore = true
    }
  }, [selectedId])

  // ----------------------------
  // Approve + materialize (existing)
  // ----------------------------
  async function approveDoc() {
    if (!selectedId) return
    setApproving(true)
    setError("")

    try {
      const r = await fetch(`/api/documents/${selectedId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifiedBy: "rosa", notes: "" }),
      })

      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || "Approve failed")

      setCounts(j.materialized || counts)
      setDocs((prev) =>
        prev.map((x) => (x.id === selectedId ? { ...x, status: "verified" } : x))
      )
      setDetail((prev) => (prev ? { ...prev, status: "verified" } : prev))

      // Refresh to reflect any server-side normalization (e.g., subtype)
      await refreshSelectedDoc()

      showToast(
        `Saved as verified · events ${j.materialized?.events ?? 0} · costs ${j.materialized?.cost_items ?? 0}`
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setApproving(false)
    }
  }

  // ----------------------------
  // Inline edit handlers (candidate truth)
  // ----------------------------
  function onUpdateInvoiceId(value) {
    setDraftExtracted((prev) => ({ ...(prev || {}), invoice_id: value }))
    markDirty()
  }

  function onUpdateEvent(index, patch) {
    setDraftExtracted((prev) => {
      const next = structuredClone(prev || {})
      next.events = Array.isArray(next.events) ? next.events : []
      const cur = next.events[index] || {}
      next.events[index] = { ...cur, ...patch }
      return next
    })
    markDirty()
  }

  function onAddEvent() {
    setDraftExtracted((prev) => {
      const next = structuredClone(prev || {})
      next.events = Array.isArray(next.events) ? next.events : []
      next.events.push({
        status: "completed",
        event_type: "injection",
        event_date: next.doc_date || "",
        details_json: { description: "" },
      })
      return next
    })
    markDirty()
  }

  function onRemoveEvent(index) {
    setDraftExtracted((prev) => {
      const next = structuredClone(prev || {})
      next.events = (next.events || []).filter((_, i) => i !== index)
      return next
    })
    markDirty()
  }

  function onUpdateCostItem(index, patch) {
    setDraftExtracted((prev) => {
      const next = structuredClone(prev || {})
      next.cost_items = Array.isArray(next.cost_items) ? next.cost_items : []
      const cur = next.cost_items[index] || {}
      next.cost_items[index] = { ...cur, ...patch }
      return next
    })
    markDirty()
  }

  function onAddCostItem() {
    setDraftExtracted((prev) => {
      const next = structuredClone(prev || {})
      next.cost_items = Array.isArray(next.cost_items) ? next.cost_items : []
      next.cost_items.push({
        label: "",
        notes: null,
        amount: 0,
        category: "other",
        currency: "USD",
        service_date: next.doc_date || "",
      })
      return next
    })
    markDirty()
  }

  function onRemoveCostItem(index) {
    setDraftExtracted((prev) => {
      const next = structuredClone(prev || {})
      next.cost_items = (next.cost_items || []).filter((_, i) => i !== index)
      return next
    })
    markDirty()
  }

  // ----------------------------
  // Save draft / Save & verify
  // Requires: PATCH /api/documents/:docId/text-extracted
  // ----------------------------
  async function saveDraft() {
    if (!selectedId || !draftExtracted) return
    setError("")

    const errs = validateExtracted(draftExtracted)
    setValidationErrors(errs)
    if (Object.keys(errs).length) return

    const r = await fetch(`/api/documents/${selectedId}/text-extracted`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text_extracted: draftExtracted,
        status: "needs_review",
      }),
    })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(j.error || "Save failed")

    setDetail((prev) =>
      prev ? { ...prev, text_extracted: draftExtracted, status: "needs_review" } : prev
    )
    setDocs((prev) =>
      prev.map((d) => (d.id === selectedId ? { ...d, status: "needs_review" } : d))
    )

    setDirty(false)
    showToast("Saved draft")
  }

  async function saveAndVerify() {
    if (!selectedId || !draftExtracted) return
    setError("")

    const errs = validateExtracted(draftExtracted)
    setValidationErrors(errs)
    if (Object.keys(errs).length) return

    // 1) Persist edited candidate truth (no need to set status here; approve will set verified)
    const r1 = await fetch(`/api/documents/${selectedId}/text-extracted`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text_extracted: draftExtracted,
      }),
    })
    const j1 = await r1.json()
    if (!r1.ok || j1.error) throw new Error(j1.error || "Save failed")

    // 2) Approve/materialize
    await approveDoc()

    // Ensure UI uses the edited JSON in memory (approve refresh may return normalized fields)
    // setDetail((prev) => (prev ? { ...prev, text_extracted: draftExtracted } : prev))

    resetEditState()
  }

  const extracted = detail?.text_extracted || {}
  const rawText = detail?.raw_text || ""

  return (
    <div className="tomo-theme h-[100svh] w-screen overflow-hidden">
      <div className="max-w-[1536px] mx-auto h-full px-4 md:px-8 py-6">
        <VerifyHeader
          statusPill={null}
          approving={approving}
          canApprove={!!selectedId && selectedDoc?.status !== "verified"}
          onApprove={approveDoc}
          onSyncCalendar={() => {}}
        />

        {toast && (
          <div className="fixed top-5 right-5 z-50 tomo-surface px-4 py-3 rounded-xl">
            <p className="text-tomo-text-h text-sm font-medium">{toast}</p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4 h-[calc(100svh-140px)] min-h-0">
          <ReviewQueuePanel
            docs={docs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
          />

          <SourcePreviewPanel viewUrl={viewUrl} fileUrl={selectedDoc?.file_url} />

          <WorkingPanel
            tab={tab}
            setTab={setTab}
            extracted={extracted}
            rawText={rawText}
            detailJson={detail?.text_extracted ? JSON.stringify(detail.text_extracted, null, 2) : ""}
            counts={counts}
            error={error}
            // edit props
            editMode={editMode}
            draftExtracted={draftExtracted}
            dirty={dirty}
            validationErrors={validationErrors}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveDraft={saveDraft}
            onSaveAndVerify={saveAndVerify}
            onUpdateInvoiceId={onUpdateInvoiceId}
            onUpdateEvent={onUpdateEvent}
            onAddEvent={onAddEvent}
            onRemoveEvent={onRemoveEvent}
            onUpdateCostItem={onUpdateCostItem}
            onAddCostItem={onAddCostItem}
            onRemoveCostItem={onRemoveCostItem}
          />
        </div>
      </div>
    </div>
  )
}

