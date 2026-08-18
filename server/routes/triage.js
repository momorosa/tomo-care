import express from "express"

import {
    coordinateVerificationIntelligenceReview,
    VerificationIntelligenceHandoffError,
} from "../orchestration/verificationIntelligenceHandoff.js"

const router = express.Router()

// POST /api/documents/:docId/triage
// Tomo selects the versioned Verification Intelligence specialist. The
// specialist receives a bounded input and permissioned tools, while the
// existing assessment remains review-only until Rosa verifies the document.
router.post("/documents/:docId/triage", async (req, res) => {
    const { docId } = req.params
    const { force = false } = req.body || {}

    try {
        const result = await coordinateVerificationIntelligenceReview({
            documentId: docId,
            force: Boolean(force),
        })

        return res.json({
            ok: true,
            cached: result.cached,
            triage_result: result.triage_result,
            orchestration_trace: result.orchestration_trace,
        })
    } catch (error) {
        if (error instanceof VerificationIntelligenceHandoffError) {
            return res.status(error.status).json({
                error: error.message,
                reason: error.reason,
                orchestration_trace: error.trace,
            })
        }

        console.error("[verification-intelligence] error:", error)
        return res.status(500).json({
            error: "Verification review failed",
            reason: "verification_handoff_failed",
        })
    }
})

export default router
