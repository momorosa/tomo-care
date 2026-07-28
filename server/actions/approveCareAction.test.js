import test from "node:test"
import assert from "node:assert/strict"
import {
    ActionApprovalError,
    approveCareAction,
} from "./approveCareAction.js"
import { buildMarkHomeMedicationGivenProposal } from "./homeMedicationGiven.js"
import { buildMarkInsuranceClaimFiledProposal } from "./insuranceClaimFiled.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const REMINDER_ID = "11111111-1111-4111-8111-111111111111"
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222"
const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SOURCE_UPDATED_AT = "2026-07-06T12:00:00.000Z"
const APPROVED_AT = "2026-07-20T15:05:00.000Z"

function buildReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        pet_id: PET_ID,
        event_type: "reminder",
        event_date: "2026-07-19",
        status: "planned",
        updated_at: SOURCE_UPDATED_AT,
        details_json: {
            care_item: "Simparica Trio",
            care_category: "at_home_medication",
            reminder_type: "home_medication",
            cadence_days: 30,
            last_administered_date: "2026-06-22",
            preferred_admin_day: "Monday",
            reminder_days_before: 1,
            requires_appointment: false,
            route: "oral chewable",
            administered_by: "Rosa",
        },
        ...overrides,
    }
}

function buildAction(overrides = {}) {
    const proposal = buildMarkHomeMedicationGivenProposal({
        petId: PET_ID,
        reminder: buildReminder(),
        administeredDate: "2026-07-20",
        currentCareDate: "2026-07-20",
        requestSource: "dashboard",
        requestedBy: "Rosa",
    })

    return {
        id: ACTION_ID,
        ...proposal,
        proposed_at: "2026-07-20T15:00:00.000Z",
        approved_at: null,
        approved_by: null,
        created_at: "2026-07-20T15:00:00.000Z",
        updated_at: "2026-07-20T15:00:00.000Z",
        ...overrides,
    }
}

function buildInsuranceReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        pet_id: PET_ID,
        doc_id: DOCUMENT_ID,
        event_type: "reminder",
        event_date: "2026-05-14",
        status: "planned",
        updated_at: SOURCE_UPDATED_AT,
        details_json: {
            subtype: "Insurance claim",
            insurance_provider: "Nationwide",
            treatment_date: "2026-04-14",
            target_submit_date: "2026-05-14",
            claim_deadline_date: "2026-10-11",
            source_document_id: DOCUMENT_ID,
            source_document_title: "SoMa Animal Hospital receipt",
        },
        ...overrides,
    }
}

function buildSourceDocument(overrides = {}) {
    return {
        id: DOCUMENT_ID,
        pet_id: PET_ID,
        title: "SoMa Animal Hospital receipt",
        doc_type: "receipt",
        doc_date: "2026-04-14",
        source_org: "SoMa Animal Hospital",
        status: "verified",
        ...overrides,
    }
}

function buildInsuranceAction(overrides = {}) {
    const proposal = buildMarkInsuranceClaimFiledProposal({
        petId: PET_ID,
        reminder: buildInsuranceReminder(),
        sourceDocument: buildSourceDocument(),
        filedDate: "2026-07-24",
        currentCareDate: "2026-07-24",
        requestSource: "dashboard",
        requestedBy: "Rosa",
    })

    return {
        id: ACTION_ID,
        ...proposal,
        proposed_at: "2026-07-24T15:00:00.000Z",
        approved_at: null,
        approved_by: null,
        created_at: "2026-07-24T15:00:00.000Z",
        updated_at: "2026-07-24T15:00:00.000Z",
        ...overrides,
    }
}

function buildRepository({
    action = buildAction(),
    reminder = buildReminder(),
    sourceDocument = buildSourceDocument(),
    approvalResult,
    latestAction = null,
} = {}) {
    const calls = {
        findActionById: [],
        findReminder: [],
        findVerifiedDocument: [],
        approveProposedAction: [],
    }
    let actionLookupCount = 0

    return {
        calls,
        async findActionById(actionId) {
            calls.findActionById.push(actionId)
            actionLookupCount += 1
            return actionLookupCount === 1 ? action : latestAction
        },
        async findReminder(args) {
            calls.findReminder.push(args)
            return reminder
        },
        async findVerifiedDocument(args) {
            calls.findVerifiedDocument.push(args)
            return sourceDocument
        },
        async approveProposedAction(args) {
            calls.approveProposedAction.push(args)

            if (approvalResult !== undefined) return approvalResult

            return {
                ...action,
                status: "approved",
                approved_by: args.approvedBy,
                approved_at: args.approvedAt,
                updated_at: args.approvedAt,
            }
        },
    }
}

function approve(repository, overrides = {}) {
    return approveCareAction({
        repository,
        actionId: ACTION_ID,
        approvedBy: "Rosa",
        currentCareDate: "2026-07-20",
        approvedAt: APPROVED_AT,
        ...overrides,
    })
}

test("approves a current proposal without executing its planned changes", async () => {
    const repository = buildRepository()
    const result = await approve(repository)

    assert.equal(result.disposition, "approved")
    assert.equal(result.action.status, "approved")
    assert.equal(result.action.approved_by, "Rosa")
    assert.equal(result.action.approved_at, APPROVED_AT)
    assert.deepEqual(repository.calls.findReminder, [
        { petId: PET_ID, reminderId: REMINDER_ID },
    ])
    assert.deepEqual(repository.calls.approveProposedAction, [
        {
            actionId: ACTION_ID,
            approvedBy: "Rosa",
            approvedAt: APPROVED_AT,
            expectedUpdatedAt: "2026-07-20T15:00:00.000Z",
        },
    ])
})

test("treats an already-approved action as an idempotent success", async () => {
    const action = buildAction({
        status: "approved",
        approved_by: "Rosa",
        approved_at: APPROVED_AT,
    })
    const repository = buildRepository({ action })
    const result = await approve(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(result.action.approved_by, "Rosa")
    assert.equal(repository.calls.findReminder.length, 0)
    assert.equal(repository.calls.approveProposedAction.length, 0)
})

test("rejects terminal and in-progress action states", async () => {
    for (const status of ["executing", "succeeded", "failed", "cancelled"]) {
        const repository = buildRepository({
            action: buildAction({ status }),
        })

        await assert.rejects(
            () => approve(repository),
            (error) => {
                assert.ok(error instanceof ActionApprovalError)
                assert.equal(error.status, 409)
                assert.equal(error.reason, "action_not_proposed")
                return true
            }
        )
        assert.equal(repository.calls.approveProposedAction.length, 0)
    }
})

test("rejects a proposal when its source reminder changed", async () => {
    const repository = buildRepository({
        reminder: buildReminder({
            updated_at: "2026-07-20T15:02:00.000Z",
        }),
    })

    await assert.rejects(
        () => approve(repository),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "source_evidence_changed")
            return true
        }
    )
    assert.equal(repository.calls.approveProposedAction.length, 0)
})

test("rejects a proposal when its source reminder disappeared", async () => {
    const repository = buildRepository({ reminder: null })

    await assert.rejects(
        () => approve(repository),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "source_evidence_missing")
            return true
        }
    )
})

test("rejects a proposal that is no longer eligible", async () => {
    const repository = buildRepository({
        reminder: buildReminder({ status: "completed" }),
    })

    await assert.rejects(
        () => approve(repository),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "action_no_longer_eligible")
            return true
        }
    )
})

test("resolves a simultaneous approval as an idempotent success", async () => {
    const latestAction = buildAction({
        status: "approved",
        approved_by: "Rosa",
        approved_at: APPROVED_AT,
    })
    const repository = buildRepository({
        approvalResult: null,
        latestAction,
    })
    const result = await approve(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(result.action.status, "approved")
    assert.equal(repository.calls.findActionById.length, 2)
})

test("rejects an unknown action type", async () => {
    const repository = buildRepository({
        action: buildAction({ action_type: "send_unreviewed_message" }),
    })

    await assert.rejects(
        () => approve(repository),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "unsupported_action_type")
            return true
        }
    )
})

test("requires an explicit approver before reading action state", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () => approve(repository, { approvedBy: "" }),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 400)
            assert.equal(error.reason, "invalid_request")
            return true
        }
    )
    assert.equal(repository.calls.findActionById.length, 0)
})

test("approves an insurance claim proposal after revalidating both trusted sources", async () => {
    const repository = buildRepository({
        action: buildInsuranceAction(),
        reminder: buildInsuranceReminder(),
    })

    const result = await approve(repository, {
        currentCareDate: "2026-07-24",
    })

    assert.equal(result.disposition, "approved")
    assert.equal(result.action.status, "approved")
    assert.deepEqual(repository.calls.findReminder, [
        { petId: PET_ID, reminderId: REMINDER_ID },
    ])
    assert.deepEqual(repository.calls.findVerifiedDocument, [
        { petId: PET_ID, documentId: DOCUMENT_ID },
    ])
    assert.equal(repository.calls.approveProposedAction.length, 1)
})

test("rejects an insurance claim proposal when its document is no longer verified", async () => {
    const repository = buildRepository({
        action: buildInsuranceAction(),
        reminder: buildInsuranceReminder(),
        sourceDocument: null,
    })

    await assert.rejects(
        () =>
            approve(repository, {
                currentCareDate: "2026-07-24",
            }),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "source_evidence_missing")
            return true
        }
    )
    assert.equal(repository.calls.approveProposedAction.length, 0)
})

test("rejects an insurance claim proposal when verified document evidence changed", async () => {
    const repository = buildRepository({
        action: buildInsuranceAction(),
        reminder: buildInsuranceReminder(),
        sourceDocument: buildSourceDocument({
            title: "Updated receipt title",
        }),
    })

    await assert.rejects(
        () =>
            approve(repository, {
                currentCareDate: "2026-07-24",
            }),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "source_evidence_changed")
            return true
        }
    )
    assert.equal(repository.calls.approveProposedAction.length, 0)
})

test("rejects a tampered insurance claim proposal before recording approval", async () => {
    const action = buildInsuranceAction()
    const repository = buildRepository({
        action: {
            ...action,
            payload_json: {
                ...action.payload_json,
                filed_date: "2026-07-23",
            },
        },
        reminder: buildInsuranceReminder(),
    })

    await assert.rejects(
        () =>
            approve(repository, {
                currentCareDate: "2026-07-24",
            }),
        (error) => {
            assert.ok(error instanceof ActionApprovalError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "invalid_action_contract")
            return true
        }
    )
    assert.equal(repository.calls.approveProposedAction.length, 0)
})