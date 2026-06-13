import express from "express"
import { sbAdmin } from "../supabase.js"
import { processGmailInbox } from "../gmail/processGmailDocuments.js"

const router = express.Router()

// POST /api/gmail/check-inbox
//
// Manual trigger for Phase 2 Part 1.
// Checks the configured Gmail inbox for new vet PDFs,
// ingests new canonical receipts, processes them,
// and routes them to needs_review.
router.post("/gmail/check-inbox", async (req, res) => {
    const {
        maxResults = 10,
        dryRun = false,
    } = req.body || {}

    const safeMaxResults = Math.min(Math.max(Number(maxResults) || 10, 1), 50)

    try {
        const result = await processGmailInbox({
            maxResults: safeMaxResults,
            dryRun: Boolean(dryRun),
        })

        const reviewReadyIds = result.processedDocuments
            .filter((doc) => doc.status === "needs_review")
            .map((doc) => doc.documentId)

        let reviewDocuments = []

        if (reviewReadyIds.length > 0) {
            const { data, error } = await sbAdmin
                .from("documents")
                .select("id, title, doc_type, source_org, status, created_at, updated_at")
                .in("id", reviewReadyIds)

            if (error) throw error;

            reviewDocuments = data || []
        }

        const failedDocuments = result.processedDocuments.filter(
            (doc) => doc.status === "failed"
        )

        res.json({
            ok: failedDocuments.length === 0,
            dryRun: Boolean(dryRun),
            emailsFound: result.ingestSummary?.emailsFound ?? null,
            documentsCreated: result.documentsCreated,
            processedToReview: reviewDocuments.length,
            failed: failedDocuments.length,
            reviewDocuments,
            result,
        })
    } catch (error) {
        console.error("[gmail/check-inbox] error:", error)

        res.status(500).json({
            ok: false,
            error: error?.message || "Failed to check Gmail inbox",
        })
    }
})

export default router