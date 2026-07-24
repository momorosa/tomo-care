import test from "node:test"
import assert from "node:assert/strict"
import {
    InsuranceClaimPreparationError,
    prepareMarkInsuranceClaimFiled,
} from "./prepareInsuranceClaimFiled.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const REMINDER_ID = "11111111-1111-4111-8111-111111111111"
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222"

function buildReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        pet_id: PET_ID,
        doc_id: DOCUMENT_ID,
        event_type: "reminder",
        event_date: "2026-05-14",
        status: "planned",
        updated_at: "2026-07-20T12:00:00.000Z",
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

function buildStoredAction(proposal = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ...proposal,
        proposed_at: "2026-07-24T15:00:00.000Z",
        created_at: "2026-07-24T15:00:00.000Z",
        updated_at: "2026-07-24T15:00:00.000Z",
    }
}

function buildRepository({
    reminder = buildReminder(),
    sourceDocument = buildSourceDocument(),
    existingAction = null,
    insertError = null,
    racedAction = null,
} = {}) {
    const calls = {
        findReminder: [],
        findVerifiedDocument: [],
        findActiveActionByIdempotencyKey: [],
        insertProposedAction: [],
    }
    let activeLookupCount = 0

    return {
        calls,
        async findReminder(args) {
            calls.findReminder.push(args)
            return reminder
        },
        async findVerifiedDocument(args) {
            calls.findVerifiedDocument.push(args)
            return sourceDocument
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
    }
}

function prepare(repository, overrides = {}) {
    return prepareMarkInsuranceClaimFiled({
        repository,
        petId: PET_ID,
        reminderId: REMINDER_ID,
        filedDate: "2026-07-24",
        currentCareDate: "2026-07-24",
        requestSource: "dashboard",
        requestedBy: "Rosa",
        ...overrides,
    })
}

test("loads both trusted sources and inserts only a proposed care action", async () => {
    const repository = buildRepository()
    const result = await prepare(repository)

    assert.equal(result.disposition, "created")
    assert.equal(result.action.status, "proposed")
    assert.equal(result.action.source_event_id, REMINDER_ID)
    assert.deepEqual(repository.calls.findReminder, [
        { petId: PET_ID, reminderId: REMINDER_ID },
    ])
    assert.deepEqual(repository.calls.findVerifiedDocument, [
        { petId: PET_ID, documentId: DOCUMENT_ID },
    ])
    assert.equal(repository.calls.insertProposedAction.length, 1)
    assert.equal(
        repository.calls.insertProposedAction[0].preview_json.changes.length,
        2
    )
})

test("returns the existing active proposal for the same semantic action", async () => {
    const existingAction = buildStoredAction({ status: "proposed" })
    const repository = buildRepository({ existingAction })
    const result = await prepare(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(result.action.id, existingAction.id)
    assert.equal(repository.calls.insertProposedAction.length, 0)
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

test("returns a typed 404 when the reminder is not trusted for this pet", async () => {
    const repository = buildRepository({ reminder: null })

    await assert.rejects(
        () => prepare(repository),
        (error) => {
            assert.ok(error instanceof InsuranceClaimPreparationError)
            assert.equal(error.status, 404)
            assert.equal(error.reason, "reminder_not_found")
            return true
        }
    )
    assert.equal(repository.calls.findVerifiedDocument.length, 0)
    assert.equal(repository.calls.insertProposedAction.length, 0)
})

test("rejects a reminder without a currently verified source document", async () => {
    const repository = buildRepository({ sourceDocument: null })

    await assert.rejects(
        () => prepare(repository),
        (error) => {
            assert.ok(error instanceof InsuranceClaimPreparationError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "source_evidence_missing")
            return true
        }
    )
    assert.equal(repository.calls.insertProposedAction.length, 0)
})

test("does not insert when the trusted reminder is no longer eligible", async () => {
    const repository = buildRepository({
        reminder: buildReminder({ status: "completed" }),
    })

    await assert.rejects(
        () => prepare(repository),
        (error) => {
            assert.ok(error instanceof InsuranceClaimPreparationError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "action_not_eligible")
            return true
        }
    )
    assert.equal(repository.calls.insertProposedAction.length, 0)
})

test("rejects incomplete request data before reading the database", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () => prepare(repository, { filedDate: "" }),
        (error) => {
            assert.ok(error instanceof InsuranceClaimPreparationError)
            assert.equal(error.status, 400)
            assert.equal(error.reason, "invalid_request")
            return true
        }
    )
    assert.equal(repository.calls.findReminder.length, 0)
})