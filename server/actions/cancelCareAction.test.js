import test from "node:test"
import assert from "node:assert/strict"
import {
    ActionCancellationError,
    cancelCareAction,
} from "./cancelCareAction.js"

const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const UPDATED_AT = "2026-07-20T15:00:00.000Z"
const CANCELLED_AT = "2026-07-20T15:03:00.000Z"

function buildAction(overrides = {}) {
    return {
        id: ACTION_ID,
        status: "proposed",
        updated_at: UPDATED_AT,
        cancelled_at: null,
        ...overrides,
    }
}

function buildRepository({
    action = buildAction(),
    cancellationResult,
    latestAction = null,
} = {}) {
    const calls = {
        findActionById: [],
        cancelProposedAction: [],
    }
    let lookupCount = 0

    return {
        calls,
        async findActionById(actionId) {
            calls.findActionById.push(actionId)
            lookupCount += 1
            return lookupCount === 1 ? action : latestAction
        },
        async cancelProposedAction(args) {
            calls.cancelProposedAction.push(args)

            if (cancellationResult !== undefined) return cancellationResult

            return buildAction({
                status: "cancelled",
                cancelled_at: args.cancelledAt,
                updated_at: args.cancelledAt,
            })
        },
    }
}

function cancel(repository, overrides = {}) {
    return cancelCareAction({
        repository,
        actionId: ACTION_ID,
        cancelledAt: CANCELLED_AT,
        ...overrides,
    })
}

test("cancels a proposal without changing trusted care records", async () => {
    const repository = buildRepository()
    const result = await cancel(repository)

    assert.equal(result.disposition, "cancelled")
    assert.equal(result.action.status, "cancelled")
    assert.deepEqual(repository.calls.cancelProposedAction, [
        {
            actionId: ACTION_ID,
            cancelledAt: CANCELLED_AT,
            expectedUpdatedAt: UPDATED_AT,
        },
    ])
})

test("treats an already-cancelled proposal as an idempotent success", async () => {
    const repository = buildRepository({
        action: buildAction({
            status: "cancelled",
            cancelled_at: CANCELLED_AT,
        }),
    })
    const result = await cancel(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(repository.calls.cancelProposedAction.length, 0)
})

test("does not cancel approved, executing, succeeded, or failed actions", async () => {
    for (const status of ["approved", "executing", "succeeded", "failed"]) {
        const repository = buildRepository({
            action: buildAction({ status }),
        })

        await assert.rejects(
            () => cancel(repository),
            (error) => {
                assert.ok(error instanceof ActionCancellationError)
                assert.equal(error.status, 409)
                assert.equal(error.reason, "action_not_cancellable")
                return true
            }
        )
        assert.equal(repository.calls.cancelProposedAction.length, 0)
    }
})

test("resolves a simultaneous cancellation as an idempotent success", async () => {
    const latestAction = buildAction({
        status: "cancelled",
        cancelled_at: CANCELLED_AT,
    })
    const repository = buildRepository({
        cancellationResult: null,
        latestAction,
    })
    const result = await cancel(repository)

    assert.equal(result.disposition, "existing")
    assert.equal(repository.calls.findActionById.length, 2)
})

test("rejects a missing action", async () => {
    const repository = buildRepository({ action: null })

    await assert.rejects(
        () => cancel(repository),
        (error) => {
            assert.equal(error.status, 404)
            assert.equal(error.reason, "action_not_found")
            return true
        }
    )
})

test("requires an action id before reading action state", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () => cancel(repository, { actionId: "" }),
        (error) => {
            assert.equal(error.status, 400)
            assert.equal(error.reason, "invalid_request")
            return true
        }
    )
    assert.equal(repository.calls.findActionById.length, 0)
})
