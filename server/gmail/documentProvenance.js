export function buildGmailDocumentProvenance(email = {}) {
    return {
        // Clinical authorship must come from the attached document and remain
        // reviewable. Gmail sender data is transport provenance only.
        source_org: null,
        source_person: null,
        transport: {
            forwarded_by: email.forwardedBy || null,
            original_sender: email.originalSender || null,
        },
    }
}

export function getInboxProcessingPlan(items = []) {
    return items.flatMap((item) => {
        if (item?.action === "created_document" && item.documentId) {
            return [
                {
                    documentId: item.documentId,
                    filename: item.filename || null,
                    intakeAction: "created_document",
                },
            ]
        }

        if (
            item?.action === "retry_existing_document" &&
            item.existingDocId
        ) {
            return [
                {
                    documentId: item.existingDocId,
                    filename: item.filename || null,
                    intakeAction: "retry_existing_document",
                },
            ]
        }

        return []
    })
}
