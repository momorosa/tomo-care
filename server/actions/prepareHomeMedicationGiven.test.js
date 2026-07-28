import test from "node:test"
import assert from "node:assert/strict"
import {
    ActionPreparationError,
    prepareMarkHomeMedicationGiven,
} from "./prepareHomeMedicationGiven.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const REMINDER_ID = "11111111-1111-4111-8111-111111111111"

function buildReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        pet_id: PET_ID,
        event_type: "reminder",
        event_date: "2026-07-19",
        status: "planned",
        updated_at: "2026-07-06T12:00:00.000Z",
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

function buildStoredAction(proposal = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ...proposal,
        proposed_at: "2026-07-20T15:00:00.000Z",
        created_at: "2026-07-20T15:00:00.000Z",
        updated_at: "2026-07-20T15:00:00.000Z",
    }
}

function buildRepository({
    reminder = buildReminder(),
    existingAction = null,
    insertError = null,
    racedAction = null,
} = {}) {
    const calls = {
        findReminder: [],
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
    return prepareMarkHomeMedicationGiven({
        repository,
        petId: PET_ID,
        reminderId: REMINDER_ID,
        administeredDate: "2026-07-20",
        currentCareDate: "2026-07-20",
        requestSource: "dashboard",
        requestedBy: "Rosa",
        ...overrides,
    })
}

test("loads trusted evidence and inserts only a proposed care action", async () => {
    const repository = buildRepository()
    const result = await prepare(repository)

    assert.equal(result.disposition, "created")
    assert.equal(result.action.status, "proposed")
    assert.equal(result.action.source_event_id, REMINDER_ID)
    assert.deepEqual(repository.calls.findReminder, [
        { petId: PET_ID, reminderId: REMINDER_ID },
    ])
    assert.equal(repository.calls.insertProposedAction.length, 1)
    assert.equal(
        repository.calls.insertProposedAction[0].preview_json.changes.length,
        3
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

test("uses the unique index to resolve two simultaneous preparations", async () => {
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
            assert.ok(error instanceof ActionPreparationError)
            assert.equal(error.status, 404)
            assert.equal(error.reason, "reminder_not_found")
            return true
        }
    )
    assert.equal(repository.calls.insertProposedAction.length, 0)
})

test("does not insert when the trusted reminder is not eligible", async () => {
    const repository = buildRepository({
        reminder: buildReminder({ status: "completed" }),
    })

    await assert.rejects(
        () => prepare(repository),
        (error) => {
            assert.ok(error instanceof ActionPreparationError)
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
        () => prepare(repository, { administeredDate: "" }),
        (error) => {
            assert.ok(error instanceof ActionPreparationError)
            assert.equal(error.status, 400)
            assert.equal(error.reason, "invalid_request")
            return true
        }
    )
    assert.equal(repository.calls.findReminder.length, 0)
})