import assert from "node:assert/strict"
import test from "node:test"

import { invokeSpecialist } from "./specialistContract.js"
import {
    CARE_OPERATIONS_CONTRACT,
    CARE_OPERATIONS_INPUT_VERSION,
    runCareOperations,
} from "./careOperationsSpecialist.js"

function buildInput(overrides = {}) {
    return {
        schema_version: CARE_OPERATIONS_INPUT_VERSION,
        intent: "home_medication_given_action",
        pet_id: "pet-1",
        medication_subject: "simparica_trio",
        display_name: "Simparica Trio",
        current_care_date: "2026-08-18",
        context_fingerprint: "fingerprint-1",
        request: {
            medication_subject: "simparica_trio",
            administered_date: "2026-08-18",
            issue: null,
        },
        ...overrides,
    }
}

function buildState(overrides = {}) {
    return {
        context_fingerprint: "fingerprint-1",
        reminders: [
            {
                id: "reminder-1",
                medication_subject: "simparica_trio",
            },
        ],
        administrations: [
            {
                id: "administration-1",
                medication_subject: "simparica_trio",
            },
        ],
        pending_actions: [],
        ...overrides,
    }
}

function buildAction(overrides = {}) {
    return {
        id: "action-1",
        source_event_id: "reminder-1",
        action_type: "mark_home_medication_given",
        status: "proposed",
        preview_json: {
            care_item: "Simparica Trio",
            administered_date: "2026-08-18",
        },
        ...overrides,
    }
}

test("declares only trusted and action-state access with two restricted tools", () => {
    assert.deepEqual(CARE_OPERATIONS_CONTRACT.allowed_truth_tiers, [
        "trusted",
        "action_state",
    ])
    assert.deepEqual(CARE_OPERATIONS_CONTRACT.allowed_tools, [
        "load_home_medication_state",
        "prepare_home_medication_action",
    ])
})

test("keeps status reconciliation answer-only and never calls the proposal tool", async () => {
    let prepareCalls = 0
    const result = await runCareOperations({
        input: buildInput({
            intent: "home_medication_status",
            request: null,
        }),
        tools: {
            async call(name) {
                if (name === "load_home_medication_state") {
                    return buildState()
                }
                prepareCalls += 1
                throw new Error("proposal tool must not be called")
            },
        },
    })

    assert.equal(result.result_status, "answer_only")
    assert.equal(result.run_disposition, "complete_no_action")
    assert.equal(result.governed_action, null)
    assert.equal(prepareCalls, 0)
})

test("requires clarification for uncertain administration language without proposing", async () => {
    let prepareCalls = 0
    const result = await runCareOperations({
        input: buildInput({
            medication_subject: null,
            display_name: "home medication",
            request: {
                medication_subject: null,
                administered_date: null,
                issue: "uncertain_statement",
            },
        }),
        tools: {
            async call(name) {
                if (name === "load_home_medication_state") {
                    return buildState()
                }
                prepareCalls += 1
                return null
            },
        },
    })

    assert.equal(result.result_status, "clarification_required")
    assert.equal(result.action_preparation.status, "uncertain_statement")
    assert.equal(result.governed_action, null)
    assert.equal(prepareCalls, 0)
})

test("prepares one governed proposal while leaving approval and execution outside the specialist", async () => {
    const action = buildAction()
    let prepareCalls = 0
    const result = await runCareOperations({
        input: buildInput(),
        tools: {
            async call(name) {
                if (name === "load_home_medication_state") {
                    return buildState()
                }
                prepareCalls += 1
                return {
                    status: "prepared",
                    displayName: "Simparica Trio",
                    administeredDate: "2026-08-18",
                    disposition: "created",
                    action,
                    reminder: { id: "reminder-1" },
                }
            },
        },
    })

    assert.equal(result.result_status, "action_prepared")
    assert.equal(result.run_disposition, "awaiting_human_review")
    assert.equal(result.governed_action.id, "action-1")
    assert.equal(result.governed_action.status, "proposed")
    assert.equal(result.pending_human_decision, "review_proposed_care_action")
    assert.equal(prepareCalls, 1)
    assert.equal("approved_at" in result.governed_action, false)
    assert.equal("executed_at" in result.governed_action, false)
})

test("recovers an identical pending proposal without calling the proposal tool", async () => {
    const action = buildAction()
    let prepareCalls = 0
    const state = buildState({
        pending_actions: [
            {
                id: action.id,
                status: action.status,
                action_type: action.action_type,
                source_event_id: action.source_event_id,
                medication_subject: "simparica_trio",
                administered_date: "2026-08-18",
                record: action,
            },
        ],
    })
    const result = await runCareOperations({
        input: buildInput(),
        tools: {
            async call(name) {
                if (name === "load_home_medication_state") return state
                prepareCalls += 1
                return null
            },
        },
    })

    assert.equal(result.result_status, "action_already_prepared")
    assert.equal(result.action_preparation.disposition, "existing")
    assert.equal(result.action_preparation.action.id, "action-1")
    assert.equal(prepareCalls, 0)
})

test("refuses a second proposal when a different pending date needs review", async () => {
    let prepareCalls = 0
    const action = buildAction({
        preview_json: {
            care_item: "Simparica Trio",
            administered_date: "2026-08-17",
        },
    })
    const result = await runCareOperations({
        input: buildInput(),
        tools: {
            async call(name) {
                if (name === "load_home_medication_state") {
                    return buildState({
                        pending_actions: [
                            {
                                id: action.id,
                                status: action.status,
                                action_type: action.action_type,
                                source_event_id: action.source_event_id,
                                medication_subject: "simparica_trio",
                                administered_date: "2026-08-17",
                                record: action,
                            },
                        ],
                    })
                }
                prepareCalls += 1
                return null
            },
        },
    })

    assert.equal(result.result_status, "existing_action_requires_review")
    assert.equal(result.action_preparation.status, "not_eligible")
    assert.equal(result.governed_action.id, "action-1")
    assert.equal(prepareCalls, 0)
})

test("fails stale when trusted state no longer matches the manager fingerprint", async () => {
    const handoff = await invokeSpecialist({
        contract: CARE_OPERATIONS_CONTRACT,
        input: buildInput(),
        handler: runCareOperations,
        tools: {
            async load_home_medication_state() {
                return buildState({
                    context_fingerprint: "changed-fingerprint",
                })
            },
            async prepare_home_medication_action() {
                throw new Error("must not prepare")
            },
        },
    })

    assert.equal(handoff.status, "failed")
    assert.equal(handoff.failure.type, "stale_evidence")
    assert.equal(handoff.failure.retryable, true)
})

test("rejects conversational text in the structured handoff", async () => {
    const handoff = await invokeSpecialist({
        contract: CARE_OPERATIONS_CONTRACT,
        input: {
            ...buildInput(),
            question: "I gave Simparica today.",
        },
        handler: runCareOperations,
        tools: {},
    })

    assert.equal(handoff.status, "failed")
    assert.equal(handoff.failure.type, "malformed_input")
})
