import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { listPendingCareActions } from "./listPendingCareActions.js"

const repositoryUrl = new URL(
    "../repositories/careActionRepository.js",
    import.meta.url
)

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

function buildRepository(actions = []) {
    const calls = []

    return {
        calls,
        async findPendingActionsByPetId(petId) {
            calls.push(petId)
            return actions
        },
    }
}

test("returns the actual pending action count and rows", async () => {
    const actions = [
        { id: "action-2", status: "proposed" },
        { id: "action-1", status: "approved" },
    ]
    const repository = buildRepository(actions)

    const result = await listPendingCareActions({
        repository,
        petId: PET_ID,
    })

    assert.equal(result.count, 2)
    assert.equal(result.actions, actions)
    assert.deepEqual(repository.calls, [PET_ID])
})

test("returns zero rather than inventing a pending action", async () => {
    const repository = buildRepository()

    const result = await listPendingCareActions({
        repository,
        petId: PET_ID,
    })

    assert.deepEqual(result, {
        count: 0,
        actions: [],
    })
})

test("requires a pet id before querying the repository", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () =>
            listPendingCareActions({
                repository,
                petId: "",
            }),
        /petId is required/
    )
    assert.equal(repository.calls.length, 0)
})

test("requires the pending-action repository method", async () => {
    await assert.rejects(
        () =>
            listPendingCareActions({
                repository: {},
                petId: PET_ID,
            }),
        /repository\.findPendingActionsByPetId is required/
    )
})

test("keeps outcome-unknown actions visible for governed recovery", async () => {
    const source = await readFile(repositoryUrl, "utf8")

    assert.match(
        source,
        /PENDING_CARE_ACTION_STATUSES\s*=\s*\[[\s\S]*"outcome_unknown"/
    )
})
