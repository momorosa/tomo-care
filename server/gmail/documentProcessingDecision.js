import { isKnownDemoSource } from "./realCareDemoGuard.js"

export function getDocumentProcessingDecision(document, { runtimeMode } = {}) {
    if (runtimeMode === "real" && isKnownDemoSource({ document })) {
        return {
            allowed: false,
            reason: "This is a TomoCare demo source. It cannot be processed in Private care. Use Demo data for the synthetic scenario.",
        }
    }
    if (document?.status === "verified") {
        return {
            allowed: false,
            reason:
                "Document is already verified. Use an explicit repair workflow instead of reprocessing trusted data.",
        }
    }

    return { allowed: true, reason: null }
}
