import { useCallback, useMemo, useState } from "react"
import * as api from "../api.js"
import { getTriageReviewState } from "../triageReviewState.js"

// Owns the AI triage result, its loading state, and the set of field paths the
// reviewer has accepted. Also derives the gating flags the page uses to decide
// whether the document can be approved.
export function useTriage(isVerified) {
    const [triageResult, setTriageResult] = useState(null)
    const [triageLoading, setTriageLoading] = useState(false)
    const [acceptedPaths, setAcceptedPaths] = useState(new Set())

    const runTriage = useCallback(async (id, { force = false } = {}) => {
        if (!id) return

        setTriageLoading(true)

        try {
            const j = await api.runTriage(id, { force })
            setTriageResult(j.triage_result)
            setAcceptedPaths(new Set())
            return j.triage_result
        } catch (e) {
            console.error("[triage]", e.message)
            setTriageResult(null)
            throw e
        } finally {
            setTriageLoading(false)
        }
    }, [])

    function acceptField(path) {
        if (isVerified) return
        setAcceptedPaths((prev) => new Set([...prev, path]))
    }

    function acceptAllConfirmed() {
        if (isVerified) return
        if (!triageResult?.fields) return

        const confirmed = triageResult.fields
            .filter(
                (f) =>
                    f.state === "auto-confirmed" ||
                    f.outcome === "consistent_pattern"
            )
            .map((f) => f.path)

        setAcceptedPaths((prev) => new Set([...prev, ...confirmed]))
    }

    const reset = useCallback(() => {
        setTriageResult(null)
        setTriageLoading(false)
        setAcceptedPaths(new Set())
    }, [])

    const reviewState = useMemo(
        () =>
            getTriageReviewState({
                triageResult,
                acceptedPaths,
                isVerified,
            }),
        [triageResult, acceptedPaths, isVerified]
    )

    return {
        triageResult,
        triageLoading,
        acceptedPaths,
        setTriageResult,
        setAcceptedPaths,
        runTriage,
        acceptField,
        acceptAllConfirmed,
        reset,
        unreviewedCount: reviewState.unreviewedCount,
        triageBlocksApprove: reviewState.blocksApprove,
        hasCurrentAssessment: reviewState.currentAssessment,
    }
}
