import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import VerifyHeader from "./VerifyHeader.jsx"
import ReviewQueuePanel from "./ReviewQueuePanel.jsx"
import SourcePreviewPanel from "./SourcePreviewPanel.jsx"
import WorkingPanel from "./WorkingPanel.jsx"
import PostVerifyActionsModal from "./PostVerifyActionsModal.jsx"
import * as api from "./api.js"
import { PET_ID, EMPTY_COUNTS } from "./constants.js"
import { looksLikeLibrela } from "./utils.js"
import { useToast } from "./hooks/useToast.js"
import { useTriage } from "./hooks/useTriage.js"
import { useDraftEditor } from "./hooks/useDraftEditor.js"
import { usePostVerifyActions } from "./hooks/usePostVerifyActions.js"
import { getPostVerifyRecommendations } from "./recommendations.js"
import { getTriageReviewState } from "./triageReviewState.js"

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

    const selectedDoc = useMemo(
        () => docs.find((d) => d.id === selectedId) || null,
        [docs, selectedId]
    )

    const postVerifyRecommendations = useMemo(
        () => getPostVerifyRecommendations(detail),
        [detail]
    )

    const currentStatus = detail?.status || selectedDoc?.status || null
    const isVerified = currentStatus === "verified"

    const { toast, showToast } = useToast()
    const triage = useTriage(isVerified)
    const draft = useDraftEditor(detail, isVerified)
    const postVerify = usePostVerifyActions({
        selectedId,
        showToast,
        setError,
        onReconciled: refreshSelectedDoc,
    })
    const resetTriage = triage.reset
    const runTriage = triage.runTriage
    const setTriageResult = triage.setTriageResult
    const resetDraft = draft.reset
    const setShowPostVerifyActions = postVerify.setShowPostVerifyActions

    const resetSelectedDocumentState = useCallback(() => {
        setSelectedId(null)
        setDetail(null)
        setCounts(EMPTY_COUNTS)
        setViewUrl(null)
        setError("")
        resetTriage()
        resetDraft()
    }, [resetDraft, resetTriage])

    useEffect(() => {
        if (!docId) {
            resetSelectedDocumentState()
            return
        }

        setSelectedId(docId)
    }, [docId, resetSelectedDocumentState])

    useEffect(() => {
        resetDraft()
        resetTriage()
        setTab("fields")
    }, [selectedId, resetDraft, resetTriage])

    async function refreshSelectedDoc() {
        if (!selectedId) return

        const { doc, counts: nextCounts } = await api.fetchDocument(selectedId)

        setDetail(doc)
        setCounts(nextCounts)

        if (doc?.triage_result) {
            setTriageResult(doc.triage_result)
        }
    }

    function handleSelectDocument(id) {
        if (!id) return
        setSelectedId(id)
        navigate(`/review/${id}`)
    }

    // Load the document list once.
    useEffect(() => {
        let ignore = false

        setLoading(true)
        setError("")

        api.fetchDocumentList(PET_ID)
            .then((list) => {
                if (!ignore) setDocs(list)
            })
            .catch((e) => setError(e.message))
            .finally(() => {
                if (!ignore) setLoading(false)
            })

        return () => {
            ignore = true
        }
    }, [])

    // Load the selected document's detail + view URL, and kick off triage when
    // the extraction hasn't been reviewed yet.
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

        Promise.all([api.fetchDocument(selectedId), api.fetchViewUrl(selectedId)])
            .then(([{ doc, counts: nextCounts }, url]) => {
                if (ignore) return

                setDetail(doc)
                setCounts(nextCounts)
                setViewUrl(url)

                if (
                    doc.status === "verified" ||
                    doc.triage_result?.status === "ready"
                ) {
                    setTriageResult(doc.triage_result)
                } else if (
                    doc.text_extracted &&
                    doc.raw_text &&
                    doc.status !== "verified"
                ) {
                    runTriage(doc.id).catch((e) => setError(e.message))
                }
            })
            .catch((e) => {
                if (!ignore) setError(e.message)
            })

        return () => {
            ignore = true
        }
    }, [selectedId, runTriage, setTriageResult])

    // Temporary visual QA helper:
    // Open the post-verification action modal with ?previewPostVerify=1
    useEffect(() => {
        if (!detail) return

        const params = new URLSearchParams(window.location.search)
        if (params.get("previewPostVerify") === "1") {
            setShowPostVerifyActions(true)
        }
    }, [detail, setShowPostVerifyActions])

    async function approveDoc({
        assessment = triage.triageResult,
        acceptedPaths = triage.acceptedPaths,
    } = {}) {
        if (!selectedId || isVerified) return

        setApproving(true)
        setError("")

        try {
            const j = await api.approveDocument(selectedId, {
                candidateFingerprint: assessment?.candidate_fingerprint,
                acceptedPaths: [...acceptedPaths],
            })

            setCounts(j.materialized || counts)

            setDocs((prev) =>
                prev.map((x) =>
                    x.id === selectedId ? { ...x, status: "verified" } : x
                )
            )

            setDetail((prev) => (prev ? { ...prev, status: "verified" } : prev))

            if (triage.triageResult?.fields) {
                triage.setAcceptedPaths(
                    new Set(triage.triageResult.fields.map((field) => field.path))
                )
            }

            await refreshSelectedDoc()

            showToast(
                `Verified · events ${j.materialized?.events ?? 0} · costs ${
                    j.materialized?.cost_items ?? 0
                } · facts ${j.materialized?.facts ?? 0}`
            )

            postVerify.openPostVerifyActions()
        } catch (e) {
            setError(e.message)
        } finally {
            setApproving(false)
        }
    }

    async function saveDraft() {
        if (!selectedId || !draft.draftExtracted || isVerified) return

        setError("")

        if (Object.keys(draft.validate()).length) return

        try {
            await api.patchExtracted(selectedId, draft.draftExtracted)

            setDetail((prev) =>
                prev
                    ? {
                          ...prev,
                          text_extracted: draft.draftExtracted,
                          status: "needs_review",
                      }
                    : prev
            )

            setDocs((prev) =>
                prev.map((d) =>
                    d.id === selectedId ? { ...d, status: "needs_review" } : d
                )
            )

            draft.setDirty(false)

            triage.setTriageResult(null)
            triage.setAcceptedPaths(new Set())
            await triage.runTriage(selectedId, { force: true })

            showToast("Saved draft")
        } catch (e) {
            setError(e.message)
        }
    }

    async function saveAndVerify() {
        if (!selectedId || !draft.draftExtracted || isVerified) return

        setError("")

        if (Object.keys(draft.validate()).length) return

        try {
            await api.patchExtracted(selectedId, draft.draftExtracted)

            const assessment = await triage.runTriage(selectedId, {
                force: true,
            })
            const nextReviewState = getTriageReviewState({
                triageResult: assessment,
                acceptedPaths: new Set(),
                isVerified: false,
            })

            setDetail((prev) =>
                prev
                    ? {
                          ...prev,
                          text_extracted: draft.draftExtracted,
                          triage_result: assessment,
                          status: "needs_review",
                      }
                    : prev
            )
            draft.reset()

            if (nextReviewState.blocksApprove) {
                showToast(
                    `Saved and rechecked · review ${nextReviewState.unreviewedCount} attention item${
                        nextReviewState.unreviewedCount === 1 ? "" : "s"
                    } before verifying`
                )
                return
            }

            await approveDoc({ assessment, acceptedPaths: new Set() })
        } catch (e) {
            setError(e.message)
        }
    }

    const extracted = detail?.text_extracted || {}
    const rawText = detail?.raw_text || ""

    const canApprove =
        !!selectedId &&
        !isVerified &&
        !triage.triageLoading &&
        triage.hasCurrentAssessment &&
        !triage.triageBlocksApprove

    const flaggedFields =
        triage.triageResult?.fields?.filter(
            (f) =>
                f.state === "needs-confirmation" ||
                f.state === "unreadable-source" ||
                f.blocks_approval === true
        ) || []
    const flaggedTotal = flaggedFields.length
    const flaggedResolved = isVerified
        ? flaggedTotal
        : flaggedFields.filter((f) => triage.acceptedPaths.has(f.path)).length

    return (
        <main className="h-[calc(100svh-64px)] w-screen overflow-hidden bg-tomo-bg">
            <div className="max-w-[1536px] mx-auto h-full px-4 md:px-8 py-6 flex flex-col min-h-0">
                <VerifyHeader
                    statusPill={null}
                    approving={approving}
                    canApprove={canApprove}
                    onApprove={approveDoc}
                    isVerified={isVerified}
                    unreviewedCount={triage.unreviewedCount}
                    flaggedTotal={flaggedTotal}
                    flaggedResolved={flaggedResolved}
                    triageLoading={triage.triageLoading}
                />

                {toast && (
                    <div className="fixed top-5 right-5 z-50 tomo-surface px-4 py-3 rounded-xl">
                        <p className="text-tomo-text-h text-sm font-medium">
                            {toast}
                        </p>
                    </div>
                )}

                <PostVerifyActionsModal
                    open={postVerify.showPostVerifyActions}
                    onClose={postVerify.closePostVerifyActions}
                    documentTitle={detail?.title || selectedDoc?.title}
                    isLibrela={looksLikeLibrela(detail)}
                    recommendations={postVerifyRecommendations}
                    actionStatus={postVerify.postVerifyActionStatus}
                    weightLoading={postVerify.postVerifyActionLoading === "weight"}
                    librelaLoading={postVerify.postVerifyActionLoading === "librela"}
                    insuranceClaimLoading={postVerify.postVerifyActionLoading === "insurance"}
                    onMaterializeWeight={
                        postVerify.handleWeightMaterialization
                    }
                    onCreateLibrelaReminder={() =>
                        postVerify.handleCreateLibrelaReminder(
                            postVerifyRecommendations.librelaReminder.state
                        )
                    }
                    onCreateInsuranceClaimReminder={
                        postVerify.handleCreateInsuranceClaimReminder
                    }
                    onRetryLibrelaCalendar={
                        postVerify.handleRetryLibrelaCalendar
                    }
                    onRetryInsuranceCalendar={
                        postVerify.handleRetryInsuranceCalendar
                    }
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
                        editMode={draft.editMode}
                        draftExtracted={draft.draftExtracted}
                        dirty={draft.dirty}
                        validationErrors={draft.validationErrors}
                        onStartEdit={draft.startEdit}
                        onCancelEdit={draft.cancelEdit}
                        onSaveDraft={saveDraft}
                        onSaveAndVerify={saveAndVerify}
                        onUpdateInvoiceId={draft.onUpdateInvoiceId}
                        onUpdateWeightMeasurement={
                            draft.onUpdateWeightMeasurement
                        }
                        onUpdateEvent={draft.onUpdateEvent}
                        onAddEvent={draft.onAddEvent}
                        onRemoveEvent={draft.onRemoveEvent}
                        onUpdateCostItem={draft.onUpdateCostItem}
                        onAddCostItem={draft.onAddCostItem}
                        onRemoveCostItem={draft.onRemoveCostItem}
                        triageResult={triage.triageResult}
                        orchestrationTrace={triage.orchestrationTrace}
                        triageLoading={triage.triageLoading}
                        acceptedPaths={triage.acceptedPaths}
                        onAcceptField={triage.acceptField}
                        onAcceptAllConfirmed={triage.acceptAllConfirmed}
                    />
                </div>
            </div>
        </main>
    )
}
