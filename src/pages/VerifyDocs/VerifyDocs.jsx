import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import VerifyHeader from "./VerifyHeader.jsx"
import ReviewQueuePanel from "./ReviewQueuePanel.jsx"
import SourcePreviewPanel from "./SourcePreviewPanel.jsx"
import WorkingPanel, { validateExtracted } from "./WorkingPanel.jsx"
import PostVerifyActionsModal from "./PostVerifyActionsModal.jsx"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

const EMPTY_COUNTS = { events: 0, labs: 0, cost_items: 0 }

export default function VerifyDocs() {
    const { docId } = useParams()
    const navigate = useNavigate()

    const [docs, setDocs] = useState([])
    const [selectedId, setSelectedId] = useState(null)

    const [detail, setDetail] = useState(null)
    const [counts, setCounts] = useState(EMPTY_COUNTS)
    const [viewUrl, setViewUrl] = useState(null)

    const [tab, setTab] = useState("fields")
    const [loading, setLoading] = useState(false)
    const [approving, setApproving] = useState(false)
    const [error, setError] = useState("")

    const [triageResult, setTriageResult] = useState(null)
    const [triageLoading, setTriageLoading] = useState(false)

    const [toast, setToast] = useState(null)
    const toastTimeoutRef = useRef(null)
    const [showPostVerifyActions, setShowPostVerifyActions] = useState(false)
    const [postVerifyActionLoading, setPostVerifyActionLoading] = useState(null)

    const [editMode, setEditMode] = useState(false)
    const [draftExtracted, setDraftExtracted] = useState(null)
    const [dirty, setDirty] = useState(false)
    const [validationErrors, setValidationErrors] = useState({})

    const [acceptedPaths, setAcceptedPaths] = useState(new Set())

    const selectedDoc = useMemo(
        () => docs.find((d) => d.id === selectedId) || null,
        [docs, selectedId]
    )

    const currentStatus = detail?.status || selectedDoc?.status || null
    const isVerified = currentStatus === "verified"

    function showToast(message) {
        setToast(message)
        window.clearTimeout(toastTimeoutRef.current)
        toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2500)
    }

    function looksLikeLibrela(doc) {
        const extracted = doc?.text_extracted || {}
        const haystack = [
            doc?.title,
            doc?.doc_type,
            JSON.stringify(extracted),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
    
        return haystack.includes("librela")
    }

    function formatDisplayDate(value) {
        if (!value) return "date pending"

        return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }


    async function handleCreateLibrelaReminder() {
        if (!selectedId) return

        setPostVerifyActionLoading("librela")
        setError("")

        try {
            const r = await fetch(
                `/api/documents/${selectedId}/actions/librela-reminder`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requestedBy: "rosa" }),
                }
            )

            const j = await r.json()

            if (!r.ok || j.error) {
                throw new Error(j.error || "Failed to create Librela reminder")
            }        

            const reminderDate = formatDisplayDate(j.reminder?.event_date)
            const dueDate = formatDisplayDate(j.reminder?.due_date)

            showToast(
                `Librela reminder ${j.action} · remind ${reminderDate} · due ${dueDate}`
            )

            setShowPostVerifyActions(false)
        } catch (e) {
            setError(e.message)
            showToast("Could not create Librela reminder")
        } finally {
            setPostVerifyActionLoading(null)
        }
    }

    function handleCreateInsuranceClaimReminder() {
        showToast("Insurance claim reminder coming next")
        setShowPostVerifyActions(false)
    }

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

    function resetSelectedDocumentState() {
        setSelectedId(null)
        setDetail(null)
        setCounts(EMPTY_COUNTS)
        setViewUrl(null)
        setError("")
        setTriageResult(null)
        setTriageLoading(false)
        setAcceptedPaths(new Set())
        setEditMode(false)
        setDraftExtracted(null)
        setDirty(false)
        setValidationErrors({})
    }

    function startEdit() {
        if (isVerified) return

        setDraftExtracted(structuredClone(detail?.text_extracted || {}))
        setValidationErrors({})
        setDirty(false)
        setEditMode(true)
    }

    function cancelEdit() {
        resetEditState()
    }

    function acceptField(path) {
        if (isVerified) return
        setAcceptedPaths((prev) => new Set([...prev, path]))
    }

    function acceptAllConfirmed() {
        if (isVerified) return
        if (!triageResult?.fields) return

        const confirmed = triageResult.fields
            .filter((f) => f.state === "auto-confirmed")
            .map((f) => f.path)

        setAcceptedPaths((prev) => new Set([...prev, ...confirmed]))
    }

    useEffect(() => {
        if (!docId) {
            resetSelectedDocumentState()
            return
        }

        setSelectedId(docId)
    }, [docId])

    useEffect(() => {
        resetEditState()
        setTriageResult(null)
        setAcceptedPaths(new Set())
        setTab("fields")
    }, [selectedId])

    async function refreshSelectedDoc() {
        if (!selectedId) return

        const d = await fetch(`/api/documents/${selectedId}`).then((r) => r.json())
        if (d?.error) throw new Error(d.error)

        const nextDoc = d.doc || d

        setDetail(nextDoc)
        setCounts(d.counts || EMPTY_COUNTS)

        if (nextDoc?.triage_result) {
            setTriageResult(nextDoc.triage_result)
        }
    }

    function handleSelectDocument(id) {
        if (!id) return
        setSelectedId(id)
        navigate(`/review/${id}`)
    }

    async function runTriage(id) {
        if (!id) return

        setTriageLoading(true)

        try {
            const r = await fetch(`/api/documents/${id}/triage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ force: false }),
            })

            const j = await r.json()

            if (!r.ok || j.error) {
                console.error("[triage]", j.error)
                setTriageResult(null)
                return
            }

            setTriageResult(j.triage_result)
        } catch (e) {
            console.error("[triage] fetch error:", e)
            setTriageResult(null)
        } finally {
            setTriageLoading(false)
        }
    }

    useEffect(() => {
        let ignore = false

        setLoading(true)
        setError("")

        fetch(`/api/pets/${PET_ID}/documents?status=all&limit=50`)
            .then((r) => r.json())
            .then((j) => {
                if (ignore) return
                const list = j.documents || j.data || []
                setDocs(list)
            })
            .catch((e) => setError(e.message))
            .finally(() => {
                if (!ignore) setLoading(false)
            })

        return () => {
            ignore = true
        }
    }, [])

    useEffect(() => {
        if (!selectedId) {
            setDetail(null)
            setCounts(EMPTY_COUNTS)
            setViewUrl(null)
            setTriageResult(null)
            return
        }

        let ignore = false

        setError("")
        setDetail(null)
        setCounts(EMPTY_COUNTS)
        setViewUrl(null)
        setTriageResult(null)
        setTriageLoading(false)
        setAcceptedPaths(new Set())

        Promise.all([
            fetch(`/api/documents/${selectedId}`).then((r) => r.json()),
            fetch(`/api/documents/${selectedId}/view-url`).then((r) => r.json()),
        ])
            .then(([d, u]) => {
                if (ignore) return
                if (d?.error) throw new Error(d.error)
                if (u?.error) throw new Error(u.error)

                const doc = d.doc || d

                setDetail(doc)
                setCounts(d.counts || EMPTY_COUNTS)
                setViewUrl(u.url)

                if (doc.triage_result) {
                    setTriageResult(doc.triage_result)
                } else if (
                    doc.text_extracted &&
                    doc.raw_text &&
                    doc.status !== "verified"
                ) {
                    runTriage(doc.id)
                }
            })
            .catch((e) => {
                if (!ignore) setError(e.message)
            })

        return () => {
            ignore = true
        }
    }, [selectedId])

    // Temporary visual QA helper:
    // Open the post-verification action modal with ?previewPostVerify=1
    useEffect(() => {
        if (!detail) return

        const params = new URLSearchParams(window.location.search)
        const shouldPreview = params.get("previewPostVerify") === "1"

        if (shouldPreview) {
            setShowPostVerifyActions(true)
        }
    }, [detail])

    async function approveDoc() {
        if (!selectedId) return
        if (isVerified) return

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
                prev.map((x) =>
                    x.id === selectedId ? { ...x, status: "verified" } : x
                )
            )

            setDetail((prev) =>
                prev ? { ...prev, status: "verified" } : prev
            )

            if (triageResult?.fields) {
                setAcceptedPaths(
                    new Set(triageResult.fields.map((field) => field.path))
                )
            }

            await refreshSelectedDoc()

            showToast(
                `Verified · events ${j.materialized?.events ?? 0} · costs ${
                    j.materialized?.cost_items ?? 0
                }`
            )

            setShowPostVerifyActions(true)
        } catch (e) {
            setError(e.message)
        } finally {
            setApproving(false)
        }
    }

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
                event_date: next.doc_date || detail?.doc_date || "",
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
                service_date: next.doc_date || detail?.doc_date || "",
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

    async function saveDraft() {
        if (!selectedId || !draftExtracted) return
        if (isVerified) return

        setError("")

        const errs = validateExtracted(draftExtracted)
        setValidationErrors(errs)

        if (Object.keys(errs).length) return

        try {
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
                prev
                    ? {
                          ...prev,
                          text_extracted: draftExtracted,
                          status: "needs_review",
                      }
                    : prev
            )

            setDocs((prev) =>
                prev.map((d) =>
                    d.id === selectedId ? { ...d, status: "needs_review" } : d
                )
            )

            setDirty(false)

            setTriageResult(null)
            setAcceptedPaths(new Set())
            runTriage(selectedId)

            showToast("Saved draft")
        } catch (e) {
            setError(e.message)
        }
    }

    async function saveAndVerify() {
        if (!selectedId || !draftExtracted) return
        if (isVerified) return

        setError("")

        const errs = validateExtracted(draftExtracted)
        setValidationErrors(errs)

        if (Object.keys(errs).length) return

        try {
            const r1 = await fetch(`/api/documents/${selectedId}/text-extracted`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text_extracted: draftExtracted,
                    status: "needs_review",
                }),
            })

            const j1 = await r1.json()
            if (!r1.ok || j1.error) throw new Error(j1.error || "Save failed")

            await approveDoc()
            resetEditState()
        } catch (e) {
            setError(e.message)
        }
    }

    const extracted = detail?.text_extracted || {}
    const rawText = detail?.raw_text || ""

    const unreviewedCount = useMemo(() => {
        if (isVerified) return 0
        if (!triageResult?.fields) return 0

        return triageResult.fields.filter(
            (f) =>
                (f.state === "needs-confirmation" ||
                    f.state === "unreadable-source") &&
                !acceptedPaths.has(f.path)
        ).length
    }, [triageResult, acceptedPaths, isVerified])

    const hasTriage =
        triageResult &&
        Array.isArray(triageResult.fields) &&
        triageResult.fields.length > 0

    const isFailSafe =
        triageResult?.fail_safe === true ||
        (triageResult &&
            triageResult.overall_confidence === "low" &&
            triageResult.fields?.length === 0)

    const triageBlocksApprove =
        !isVerified && hasTriage && !isFailSafe && unreviewedCount > 0

    const canApprove =
        !!selectedId &&
        !isVerified &&
        !triageLoading &&
        !triageBlocksApprove

    return (
        <main className="h-[calc(100svh-64px)] w-screen overflow-hidden bg-tomo-bg">
            <div className="max-w-[1536px] mx-auto h-full px-4 md:px-8 py-6 flex flex-col min-h-0">
                <VerifyHeader
                    statusPill={null}
                    approving={approving}
                    canApprove={canApprove}
                    onApprove={approveDoc}
                    unreviewedCount={unreviewedCount}
                    triageLoading={triageLoading}
                />

                {toast && (
                    <div className="fixed top-5 right-5 z-50 tomo-surface px-4 py-3 rounded-xl">
                        <p className="text-tomo-text-h text-sm font-medium">
                            {toast}
                        </p>
                    </div>
                )}

                <PostVerifyActionsModal
                    open={showPostVerifyActions}
                    onClose={() => setShowPostVerifyActions(false)}
                    documentTitle={detail?.title || selectedDoc?.title}
                    isLibrela={looksLikeLibrela(detail)}
                    librelaLoading={postVerifyActionLoading === "librela"}
                    onCreateLibrelaReminder={handleCreateLibrelaReminder}
                    onCreateInsuranceClaimReminder={handleCreateInsuranceClaimReminder}
                />

                <div className="mt-4 grid grid-cols-12 gap-4 flex-1 min-h-0">
                    <ReviewQueuePanel
                        docs={docs}
                        selectedId={selectedId}
                        onSelect={handleSelectDocument}
                        loading={loading}
                    />

                    <SourcePreviewPanel
                        viewUrl={viewUrl}
                        fileUrl={selectedDoc?.file_url || detail?.file_url}
                    />

                    <WorkingPanel
                        tab={tab}
                        setTab={setTab}
                        extracted={extracted}
                        rawText={rawText}
                        detailJson={
                            detail?.text_extracted
                                ? JSON.stringify(detail.text_extracted, null, 2)
                                : ""
                        }
                        counts={counts}
                        error={error}
                        isVerified={isVerified}
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
                        triageResult={triageResult}
                        triageLoading={triageLoading}
                        acceptedPaths={acceptedPaths}
                        onAcceptField={acceptField}
                        onAcceptAllConfirmed={acceptAllConfirmed}
                    />
                </div>
            </div>
        </main>
    )
}