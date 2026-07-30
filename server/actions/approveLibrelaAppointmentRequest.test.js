import test from "node:test"
import assert from "node:assert/strict"
import {
    ActionApprovalError,
    approveCareAction,
} from "./approveCareAction.js"
import { buildSendLibrelaAppointmentRequestProposal } from "./librelaAppointmentRequest.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const ORCHESTRATION_RUN_ID = "77777777-7777-4777-8777-777777777777"
const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REMINDER_ID = "11111111-1111-4111-8111-111111111111"
const INJECTION_ID = "22222222-2222-4222-8222-222222222222"
const CONTACT_ID = "33333333-3333-4333-8333-333333333333"

function buildReminder() {
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

function buildAction(overrides = {}) {
    const proposal = buildSendLibrelaAppointmentRequestProposal({
        petId: PET_ID,
        orchestrationRunId: ORCHESTRATION_RUN_ID,
        reminder: buildReminder(),
        injection: buildInjection(),
        recipient: buildRecipient(),
        messageBody: "Please schedule Momo’s next Librela injection.",
        requestSource: "dashboard",
        requestedBy: "Rosa",
    })

    return {
        id: ACTION_ID,
        ...proposal,
        updated_at: "2026-07-28T18:00:00.000Z",
        ...overrides,
    }
}

function buildRepository({
    action = buildAction(),
    injection = buildInjection(),
    recipient = buildRecipient(),
} = {}) {
    const calls = {
        approveProposedAction: [],
    }

    return {
        calls,
        async findActionById() {
            return action
        },
        async findReminder() {
            return buildReminder()
        },
        async findEvent() {
            return injection
        },
        async findVerifiedProviderContactById() {
            return recipient
        },
        async approveProposedAction(args) {
            calls.approveProposedAction.push(args)
            return {
                ...action,
                status: "approved",
                approved_by: args.approvedBy,
                approved_at: args.approvedAt,
            }
        },
    }
}

test("approves only when the exact message and recipient evidence still match", async () => {
    const repository = buildRepository()
    const result = await approveCareAction({
        repository,
        actionId: ACTION_ID,
        approvedBy: "Rosa",
        approvedAt: "2026-07-28T18:05:00.000Z",
    })

    assert.equal(result.disposition, "approved")
    assert.equal(result.action.status, "approved")
    assert.equal(repository.calls.approveProposedAction.length, 1)
})

test("rejects a recipient that changed after proposal creation", async () => {
    const repository = buildRepository({
        recipient: buildRecipient({
            updated_at: "2026-07-28T18:01:00.000Z",
        }),
    })

    await assert.rejects(
        () =>
            approveCareAction({
                repository,
                actionId: ACTION_ID,
                approvedBy: "Rosa",
            }),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.reason, "source_evidence_changed")
            return true
        }
    )
    assert.equal(repository.calls.approveProposedAction.length, 0)
})

test("rejects a message changed after the frozen proposal was created", async () => {
    const original = buildAction()
    const repository = buildRepository({
        action: {
            ...original,
            payload_json: {
                ...original.payload_json,
                message_body: `${original.payload_json.message_body}!`,
            },
        },
    })

    await assert.rejects(
        () =>
            approveCareAction({
                repository,
                actionId: ACTION_ID,
                approvedBy: "Rosa",
            }),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.reason, "invalid_action_contract")
            return true
        }
    )
    assert.equal(repository.calls.approveProposedAction.length, 0)
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
