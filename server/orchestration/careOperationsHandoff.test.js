import assert from "node:assert/strict"
import test from "node:test"

import {
    buildBoundedHomeMedicationState,
    buildCareOperationsContextFingerprint,
    coordinateCareOperationsHandoff,
} from "./careOperationsHandoff.js"

const PET_ID = "pet-1"
const CARE_DATE = "2026-08-18"

function buildReminder(overrides = {}) {
    return {
        id: "reminder-1",
        pet_id: PET_ID,
        event_type: "reminder",
        event_date: "2026-08-17",
        status: "planned",
        updated_at: "2026-08-01T10:00:00.000Z",
        details_json: {
            care_item: "Simparica Trio",
            care_category: "at_home_medication",
            reminder_type: "home_medication",
            cadence_days: 30,
            last_administered_date: "2026-07-20",
            preferred_admin_day: "Monday",
            reminder_days_before: 1,
            requires_appointment: false,
            route: "oral chewable",
            administered_by: "Rosa",
        },
        ...overrides,
    }
}

function buildContext(reminder = buildReminder()) {
    return {
        homeMedicationReminders: [reminder],
        homeMedicationAdministrationEvents: [
            {
                id: "administration-1",
                pet_id: PET_ID,
                event_type: "medication_administration",
                event_date: "2026-07-20",
                status: "verified",
                updated_at: "2026-07-20T20:00:00.000Z",
                details_json: {
                    care_item: "Simparica Trio",
                },
            },
        ],
    }
}

function buildQueryPlan(overrides = {}) {
    return {
        intent: "home_medication_given_action",
        subject: "simparica_trio",
        action: {
            kind: "record_home_medication_given",
            medication_subject: "simparica_trio",
            administered_date: CARE_DATE,
            issue: null,
        },
        ...overrides,
    }
}

function createActionRepository(reminder = buildReminder()) {
    const actions = []
    const calls = {
        pending: 0,
        insert: 0,
        findById: 0,
    }

    return {
        calls,
        actions,
        async findPendingActionsByPetId() {
            calls.pending += 1
            return actions.filter((action) =>
                ["proposed", "approved", "executing", "outcome_unknown"].includes(
                    action.status
                )
            )
        },
        async findActionById(actionId) {
            calls.findById += 1
            return actions.find((action) => action.id === actionId) || null
        },
        async findReminder({ petId, reminderId }) {
            return petId === PET_ID && reminderId === reminder.id
                ? reminder
                : null
        },
        async findActiveActionByIdempotencyKey(key) {
            return (
                actions.find(
                    (action) =>
                        action.idempotency_key === key &&
                        action.status !== "cancelled"
                ) || null
            )
        },
        async insertProposedAction(proposal) {
            calls.insert += 1
            const action = {
                id: `action-${calls.insert}`,
                proposed_at: "2026-08-18T17:00:00.000Z",
                updated_at: "2026-08-18T17:00:00.000Z",
                ...structuredClone(proposal),
            }
            actions.push(action)
            return action
        },
    }
}

function createOrchestrationRepository() {
    const runs = []
    const calls = {
        insert: 0,
        update: 0,
    }
    let revision = 0

    return {
        calls,
        runs,
        async findReusableRun({
            petId,
            workflowType,
            contextFingerprint,
        }) {
            return (
                runs.find(
                    (run) =>
                        run.pet_id === petId &&
                        run.workflow_type === workflowType &&
                        run.context_fingerprint === contextFingerprint &&
                        [
                            "complete_no_action",
                            "awaiting_human_review",
                        ].includes(run.status)
                ) || null
            )
        },
        async findActiveRun({ petId, workflowType }) {
            return (
                runs.find(
                    (run) =>
                        run.pet_id === petId &&
                        run.workflow_type === workflowType &&
                        [
                            "in_progress",
                            "awaiting_human_review",
                            "action_succeeded",
                            "action_failed",
                            "action_outcome_unknown",
                        ].includes(run.status)
                ) || null
            )
        },
        async insertRun(input) {
            calls.insert += 1
            revision += 1
            const run = {
                id: `run-${calls.insert}`,
                ...structuredClone(input),
                updated_at: `2026-08-18T17:00:0${revision}.000Z`,
            }
            runs.push(run)
            return run
        },
        async updateRun({ runId, expectedUpdatedAt, patch }) {
            calls.update += 1
            const run = runs.find((candidate) => candidate.id === runId)
            if (!run || run.updated_at !== expectedUpdatedAt) return null
            revision += 1
            Object.assign(run, structuredClone(patch), {
                updated_at: `2026-08-18T17:00:0${revision}.000Z`,
            })
            return run
        },
    }
}

test("builds a bounded fingerprint that ignores record order and raw fields", () => {
    const stateA = buildBoundedHomeMedicationState({
        context: buildContext(),
        pendingActions: [],
        medicationSubject: "simparica_trio",
    })
    const stateB = {
        ...stateA,
        reminders: [...stateA.reminders].reverse(),
        administrations: [...stateA.administrations].reverse(),
    }
    const input = {
        petId: PET_ID,
        intent: "home_medication_status",
        medicationSubject: "simparica_trio",
        currentCareDate: CARE_DATE,
        request: null,
    }
    const first = buildCareOperationsContextFingerprint({
        ...input,
        state: stateA,
    })
    const second = buildCareOperationsContextFingerprint({
        ...input,
        state: stateB,
    })

    assert.equal(first, second)
    assert.equal(first.length, 64)
    assert.doesNotMatch(JSON.stringify(stateA).slice(0, 500), /conversation|prompt/i)
})

test("coordinates an eligible statement into one proposed action and an awaiting-review run", async () => {
    const reminder = buildReminder()
    const actionRepository = createActionRepository(reminder)
    const orchestrationRepository = createOrchestrationRepository()
    const result = await coordinateCareOperationsHandoff({
        petId: PET_ID,
        queryPlan: buildQueryPlan(),
        context: buildContext(reminder),
        currentCareDate: CARE_DATE,
        actionRepository,
        orchestrationRepository,
        now: () => "2026-08-18T17:00:09.000Z",
    })

    assert.equal(result.status, "completed")
    assert.equal(result.actionPreparation.status, "prepared")
    assert.equal(result.actionPreparation.action.status, "proposed")
    assert.equal(actionRepository.calls.insert, 1)
    assert.equal(orchestrationRepository.runs.length, 1)
    assert.equal(
        orchestrationRepository.runs[0].status,
        "awaiting_human_review"
    )
    assert.equal(
        orchestrationRepository.runs[0].result_json.governed_action.id,
        "action-1"
    )
    assert.equal(
        orchestrationRepository.runs[0].external_action_taken,
        false
    )
})

test("recovers the same run and proposal for an identical repeated request", async () => {
    const reminder = buildReminder()
    const actionRepository = createActionRepository(reminder)
    const orchestrationRepository = createOrchestrationRepository()
    const args = {
        petId: PET_ID,
        queryPlan: buildQueryPlan(),
        context: buildContext(reminder),
        currentCareDate: CARE_DATE,
        actionRepository,
        orchestrationRepository,
        now: () => "2026-08-18T17:00:09.000Z",
    }

    const first = await coordinateCareOperationsHandoff(args)
    const second = await coordinateCareOperationsHandoff(args)

    assert.equal(first.actionPreparation.action.id, "action-1")
    assert.equal(second.status, "recovered")
    assert.equal(second.actionPreparation.action.id, "action-1")
    assert.equal(second.orchestrationTrace.recovered, true)
    assert.equal(actionRepository.calls.insert, 1)
    assert.equal(orchestrationRepository.calls.insert, 1)
})

test("supersedes a recovered cancelled proposal before preparing a replacement", async () => {
    const reminder = buildReminder()
    const actionRepository = createActionRepository(reminder)
    const orchestrationRepository = createOrchestrationRepository()
    const args = {
        petId: PET_ID,
        queryPlan: buildQueryPlan(),
        context: buildContext(reminder),
        currentCareDate: CARE_DATE,
        actionRepository,
        orchestrationRepository,
        now: () => "2026-08-18T17:00:09.000Z",
    }

    await coordinateCareOperationsHandoff(args)
    actionRepository.actions[0].status = "cancelled"
    const replacement = await coordinateCareOperationsHandoff(args)

    assert.equal(replacement.status, "completed")
    assert.equal(replacement.actionPreparation.action.id, "action-2")
    assert.equal(actionRepository.calls.insert, 2)
    assert.equal(orchestrationRepository.calls.insert, 2)
    assert.equal(orchestrationRepository.runs[0].status, "superseded")
})

test("routes a status question through Care Operations without proposing an action", async () => {
    const actionRepository = createActionRepository()
    const orchestrationRepository = createOrchestrationRepository()
    const result = await coordinateCareOperationsHandoff({
        petId: PET_ID,
        queryPlan: buildQueryPlan({
            intent: "home_medication_status",
            action: undefined,
        }),
        context: buildContext(),
        currentCareDate: CARE_DATE,
        actionRepository,
        orchestrationRepository,
    })

    assert.equal(result.status, "completed")
    assert.equal(result.actionPreparation, null)
    assert.equal(actionRepository.calls.insert, 0)
    assert.equal(
        orchestrationRepository.runs[0].status,
        "complete_no_action"
    )
    assert.equal(
        result.orchestrationTrace.specialist.name,
        "care_operations"
    )
})

test("changed trusted evidence supersedes the earlier completed read-only run", async () => {
    const actionRepository = createActionRepository()
    const orchestrationRepository = createOrchestrationRepository()
    const queryPlan = buildQueryPlan({
        intent: "home_medication_due",
        action: undefined,
    })
    const firstContext = buildContext()
    const secondContext = buildContext(
        buildReminder({
            updated_at: "2026-08-18T18:00:00.000Z",
            event_date: "2026-08-18",
        })
    )

    await coordinateCareOperationsHandoff({
        petId: PET_ID,
        queryPlan,
        context: firstContext,
        currentCareDate: CARE_DATE,
        actionRepository,
        orchestrationRepository,
    })
    await coordinateCareOperationsHandoff({
        petId: PET_ID,
        queryPlan,
        context: secondContext,
        currentCareDate: CARE_DATE,
        actionRepository,
        orchestrationRepository,
    })

    assert.equal(orchestrationRepository.calls.insert, 2)
    assert.equal(orchestrationRepository.runs.length, 2)
})
