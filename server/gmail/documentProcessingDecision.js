export function getDocumentProcessingDecision(document) {
    if (document?.status === "verified") {
        return {
            allowed: false,
            reason:
                "Document is already verified. Use an explicit repair workflow instead of reprocessing trusted data.",
        }
    }

    return { allowed: true, reason: null }
}
