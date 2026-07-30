import { createHash } from "node:crypto"
import {
    buildCarePlanningHandoff,
    buildCommunicationHandoff,
    buildRecordsHandoff,
    buildWorkflowSummary,
} from "./librelaAppointmentCoordinator.js"

export const LIBRELA_APPOINTMENT_WORKFLOW =
    "librela_appointment_request"

const WORKFLOW_VERSION = 1
const RECOVERABLE_RUN_STATUSES = new Set([
    "in_progress",
    "awaiting_human_review",
    "action_succeeded",
    "action_failed",
    "action_outcome_unknown",
])

const DEFAULT_SPECIALISTS = {
    buildRecordsHandoff,
    buildCarePlanningHandoff,
    buildCommunicationHandoff,
}

export async function coordinatePersistedLibrelaAppointmentRequest({
    repository,
    petId,
    context,
    currentCareDate,
    senderName = "Rosa",
    petName = "Momo",
    specialists = DEFAULT_SPECIALISTS,
    now = () => new Date().toISOString(),
}) {
    assertRepository(repository)
    assertRequiredString(petId, "petId")
    assertRequiredString(currentCareDate, "currentCareDate")
    assertSpecialists(specialists)

    const contextFingerprint = buildContextFingerprint({
        context,
        currentCareDate,
    })

    let run = await repository.findActiveRun({
        petId,
        workflowType: LIBRELA_APPOINTMENT_WORKFLOW,
    })

    if (run && run.context_fingerprint !== contextFingerprint) {
        run = await supersedeChangedRun({
            repository,
            run,
            now,
        })
    }

    let recovered = Boolean(run)

    if (!run) {
        const created = await createRun({
            repository,
            petId,
            contextFingerprint,
        })
        run = created.run
        recovered = created.recovered
    }

    if (run.status !== "in_progress" && isObject(run.result_json)) {
        const recoveredRun = await recordRecovery({
            repository,
            run,
            now,
        })

        return attachPersistence(run.result_json, recoveredRun, true)
    }

    if (recovered) {
        run = await recordRecovery({
            repository,
            run,
            now,
        })
    }

    return resumeRun({
        repository,
        run,
        context,
        currentCareDate,
        senderName,
        petName,
        specialists,
        now,
        recovered,
    })
}

export function buildContextFingerprint({
    context,
    currentCareDate,
}) {
    const reminders = (context?.plannedReminders || []).filter(
        isLibrelaFingerprintRecord
    )
    const injections = context?.librelaInjectionEvents || []
    const appointments = (
        context?.scheduledAppointments || []
    ).filter(isLibrelaFingerprintRecord)
    const referencedDocumentIds = new Set(
        [...reminders, ...injections]
            .flatMap((record) => [
                record?.doc_id,
                record?.details_json?.source_document_id,
            ])
            .filter(Boolean)
    )
    const documents = (context?.documents || []).filter((document) =>
        referencedDocumentIds.has(document?.id)
    )

    const relevantContext = {
        current_care_date: currentCareDate,
        planned_reminders: stableRecords(reminders),
        librela_injections: stableRecords(injections),
        scheduled_appointments: stableRecords(appointments),
        documents: stableRecords(documents),
    }

    return createHash("sha256")
        .update(stableStringify(relevantContext), "utf8")
        .digest("hex")
}

async function resumeRun({
    repository,
    run,
    context,
    currentCareDate,
    senderName,
    petName,
    specialists,
    now,
    recovered,
}) {
    const state = isObject(run.state_json) ? run.state_json : {}
    let recordsHandoff = state.records_handoff || null
    let carePlanningHandoff = state.care_planning_handoff || null
    let communicationHandoff = state.communication_handoff || null

    if (!recordsHandoff) {
        recordsHandoff = specialists.buildRecordsHandoff({
            context,
            currentCareDate,
        })

        if (recordsHandoff.status === "appointment_exists") {
            const result = {
                status: "appointment_exists",
                appointment: recordsHandoff.appointment,
                workflow: buildWorkflowSummary({
                    state: "complete_no_action",
                    currentOwner: "coordinator",
                    completedRoles: ["records"],
                    blockedReason: "appointment_exists",
                }),
            }

            return finalizeRun({
                repository,
                run,
                status: "complete_no_action",
                currentStep: "complete",
                completedRoles: ["records"],
                blockedReason: "appointment_exists",
                stateJson: {
                    ...state,
                    records_handoff: recordsHandoff,
                },
                result,
                now,
                recovered,
            })
        }

        if (recordsHandoff.status !== "ready") {
            const result = blockedResult({
                status: recordsHandoff.status,
                recordsHandoff,
                blockedAt: "records",
            })

            return finalizeRun({
                repository,
                run,
                status: "blocked",
                currentStep: "records",
                completedRoles: [],
                blockedReason: recordsHandoff.status,
                stateJson: {
                    ...state,
                    records_handoff: recordsHandoff,
                },
                result,
                now,
                recovered,
            })
        }

        run = await checkpointRun({
            repository,
            run,
            patch: {
                current_step: "care_planning",
                completed_roles: ["records"],
                state_json: {
                    ...state,
                    records_handoff: recordsHandoff,
                },
            },
        })
    }

    if (!carePlanningHandoff) {
        carePlanningHandoff =
            specialists.buildCarePlanningHandoff({
                recordsHandoff,
                petName,
            })

        if (carePlanningHandoff.status !== "ready") {
            const result = blockedResult({
                status: carePlanningHandoff.status,
                recordsHandoff,
                carePlanningHandoff,
                blockedAt: "care_planning",
            })

            return finalizeRun({
                repository,
                run,
                status: "blocked",
                currentStep: "care_planning",
                completedRoles: ["records"],
                blockedReason: carePlanningHandoff.status,
                stateJson: {
                    ...run.state_json,
                    care_planning_handoff: carePlanningHandoff,
                },
                result,
                now,
                recovered,
            })
        }

        run = await checkpointRun({
            repository,
            run,
            patch: {
                current_step: "communication",
                completed_roles: ["records", "care_planning"],
                state_json: {
                    ...run.state_json,
                    care_planning_handoff: carePlanningHandoff,
                },
            },
        })
    }

    if (!communicationHandoff) {
        communicationHandoff =
            specialists.buildCommunicationHandoff({
                carePlanningHandoff,
                senderName,
            })

        run = await checkpointRun({
            repository,
            run,
            patch: {
                current_step: "human_review",
                completed_roles: [
                    "records",
                    "care_planning",
                    "communication",
                ],
                state_json: {
                    ...run.state_json,
                    communication_handoff: communicationHandoff,
                },
            },
        })
    }

    const result = {
        status: "prepared",
        reminder: recordsHandoff.reminder,
        injection: recordsHandoff.injection,
        sourceDocument: recordsHandoff.sourceDocument,
        draft: communicationHandoff.draft,
        workflow: buildWorkflowSummary({
            state: "awaiting_human_review",
            currentOwner: "human",
            completedRoles: [
                "records",
                "care_planning",
                "communication",
            ],
            pendingDecision: "review_or_edit_message",
        }),
    }

    return finalizeRun({
        repository,
        run,
        status: "awaiting_human_review",
        currentStep: "human_review",
        completedRoles: [
            "records",
            "care_planning",
            "communication",
        ],
        pendingDecision: "review_or_edit_message",
        stateJson: run.state_json,
        result,
        now,
        recovered,
    })
}

async function createRun({
    repository,
    petId,
    contextFingerprint,
}) {
    try {
        const run = await repository.insertRun({
            pet_id: petId,
            workflow_type: LIBRELA_APPOINTMENT_WORKFLOW,
            workflow_version: WORKFLOW_VERSION,
            status: "in_progress",
            current_step: "records",
            completed_roles: [],
            pending_decision: null,
            blocked_reason: null,
            context_fingerprint: contextFingerprint,
            state_json: {},
            result_json: null,
            external_action_taken: false,
        })

        return {
            run,
            recovered: false,
        }
    } catch (error) {
        if (error?.code !== "23505") throw error

        const existing = await repository.findActiveRun({
            petId,
            workflowType: LIBRELA_APPOINTMENT_WORKFLOW,
        })

        if (
            !existing ||
            existing.context_fingerprint !== contextFingerprint
        ) {
            throw error
        }

        return {
            run: existing,
            recovered: true,
        }
    }
}

async function supersedeChangedRun({
    repository,
    run,
    now,
}) {
    const updated = await repository.updateRun({
        runId: run.id,
        expectedUpdatedAt: run.updated_at,
        patch: {
            status: "superseded",
            current_step: "complete",
            pending_decision: null,
            blocked_reason: "trusted_context_changed",
            completed_at: now(),
        },
    })

    if (updated) return null

    const latest = await repository.findRunById(run.id)

    if (latest && !RECOVERABLE_RUN_STATUSES.has(latest.status)) {
        return null
    }

    throw new Error(
        "The Librela workflow changed while TomoCare was recovering it."
    )
}

async function checkpointRun({
    repository,
    run,
    patch,
}) {
    const updated = await repository.updateRun({
        runId: run.id,
        expectedUpdatedAt: run.updated_at,
        patch,
    })

    if (updated) return updated

    throw new Error(
        "The Librela workflow changed while TomoCare was saving progress."
    )
}

async function finalizeRun({
    repository,
    run,
    status,
    currentStep,
    completedRoles,
    pendingDecision = null,
    blockedReason = null,
    stateJson,
    result,
    now,
    recovered,
}) {
    const terminal = status !== "awaiting_human_review"
    const updated = await checkpointRun({
        repository,
        run,
        patch: {
            status,
            current_step: currentStep,
            completed_roles: completedRoles,
            pending_decision: pendingDecision,
            blocked_reason: blockedReason,
            state_json: stateJson,
            result_json: result,
            completed_at: terminal ? now() : null,
        },
    })

    return attachPersistence(result, updated, recovered)
}

async function recordRecovery({
    repository,
    run,
    now,
}) {
    const updated = await repository.updateRun({
        runId: run.id,
        expectedUpdatedAt: run.updated_at,
        patch: {
            recovery_count: (run.recovery_count || 0) + 1,
            last_resumed_at: now(),
        },
    })

    if (updated) return updated

    const latest = await repository.findRunById(run.id)
    if (latest?.result_json) return latest

    throw new Error(
        "The Librela workflow changed while TomoCare was recovering it."
    )
}

function attachPersistence(result, run, recovered) {
    return {
        ...result,
        workflow: {
            ...result.workflow,
            run_id: run.id,
            persistence: "persisted",
            recovered,
            recovery_count: run.recovery_count || 0,
        },
    }
}

function blockedResult({
    status,
    recordsHandoff,
    carePlanningHandoff = null,
    blockedAt,
}) {
    return {
        status,
        ...(recordsHandoff?.reminder
            ? { reminder: recordsHandoff.reminder }
            : {}),
        ...(recordsHandoff?.injection
            ? { injection: recordsHandoff.injection }
            : {}),
        ...(recordsHandoff?.sourceDocument
            ? { sourceDocument: recordsHandoff.sourceDocument }
            : {}),
        workflow: buildWorkflowSummary({
            state: "blocked",
            currentOwner: "coordinator",
            completedRoles:
                blockedAt === "care_planning" ? ["records"] : [],
            blockedReason:
                carePlanningHandoff?.status ||
                recordsHandoff?.status ||
                status,
        }),
    }
}

function stableRecords(records = []) {
    return [...records]
        .map((record) => ({
            id: record?.id || null,
            doc_id: record?.doc_id || null,
            event_type: record?.event_type || null,
            event_date: record?.event_date || null,
            event_start: record?.event_start || null,
            status: record?.status || null,
            source_org: record?.source_org || null,
            updated_at: record?.updated_at || null,
            details_json: record?.details_json || null,
        }))
        .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))
}

function isLibrelaFingerprintRecord(record) {
    const details = record?.details_json || {}
    const haystack = [
        record?.event_type,
        details.subtype,
        details.target_subtype,
        details.medication,
        details.medication_name,
        details.title,
        details.description,
        details.reason,
        details.visit_type,
        details.appointment_type,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`
    }

    if (isObject(value)) {
        const keys = Object.keys(value).sort()
        return `{${keys
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${stableStringify(value[key])}`
            )
            .join(",")}}`
    }

    return JSON.stringify(value)
}

function isObject(value) {
    return Boolean(
        value &&
            typeof value === "object" &&
            !Array.isArray(value)
    )
}

function assertRepository(repository) {
    for (const method of [
        "findActiveRun",
        "findRunById",
        "insertRun",
        "updateRun",
    ]) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertSpecialists(specialists) {
    for (const method of [
        "buildRecordsHandoff",
        "buildCarePlanningHandoff",
        "buildCommunicationHandoff",
    ]) {
        if (typeof specialists?.[method] !== "function") {
            throw new Error(`specialists.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} is required.`)
    }
}
