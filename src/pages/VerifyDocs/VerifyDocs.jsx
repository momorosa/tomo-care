import { useEffect, useMemo, useState } from "react"
import VerifyHeader from "./VerifyHeader.jsx"
import ReviewQueuePanel from "./ReviewQueuePanel.jsx"
import SourcePreviewPanel from "./SourcePreviewPanel.jsx"
import WorkingPanel from "./WorkingPanel.jsx"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

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
                body: JSON.stringify({ verifiedBy: "rosa", notes: "" }),
            })

            const j = await r.json()
            if (!r.ok || j.error) throw new Error(j.error || "Approve failed")

            // Update UI state
            setCounts(j.materialized || counts)
            setDocs((prev) =>
                prev.map((x) => (x.id === selectedId ? { ...x, status: "verified" } : x))
            )
            setDetail((prev) => (prev ? { ...prev, status: "verified" } : prev))

            // ✅ toast after success
            showToast(
                `Saved as verified · events ${j.materialized?.events ?? 0} · costs ${j.materialized?.cost_items ?? 0}`
            )
        } catch (e) {
            setError(e.message)
        } finally {
            setApproving(false)
        }
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

                <div className="grid grid-cols-12 gap-4 h-[calc(100svh-140px)]">
                    <ReviewQueuePanel
                        docs={docs}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        loading={loading}
                    />

                    <SourcePreviewPanel
                        viewUrl={viewUrl}
                        fileUrl={selectedDoc?.file_url}
                    />

                    <WorkingPanel
                        tab={tab}
                        setTab={setTab}
                        extracted={detail?.text_extracted || {}}
                        rawText={detail?.raw_text || ""}
                        detailJson={detail?.text_extracted ? JSON.stringify(detail.text_extracted, null, 2) : ""}
                        counts={counts}
                        error={error}
                    />
                </div>
            </div>
        </div>
    )
}