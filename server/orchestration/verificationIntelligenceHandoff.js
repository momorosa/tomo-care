import { createHash } from "node:crypto"

import { getCandidateFingerprint } from "../verification/verificationIntelligence.js"
import { createVerificationReviewTools } from "../verification/verificationReviewTools.js"
import { createSpecialistRegistry } from "./specialistRegistry.js"
import { coordinateTomoSpecialist } from "./tomoManager.js"
import { verificationIntelligenceSpecialist } from "./verificationIntelligenceSpecialist.js"

export const VERIFICATION_REVIEW_WORKFLOW =
    "verification_intelligence_review"

export class VerificationIntelligenceHandoffError extends Error {
    constructor(message, { status = 500, reason, trace = null } = {}) {
        super(message)
        this.name = "VerificationIntelligenceHandoffError"
        this.status = status
        this.reason = reason || "verification_handoff_failed"
        this.trace = trace
    }
}

export async function coordinateVerificationIntelligenceReview({
    documentId,
    force = false,
    repository = null,
    registry = createSpecialistRegistry([
        verificationIntelligenceSpecialist,
    ]),
    tools = null,
    now,
}) {
    assertRequiredString(documentId, "documentId")

    const resolvedRepository =
        repository ||
        (await import("../repositories/orchestrationRunRepository.js"))
            .orchestrationRunRepository
    const resolvedTools = tools || createVerificationReviewTools()

    const document = await loadManagerDocument(resolvedTools, documentId)

    if (!document) {
        throw new VerificationIntelligenceHandoffError(
            "Document not found",
            {
                status: 404,
                reason: "document_not_found",
            }
        )
    }

    validateReviewableDocument(document)

    const candidateFingerprint = getCandidateFingerprint(
        document.text_extracted
    )
    const contextFingerprint = buildVerificationContextFingerprint({
        documentId,
        candidateFingerprint,
    })
    const specialistInput = {
        schema_version: "verification_intelligence_input_v1",
        intent: "review_document",
        document_id: documentId,
        candidate_fingerprint: candidateFingerprint,
        source_metadata: {
            doc_type: document.doc_type || null,
            doc_date: document.doc_date || null,
            source_org: document.source_org || null,
        },
        force: Boolean(force),
    }

    let coordinated = await coordinateTomoSpecialist({
        intent: "document_verification_review",
        petId: document.pet_id,
        workflowType: VERIFICATION_REVIEW_WORKFLOW,
        contextFingerprint,
        specialistInput,
        initialEvidenceIds: [documentId],
        repository: resolvedRepository,
        registry,
        tools: resolvedTools,
        force: Boolean(force),
        now,
    })

    if (
        coordinated.status === "recovered" &&
        !isCurrentAssessmentForFingerprint(
            document.triage_result,
            candidateFingerprint
        )
    ) {
        coordinated = await coordinateTomoSpecialist({
            intent: "document_verification_review",
            petId: document.pet_id,
            workflowType: VERIFICATION_REVIEW_WORKFLOW,
            contextFingerprint,
            specialistInput: {
                ...specialistInput,
                force: true,
            },
            initialEvidenceIds: [documentId],
            repository: resolvedRepository,
            registry,
            tools: resolvedTools,
            force: true,
            now,
        })
    }

    if (coordinated.status === "in_progress") {
        throw new VerificationIntelligenceHandoffError(
            "Verification Intelligence is already reviewing this document.",
            {
                status: 409,
                reason: "review_in_progress",
                trace: coordinated.trace,
            }
        )
    }

    if (coordinated.status === "persistence_conflict") {
        throw new VerificationIntelligenceHandoffError(
            "The review finished, but its orchestration checkpoint changed. Retry the review.",
            {
                status: 409,
                reason: "orchestration_checkpoint_changed",
                trace: coordinated.trace,
            }
        )
    }

    if (coordinated.status === "failed") {
        const failure = coordinated.handoff.failure
        throw new VerificationIntelligenceHandoffError(
            failure.message,
            {
                status: failureStatus(failure.type),
                reason: failure.type,
                trace: coordinated.trace,
            }
        )
    }

    if (coordinated.status === "recovered") {
        return {
            cached: true,
            triage_result: document.triage_result,
            orchestration_trace: coordinated.trace,
        }
    }

    return {
        cached: coordinated.handoff.result.cached,
        triage_result: coordinated.handoff.result.assessment,
        orchestration_trace: coordinated.trace,
    }
}

export function buildVerificationContextFingerprint({
    documentId,
    candidateFingerprint,
}) {
    assertRequiredString(documentId, "documentId")
    assertRequiredString(candidateFingerprint, "candidateFingerprint")

    return createHash("sha256")
        .update(`${documentId}:${candidateFingerprint}`, "utf8")
        .digest("hex")
}

async function loadManagerDocument(tools, documentId) {
    const load = tools?.load_current_document
    if (typeof load !== "function") {
        throw new VerificationIntelligenceHandoffError(
            "Verification document retrieval is unavailable.",
            {
                status: 503,
                reason: "unavailable",
            }
        )
    }

    try {
        return await load({ documentId })
    } catch (error) {
        throw new VerificationIntelligenceHandoffError(
            "The current document could not be loaded.",
            {
                status: 503,
                reason: error?.reason || "unavailable",
            }
        )
    }
}

function validateReviewableDocument(document) {
    const rawText = String(document.raw_text || "").trim()
    const extracted = document.text_extracted

    if (!rawText || rawText.length < 40) {
        throw new VerificationIntelligenceHandoffError(
            "No raw_text available for verification review.",
            {
                status: 400,
                reason: "source_text_missing",
            }
        )
    }

    if (
        !extracted ||
        typeof extracted !== "object" ||
        Object.keys(extracted).length === 0
    ) {
        throw new VerificationIntelligenceHandoffError(
            "No text_extracted available for verification review.",
            {
                status: 400,
                reason: "candidate_missing",
            }
        )
    }
}

function isCurrentAssessmentForFingerprint(assessment, fingerprint) {
    return Boolean(
        assessment?.status === "ready" &&
            assessment?.candidate_fingerprint === fingerprint
    )
}

function failureStatus(type) {
    if (type === "malformed_input") return 400
    if (type === "stale_evidence") return 409
    if (type === "permission_denied") return 403
    if (type === "malformed_result") return 502
    if (type === "timeout" || type === "unavailable") return 503
    return 500
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new VerificationIntelligenceHandoffError(
            `${label} is required.`,
            {
                status: 400,
                reason: "invalid_request",
            }
        )
    }
}
