import test from "node:test"
import assert from "node:assert/strict"
import {
    LibrelaAppointmentPreparationError,
    prepareSendLibrelaAppointmentRequest,
} from "./prepareLibrelaAppointmentRequest.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const ORCHESTRATION_RUN_ID = "77777777-7777-4777-8777-777777777777"
const REMINDER_ID = "11111111-1111-4111-8111-111111111111"
const INJECTION_ID = "22222222-2222-4222-8222-222222222222"
const CONTACT_ID = "33333333-3333-4333-8333-333333333333"
const MESSAGE_BODY = "Please schedule Momo’s next Librela injection."

function buildReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        pet_id: PET_ID,
        event_type: "reminder",
        event_date: "2026-07-22",
        status: "planned",
        updated_at: "2026-07-20T12:00:00.000Z",
        details_json: {
            subtype: "Librela",
            due_date: "2026-07-29",
            anchor_event_id: INJECTION_ID,
            source_org: "SoMa Animal Hospital",
        },
        ...overrides,
    }
}

function buildInjection(overrides = {}) {
    return {
        id: INJECTION_ID,
        pet_id: PET_ID,
        event_type: "injection",
        event_date: "2026-06-10",
        status: "verified",
        updated_at: "2026-06-10T18:00:00.000Z",
        details_json: { subtype: "Librela" },
        ...overrides,
    }
}

function buildRecipient(overrides = {}) {
    return {
        id: CONTACT_ID,
        organization_name: "SoMa Animal Hospital",
        channel: "sms",
        address: buildTestSmsAddress(),
        verification_status: "verified",
        verification_source: "owner_confirmed_clinic_text_thread",
        verified_by: "Rosa",
        verified_at: "2026-07-28T17:00:00.000Z",
        is_active: true,
        updated_at: "2026-07-28T17:00:00.000Z",
        ...overrides,
    }
}

function buildStoredAction(proposal = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ...proposal,
        proposed_at: "2026-07-28T18:00:00.000Z",
        created_at: "2026-07-28T18:00:00.000Z",
        updated_at: "2026-07-28T18:00:00.000Z",
    }
}

function buildOrchestrationRun(overrides = {}) {
    return {
        id: ORCHESTRATION_RUN_ID,
        pet_id: PET_ID,
        workflow_type: "librela_appointment_request",
        status: "awaiting_human_review",
        current_step: "human_review",
        external_action_taken: false,
        result_json: {
            status: "prepared",
            draft: {
                evidence: {
                    reminder_event_id: REMINDER_ID,
                    injection_event_id: INJECTION_ID,
                },
            },
        },
        ...overrides,
    }
}

function buildRepository({
    reminder = buildReminder(),
    injection = buildInjection(),
    orchestrationRun = buildOrchestrationRun(),
    recipients = [buildRecipient()],
    existingAction = null,
    insertError = null,
    racedAction = null,
} = {}) {
    const calls = {
        findReminder: [],
        findEvent: [],
        findOrchestrationRunById: [],
        findVerifiedProviderContacts: [],
        findActiveActionByIdempotencyKey: [],
        insertProposedAction: [],
        linkActionToOrchestrationRun: [],
    }
    let activeLookupCount = 0

    return {
        calls,
        async findReminder(args) {
            calls.findReminder.push(args)
            return reminder
        },
        async findEvent(args) {
            calls.findEvent.push(args)
            return injection
        },
        async findOrchestrationRunById(runId) {
            calls.findOrchestrationRunById.push(runId)
            return orchestrationRun
        },
        async findVerifiedProviderContacts(args) {
            calls.findVerifiedProviderContacts.push(args)
            return recipients
        },
        async findActiveActionByIdempotencyKey(key) {
            calls.findActiveActionByIdempotencyKey.push(key)
            activeLookupCount += 1
            return activeLookupCount === 1 ? existingAction : racedAction
        },
        async insertProposedAction(proposal) {
            calls.insertProposedAction.push(proposal)
            if (insertError) throw insertError
            return buildStoredAction(proposal)
        },
        async linkActionToOrchestrationRun(args) {
            calls.linkActionToOrchestrationRun.push(args)
            return {
                ...(existingAction || racedAction),
                orchestration_run_id: args.orchestrationRunId,
            }
        },
    }
}

function prepare(repository, overrides = {}) {
    return prepareSendLibrelaAppointmentRequest({
        repository,
        petId: PET_ID,
        orchestrationRunId: ORCHESTRATION_RUN_ID,
        reminderId: REMINDER_ID,
        injectionId: INJECTION_ID,
        messageBody: MESSAGE_BODY,
        requestSource: "dashboard",
        requestedBy: "Rosa",
        ...overrides,
    })
}

test("loads trusted evidence and inserts only one frozen proposal", async () => {
    const repository = buildRepository()
    const result = await prepare(repository)

    assert.equal(result.disposition, "created")
    assert.equal(result.action.status, "proposed")
    assert.equal(
        result.action.orchestration_run_id,
        ORCHESTRATION_RUN_ID
    )
    assert.deepEqual(repository.calls.findReminder, [
        { petId: PET_ID, reminderId: REMINDER_ID },
    ])
    assert.deepEqual(repository.calls.findEvent, [
        { petId: PET_ID, eventId: INJECTION_ID },
    ])
    assert.deepEqual(repository.calls.findOrchestrationRunById, [
        ORCHESTRATION_RUN_ID,
    ])
    assert.deepEqual(repository.calls.findVerifiedProviderContacts, [
        {
            organizationName: "SoMa Animal Hospital",
            channel: "sms",
        },
    ])
    assert.equal(repository.calls.insertProposedAction.length, 1)
})

test("requires exactly one active verified clinic recipient", async () => {
    for (const [recipients, reason] of [
        [[], "recipient_not_found"],
        [[buildRecipient(), buildRecipient({ id: "contact-2" })], "recipient_ambiguous"],
    ]) {
        const repository = buildRepository({ recipients })

        await assert.rejects(
            () => prepare(repository),
            (error) => {
                assert.ok(error instanceof LibrelaAppointmentPreparationError)
                assert.equal(error.status, 409)
                assert.equal(error.reason, reason)
                return true
            }
        )
        assert.equal(repository.calls.insertProposedAction.length, 0)
    }
})

test("returns the existing action for the same recipient and exact message", async () => {
    const existingAction = buildStoredAction({
        status: "proposed",
        orchestration_run_id: ORCHESTRATION_RUN_ID,
    })
    const repository = buildRepository({ existingAction })
    const result = await prepare(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(result.action.id, existingAction.id)
    assert.equal(repository.calls.insertProposedAction.length, 0)
    assert.equal(
        repository.calls.linkActionToOrchestrationRun.length,
        0
    )
})

test("links a pre-existing action to its originating workflow", async () => {
    const existingAction = buildStoredAction({
        status: "succeeded",
        orchestration_run_id: null,
    })
    const repository = buildRepository({ existingAction })
    const result = await prepare(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(
        result.action.orchestration_run_id,
        ORCHESTRATION_RUN_ID
    )
    assert.deepEqual(
        repository.calls.linkActionToOrchestrationRun,
        [
            {
                actionId: existingAction.id,
                orchestrationRunId: ORCHESTRATION_RUN_ID,
            },
        ]
    )
})

test("uses the unique index to resolve simultaneous preparations", async () => {
    const racedAction = buildStoredAction({ status: "proposed" })
    const repository = buildRepository({
        insertError: Object.assign(new Error("duplicate key"), {
            code: "23505",
        }),
        racedAction,
    })
    const result = await prepare(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(result.action.id, racedAction.id)
    assert.equal(
        repository.calls.findActiveActionByIdempotencyKey.length,
        2
    )
})

test("rejects missing evidence and incomplete input before inserting", async () => {
    const missingInjectionRepository = buildRepository({ injection: null })

    await assert.rejects(
        () => prepare(missingInjectionRepository),
        (error) => {
            assert.equal(error.reason, "source_evidence_missing")
            return true
        }
    )

    const repository = buildRepository()
    await assert.rejects(
        () => prepare(repository, { messageBody: "" }),
        (error) => {
            assert.equal(error.reason, "invalid_request")
            return true
        }
    )
    assert.equal(repository.calls.findReminder.length, 0)
})

test("rejects a missing or mismatched orchestration run", async () => {
    for (const [orchestrationRun, reason] of [
        [null, "orchestration_run_not_found"],
        [
            buildOrchestrationRun({
                result_json: {
                    status: "prepared",
                    draft: {
                        evidence: {
                            reminder_event_id: "different-reminder",
                            injection_event_id: INJECTION_ID,
                        },
                    },
                },
            }),
            "orchestration_run_changed",
        ],
        [
            buildOrchestrationRun({
                external_action_taken: true,
            }),
            "orchestration_run_changed",
        ],
    ]) {
        const repository = buildRepository({ orchestrationRun })

        await assert.rejects(
            () => prepare(repository),
            (error) => {
                assert.equal(error.reason, reason)
                return true
            }
        )
        assert.equal(repository.calls.insertProposedAction.length, 0)
    }
})

function buildTestSmsAddress() {
    return String.fromCharCode(
        43,
        49,
        52,
        49,
        53,
        53,
        53,
        53,
        48,
        49,
        57,
        57
    )
}
