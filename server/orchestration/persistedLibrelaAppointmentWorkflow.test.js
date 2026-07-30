import test from "node:test"
import assert from "node:assert/strict"
import {
    buildCarePlanningHandoff,
    buildCommunicationHandoff,
    buildRecordsHandoff,
} from "./librelaAppointmentCoordinator.js"
import {
    buildContextFingerprint,
    coordinatePersistedLibrelaAppointmentRequest,
} from "./persistedLibrelaAppointmentWorkflow.js"

const PET_ID = "pet-1"
const CURRENT_CARE_DATE = "2026-07-26"
const NOW = "2026-07-30T16:00:00.000Z"

test("checkpoints each specialist handoff before awaiting human review", async () => {
    const repository = createRepository()
    const counters = createCounters()

    const result = await coordinate({
        repository,
        specialists: countingSpecialists(counters),
    })

    assert.equal(result.status, "prepared")
    assert.equal(result.workflow.persistence, "persisted")
    assert.equal(result.workflow.recovered, false)
    assert.equal(result.workflow.external_action_taken, false)
    assert.deepEqual(counters, {
        records: 1,
        carePlanning: 1,
        communication: 1,
    })

    const run = repository.runs[0]
    assert.equal(run.status, "awaiting_human_review")
    assert.equal(run.current_step, "human_review")
    assert.deepEqual(run.completed_roles, [
        "records",
        "care_planning",
        "communication",
    ])
    assert.equal(run.pending_decision, "review_or_edit_message")
    assert.equal(run.external_action_taken, false)
    assert.equal(run.result_json.draft.delivery.status, "not_sent")
    assert.equal(
        "recipient_contact" in run.result_json.draft,
        true
    )
    assert.equal(run.result_json.draft.recipient_contact, null)
})

test("recovers the stored draft without repeating specialist work", async () => {
    const repository = createRepository()
    await coordinate({ repository })

    const counters = createCounters()
    const recovered = await coordinate({
        repository,
        specialists: countingSpecialists(counters),
    })

    assert.equal(recovered.status, "prepared")
    assert.equal(recovered.workflow.recovered, true)
    assert.equal(recovered.workflow.recovery_count, 1)
    assert.deepEqual(counters, {
        records: 0,
        carePlanning: 0,
        communication: 0,
    })
    assert.equal(repository.runs.length, 1)
    assert.equal(repository.runs[0].last_resumed_at, NOW)
    assert.equal(repository.runs[0].external_action_taken, false)
})

test("resumes from the last completed checkpoint after interruption", async () => {
    const repository = createRepository()
    const firstCounters = createCounters()
    const interruptedSpecialists = countingSpecialists(firstCounters)
    interruptedSpecialists.buildCommunicationHandoff = () => {
        firstCounters.communication += 1
        throw new Error("simulated interruption")
    }

    await assert.rejects(
        coordinate({
            repository,
            specialists: interruptedSpecialists,
        }),
        /simulated interruption/
    )

    assert.deepEqual(repository.runs[0].completed_roles, [
        "records",
        "care_planning",
    ])
    assert.equal(repository.runs[0].current_step, "communication")

    const resumeCounters = createCounters()
    const resumed = await coordinate({
        repository,
        specialists: countingSpecialists(resumeCounters),
    })

    assert.equal(resumed.status, "prepared")
    assert.equal(resumed.workflow.recovered, true)
    assert.equal(resumed.workflow.recovery_count, 1)
    assert.deepEqual(resumeCounters, {
        records: 0,
        carePlanning: 0,
        communication: 1,
    })
    assert.equal(repository.runs[0].external_action_taken, false)
})

test("supersedes an active run when trusted context changes", async () => {
    const repository = createRepository()
    const original = await coordinate({ repository })
    const changedContext = buildContext()
    changedContext.plannedReminders[0].details_json.due_date =
        "2026-08-05"
    changedContext.plannedReminders[0].updated_at =
        "2026-07-30T16:05:00.000Z"

    const replacement = await coordinate({
        repository,
        context: changedContext,
    })

    assert.notEqual(
        replacement.workflow.run_id,
        original.workflow.run_id
    )
    assert.equal(replacement.workflow.recovered, false)
    assert.equal(repository.runs.length, 2)
    assert.equal(repository.runs[0].status, "superseded")
    assert.equal(
        repository.runs[0].blocked_reason,
        "trusted_context_changed"
    )
    assert.equal(repository.runs[1].status, "awaiting_human_review")
})

test("persists a safe terminal result when an appointment already exists", async () => {
    const repository = createRepository()
    const context = buildContext()
    context.scheduledAppointments = [
        {
            id: "appointment-1",
            event_type: "appointment",
            event_date: "2026-07-28",
            status: "confirmed",
            updated_at: "2026-07-25T10:00:00.000Z",
            details_json: { subtype: "Librela" },
        },
    ]

    const result = await coordinate({ repository, context })

    assert.equal(result.status, "appointment_exists")
    assert.equal(result.workflow.state, "complete_no_action")
    assert.equal(result.workflow.external_action_taken, false)
    assert.equal(repository.runs[0].status, "complete_no_action")
    assert.equal(repository.runs[0].completed_at, NOW)
})

test("persists blocked records without inventing or executing work", async () => {
    const repository = createRepository()
    const context = buildContext()
    context.plannedReminders = []

    const result = await coordinate({ repository, context })

    assert.equal(result.status, "reminder_not_found")
    assert.equal(result.workflow.state, "blocked")
    assert.equal(result.workflow.external_action_taken, false)
    assert.equal(repository.runs[0].status, "blocked")
    assert.deepEqual(repository.runs[0].completed_roles, [])
    assert.equal(repository.runs[0].external_action_taken, false)
})

test("context fingerprints are order-stable and change with trusted evidence", () => {
    const context = buildContext()
    context.documents.push({
        id: "unrelated-document",
        source_org: "Another provider",
        status: "verified",
        updated_at: "2026-07-29T10:00:00.000Z",
    })
    const reordered = structuredClone(context)
    reordered.documents.reverse()

    const first = buildContextFingerprint({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })
    const second = buildContextFingerprint({
        context: reordered,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(first, second)

    reordered.documents.find(
        (document) => document.id === "unrelated-document"
    ).updated_at = "2026-07-30T17:00:00.000Z"

    assert.equal(
        buildContextFingerprint({
            context: reordered,
            currentCareDate: CURRENT_CARE_DATE,
        }),
        first
    )

    reordered.librelaInjectionEvents[0].updated_at =
        "2026-07-30T17:00:00.000Z"

    assert.notEqual(
        buildContextFingerprint({
            context: reordered,
            currentCareDate: CURRENT_CARE_DATE,
        }),
        first
    )
})

test("reuses a concurrently created run rather than creating a duplicate", async () => {
    const repository = createRepository()
    repository.failNextInsertAsDuplicate = true
    repository.duplicateRun = buildStoredRun({
        contextFingerprint: buildContextFingerprint({
            context: buildContext(),
            currentCareDate: CURRENT_CARE_DATE,
        }),
    })

    const result = await coordinate({ repository })

    assert.equal(result.workflow.run_id, "run-concurrent")
    assert.equal(result.workflow.recovered, true)
    assert.equal(repository.runs.length, 1)
})

function coordinate({
    repository,
    context = buildContext(),
    specialists,
}) {
    return coordinatePersistedLibrelaAppointmentRequest({
        repository,
        petId: PET_ID,
        context,
        currentCareDate: CURRENT_CARE_DATE,
        senderName: "Rosa",
        petName: "Momo",
        specialists,
        now: () => NOW,
    })
}

function createCounters() {
    return {
        records: 0,
        carePlanning: 0,
        communication: 0,
    }
}

function countingSpecialists(counters) {
    return {
        buildRecordsHandoff(input) {
            counters.records += 1
            return buildRecordsHandoff(input)
        },
        buildCarePlanningHandoff(input) {
            counters.carePlanning += 1
            return buildCarePlanningHandoff(input)
        },
        buildCommunicationHandoff(input) {
            counters.communication += 1
            return buildCommunicationHandoff(input)
        },
    }
}

function createRepository() {
    let revision = 0

    const repository = {
        runs: [],
        failNextInsertAsDuplicate: false,
        duplicateRun: null,

        async findActiveRun({ petId, workflowType }) {
            return (
                this.runs.find(
                    (run) =>
                        run.pet_id === petId &&
                        run.workflow_type === workflowType &&
                        [
                            "in_progress",
                            "awaiting_human_review",
                        ].includes(run.status)
                ) || null
            )
        },

        async findRunById(runId) {
            return this.runs.find((run) => run.id === runId) || null
        },

        async insertRun(input) {
            if (this.failNextInsertAsDuplicate) {
                this.failNextInsertAsDuplicate = false
                this.runs.push(structuredClone(this.duplicateRun))
                const error = new Error("duplicate")
                error.code = "23505"
                throw error
            }

            revision += 1
            const run = {
                id: `run-${this.runs.length + 1}`,
                recovery_count: 0,
                last_resumed_at: null,
                completed_at: null,
                created_at: NOW,
                updated_at: `revision-${revision}`,
                ...structuredClone(input),
            }
            this.runs.push(run)
            return run
        },

        async updateRun({
            runId,
            expectedUpdatedAt,
            patch,
        }) {
            const index = this.runs.findIndex(
                (run) => run.id === runId
            )
            const current = this.runs[index]

            if (!current || current.updated_at !== expectedUpdatedAt) {
                return null
            }

            revision += 1
            const updated = {
                ...current,
                ...structuredClone(patch),
                updated_at: `revision-${revision}`,
            }
            this.runs[index] = updated
            return updated
        },
    }

    return repository
}

function buildStoredRun({ contextFingerprint }) {
    return {
        id: "run-concurrent",
        pet_id: PET_ID,
        workflow_type: "librela_appointment_request",
        workflow_version: 1,
        status: "in_progress",
        current_step: "records",
        completed_roles: [],
        pending_decision: null,
        blocked_reason: null,
        context_fingerprint: contextFingerprint,
        state_json: {},
        result_json: null,
        external_action_taken: false,
        recovery_count: 0,
        last_resumed_at: null,
        completed_at: null,
        created_at: NOW,
        updated_at: "revision-concurrent",
    }
}

function buildContext() {
    return {
        plannedReminders: [
            {
                id: "reminder-1",
                doc_id: "document-1",
                event_type: "reminder",
                event_date: "2026-07-22",
                status: "planned",
                updated_at: "2026-07-20T10:00:00.000Z",
                details_json: {
                    subtype: "Librela",
                    due_date: "2026-07-29",
                    source_document_id: "document-1",
                    source_org: "SoMa Animal Hospital",
                },
            },
        ],
        librelaInjectionEvents: [
            {
                id: "injection-1",
                doc_id: "document-1",
                event_type: "injection",
                event_date: "2026-06-10",
                status: "verified",
                updated_at: "2026-06-10T10:00:00.000Z",
                details_json: { subtype: "Librela" },
            },
        ],
        scheduledAppointments: [],
        documents: [
            {
                id: "document-1",
                source_org: "SoMa Animal Hospital",
                status: "verified",
                updated_at: "2026-06-10T10:00:00.000Z",
            },
        ],
    }
}
