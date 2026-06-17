import { useMemo, useState } from "react"
import * as api from "../api.js"

// Owns the AI triage result, its loading state, and the set of field paths the
// reviewer has accepted. Also derives the gating flags the page uses to decide
// whether the document can be approved.
export function useTriage(isVerified) {
    const [triageResult, setTriageResult] = useState(null)
    const [triageLoading, setTriageLoading] = useState(false)
    const [acceptedPaths, setAcceptedPaths] = useState(new Set())

    async function runTriage(id) {
        if (!id) return

        setTriageLoading(true)

        try {
            const j = await api.runTriage(id, { force: false })
            setTriageResult(j.triage_result)
        } catch (e) {
            console.error("[triage]", e.message)
            setTriageResult(null)
        } finally {
            setTriageLoading(false)
        }
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

    function reset() {
        setTriageResult(null)
        setTriageLoading(false)
        setAcceptedPaths(new Set())
    }

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
        unreviewedCount,
        triageBlocksApprove,
    }
}
