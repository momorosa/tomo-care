export const TOMO_MANAGER_VERSION = 1
export const TOMO_MANAGER_TRACE_VERSION = "tomo_manager_trace_v1"

const SPECIALIST_ROUTES = Object.freeze({
    document_verification_review: "verification_intelligence",
    home_medication_status: "care_operations",
    home_medication_due: "care_operations",
    home_medication_given_action: "care_operations",
})

export function selectSpecialistForIntent(intent) {
    return SPECIALIST_ROUTES[intent] || null
}

export async function coordinateTomoSpecialist({
    intent,
    petId,
    workflowType,
    workflowVersion = 1,
    contextFingerprint,
    specialistInput,
    initialEvidenceIds = [],
    repository,
    registry,
    tools,
    force = false,
    now = () => new Date().toISOString(),
}) {
    const specialistName = selectSpecialistForIntent(intent)

    if (!specialistName) {
        return {
            status: "no_specialist",
            handoff: null,
            run: null,
            trace: buildNoSpecialistTrace({ intent }),
        }
    }

    assertRequiredString(petId, "petId")
    assertRequiredString(workflowType, "workflowType")
    assertRequiredString(contextFingerprint, "contextFingerprint")
    assertPositiveInteger(workflowVersion, "workflowVersion")
    assertRepository(repository)

    if (!registry?.has(specialistName)) {
        throw new Error(`Specialist is not registered: ${specialistName}`)
    }

    const contract = registry.getContract(specialistName)

    if (!force) {
        const reusable = await repository.findReusableRun({
            petId,
            workflowType,
            contextFingerprint,
        })

        if (reusable?.result_json?.safe_trace) {
            return {
                status: "recovered",
                handoff: null,
                run: reusable,
                trace: {
                    ...reusable.result_json.safe_trace,
                    recovered: true,
                },
            }
        }
    }

    let activeRun = await repository.findActiveRun({
        petId,
        workflowType,
    })

    if (
        activeRun &&
        activeRun.context_fingerprint !== contextFingerprint
    ) {
        const superseded = await repository.updateRun({
            runId: activeRun.id,
            expectedUpdatedAt: activeRun.updated_at,
            patch: {
                status: "superseded",
                current_step: "complete",
                pending_decision: null,
                blocked_reason: "context_changed",
                completed_at: now(),
            },
        })
        activeRun = superseded
            ? null
            : await repository.findActiveRun({
                  petId,
                  workflowType,
              })
    }

    if (activeRun) {
        const trace = buildManagerTrace({
            run: activeRun,
            intent,
            contract,
            specialistStatus: "in_progress",
            resultStatus: "in_progress",
            evidenceIds: initialEvidenceIds,
            pendingHumanDecision: "retry_after_current_review",
            humanControlBoundary:
                "No trusted record changes while the existing review is still running.",
            recovered: true,
        })

        return {
            status: "in_progress",
            handoff: null,
            run: activeRun,
            trace,
        }
    }

    let run

    try {
        run = await repository.insertRun({
            pet_id: petId,
            workflow_type: workflowType,
            workflow_version: workflowVersion,
            status: "in_progress",
            current_step: "records",
            completed_roles: [],
            pending_decision: null,
            blocked_reason: null,
            context_fingerprint: contextFingerprint,
            state_json: {
                manager: {
                    name: "tomo_manager",
                    version: TOMO_MANAGER_VERSION,
                    intent,
                    decision: "delegate",
                },
                specialist: {
                    name: contract.name,
                    version: contract.version,
                },
                evidence_ids: uniqueStrings(initialEvidenceIds),
            },
            result_json: null,
            external_action_taken: false,
        })
    } catch (error) {
        if (error?.code !== "23505") throw error

        const concurrentRun = await repository.findActiveRun({
            petId,
            workflowType,
        })

        if (!concurrentRun) throw error

        return {
            status: "in_progress",
            handoff: null,
            run: concurrentRun,
            trace: buildManagerTrace({
                run: concurrentRun,
                intent,
                contract,
                specialistStatus: "in_progress",
                resultStatus: "in_progress",
                evidenceIds: initialEvidenceIds,
                pendingHumanDecision: "retry_after_current_review",
                humanControlBoundary:
                    "No trusted record changes while the existing review is still running.",
                recovered: true,
            }),
        }
    }

    const handoff = await registry.invoke({
        name: specialistName,
        input: specialistInput,
        tools,
    })
    const succeeded = handoff.status === "completed"
    const runDisposition = succeeded
        ? getRunDisposition(handoff.result)
        : null
    const evidenceIds = succeeded
        ? handoff.result.evidence_ids
        : initialEvidenceIds
    const trace = buildManagerTrace({
        run,
        intent,
        contract,
        specialistStatus: handoff.status,
        resultStatus: succeeded
            ? handoff.result.result_status
            : handoff.failure.type,
        evidenceIds,
        pendingHumanDecision: succeeded
            ? handoff.result.pending_human_decision
            : failureDecision(handoff.failure),
        humanControlBoundary: succeeded
            ? handoff.result.human_control_boundary
            : "No trusted records changed because the specialist did not complete successfully.",
        recovered: false,
    })
    const completedAt = now()
    const updatedRun = await repository.updateRun({
        runId: run.id,
        expectedUpdatedAt: run.updated_at,
        patch: {
            status: succeeded ? runDisposition.status : "blocked",
            current_step: succeeded
                ? runDisposition.currentStep
                : "records",
            completed_roles: succeeded ? [contract.name] : [],
            pending_decision: trace.pending_human_decision,
            blocked_reason: succeeded ? null : handoff.failure.type,
            result_json: {
                status: succeeded ? "specialist_completed" : "specialist_failed",
                document_id: specialistInput?.document_id || null,
                candidate_fingerprint:
                    specialistInput?.candidate_fingerprint || null,
                specialist_result_status: succeeded
                    ? handoff.result.result_status
                    : null,
                governed_action: succeeded
                    ? safeGovernedAction(handoff.result.governed_action)
                    : null,
                safe_trace: trace,
            },
            completed_at: succeeded
                ? runDisposition.completed
                    ? completedAt
                    : null
                : completedAt,
        },
    })

    if (!updatedRun) {
        return {
            status: "persistence_conflict",
            handoff: null,
            run,
            trace: {
                ...trace,
                specialist: {
                    ...trace.specialist,
                    status: "failed",
                },
                result_status: "stale_evidence",
                pending_human_decision: "retry_review",
                human_control_boundary:
                    "No trusted records changed because the orchestration trace could not be checkpointed.",
            },
        }
    }

    return {
        status: succeeded ? "completed" : "failed",
        handoff,
        run: updatedRun,
        trace,
    }
}

function getRunDisposition(result) {
    if (result?.run_disposition === "awaiting_human_review") {
        return {
            status: "awaiting_human_review",
            currentStep: "human_review",
            completed: false,
        }
    }

    return {
        status: "complete_no_action",
        currentStep: "complete",
        completed: true,
    }
}

function safeGovernedAction(action) {
    if (
        !action ||
        typeof action.id !== "string" ||
        !action.id.trim() ||
        typeof action.status !== "string" ||
        !action.status.trim()
    ) {
        return null
    }

    return {
        id: action.id,
        status: action.status,
        action_type:
            typeof action.action_type === "string"
                ? action.action_type
                : null,
    }
}

export function buildManagerTrace({
    run,
    intent,
    contract,
    specialistStatus,
    resultStatus,
    evidenceIds = [],
    pendingHumanDecision = null,
    humanControlBoundary,
    recovered = false,
}) {
    const boundedEvidenceIds = uniqueStrings(evidenceIds).slice(0, 20)

    return {
        schema_version: TOMO_MANAGER_TRACE_VERSION,
        run_id: run?.id || null,
        workflow_type: run?.workflow_type || null,
        workflow_version: run?.workflow_version || 1,
        manager: {
            name: "tomo_manager",
            version: TOMO_MANAGER_VERSION,
            intent,
            decision: "delegate",
        },
        specialist: {
            name: contract.name,
            version: contract.version,
            status: specialistStatus,
        },
        evidence: {
            count: boundedEvidenceIds.length,
            ids: boundedEvidenceIds,
        },
        result_status: resultStatus,
        pending_human_decision: pendingHumanDecision,
        human_control_boundary: humanControlBoundary,
        recovered: Boolean(recovered),
    }
}

function buildNoSpecialistTrace({ intent }) {
    return {
        schema_version: TOMO_MANAGER_TRACE_VERSION,
        run_id: null,
        workflow_type: null,
        workflow_version: null,
        manager: {
            name: "tomo_manager",
            version: TOMO_MANAGER_VERSION,
            intent,
            decision: "no_specialist",
        },
        specialist: null,
        evidence: {
            count: 0,
            ids: [],
        },
        result_status: "handled_without_specialist",
        pending_human_decision: null,
        human_control_boundary:
            "No specialist or consequential action was authorized for this request.",
        recovered: false,
    }
}

function failureDecision(failure) {
    if (failure?.type === "stale_evidence") return "rerun_current_review"
    if (failure?.retryable) return "retry_review"
    return "review_manually"
}

function uniqueStrings(values) {
    return [...new Set((values || []).filter(
        (value) => typeof value === "string" && value.trim()
    ))]
}

function assertRepository(repository) {
    const requiredMethods = [
        "findReusableRun",
        "findActiveRun",
        "insertRun",
        "updateRun",
    ]

    for (const method of requiredMethods) {
        if (typeof repository?.[method] !== "function") {
            throw new TypeError(`repository.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${label} is required.`)
    }
}

function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${label} must be a positive integer.`)
    }
}
