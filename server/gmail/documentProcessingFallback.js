const EXTRACTION_FALLBACK_CODE = "automatic_extraction_incomplete"

export function buildManualReviewExtraction(document = {}) {
    return {
        doc_id: document.id || null,
        pet_id: document.pet_id || null,
        doc_type: document.doc_type || "document",
        doc_date: document.doc_date || null,
        source_org: document.source_org || null,
        title: document.title || null,
        invoice_id: null,
        summary: null,
        weight_measurement: null,
        vaccine_evidence: [],
        events: [],
        cost_items: [],
        totals: { paid: null, currency: "USD" },
        labs: [],
        confidence: 0,
        notes:
            "Automatic extraction did not finish. Compare the candidate with the source PDF and add missing fields before approval.",
    }
}

export function buildManualReviewWarning(documentId) {
    return {
        code: EXTRACTION_FALLBACK_CODE,
        documentId,
        title: "Receipt saved for manual review",
        message:
            "Tomo read the PDF but could not organize all of its receipt fields. Open the saved document, compare it with the PDF, and add any missing values before approval.",
        nextAction: "open_review",
    }
}

export function getProcessingFailurePresentation(step) {
    const presentations = {
        populate_raw_text: {
            title: "Tomo saved the PDF but could not read its text",
            message:
                "Open the saved PDF to confirm it is readable, then retry this document. If it is a scan, it may need OCR before automatic extraction can continue.",
            nextAction: "open_source_or_retry",
        },
        triage: {
            title: "The receipt fields were saved, but the review check stopped",
            message:
                "Open the document to inspect the saved fields. Retry when the review service is available; nothing has entered Momo’s trusted record.",
            nextAction: "open_source_or_retry",
        },
        mark_needs_review: {
            title: "Tomo processed the PDF but could not add it to the review queue",
            message:
                "Retry this document. If it happens again, keep the PDF saved and share the processing stage with support.",
            nextAction: "retry",
        },
    }

    return (
        presentations[step] || {
            title: "This PDF is saved but needs another processing attempt",
            message:
                "Retry this document. If the same message returns, open the saved PDF and share the processing stage with support.",
            nextAction: "open_source_or_retry",
        }
    )
}
