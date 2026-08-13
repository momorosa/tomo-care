import assert from "node:assert/strict"
import test from "node:test"
import {
    AppleMessagesHandoffResolutionError,
    resolveLibrelaAppleMessagesHandoff,
} from "./resolveLibrelaAppleMessagesHandoff.js"

const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function buildResolved(overrides = {}) {
    return {
        disposition: "resolved",
        action_id: ACTION_ID,
        action_status: "succeeded",
        handoff_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        state: "user_reported_sent",
        target_app: "apple_messages",
        contract_version: 1,
        resolved_at: "2026-08-13T03:30:00.000Z",
        ...overrides,
    }
}

function buildRepository({ result = buildResolved(), error = null } = {}) {
    const calls = []

    return {
        calls,
        async resolveLibrelaAppleMessagesHandoff(args) {
            calls.push(args)
            if (error) throw error
            return result
        },
    }
}

test("records sent only as an explicit human report", async () => {
    const repository = buildRepository()
    const result = await resolveLibrelaAppleMessagesHandoff({
        repository,
        actionId: ACTION_ID,
        resolution: "sent",
    })

    assert.deepEqual(repository.calls, [
        {
            actionId: ACTION_ID,
            resolution: "user_reported_sent",
            resolvedBy: "Rosa",
        },
    ])
    assert.equal(result.action.status, "succeeded")
    assert.equal(result.handoff.state, "user_reported_sent")
    assert.equal("delivered" in result.handoff, false)
    assert.equal("booked" in result.handoff, false)
})

test("records a confirmed not-sent draft as a cancelled action", async () => {
    const repository = buildRepository({
        result: buildResolved({
            action_status: "cancelled",
            state: "user_confirmed_not_sent",
        }),
    })
    const result = await resolveLibrelaAppleMessagesHandoff({
        repository,
        actionId: ACTION_ID,
        resolution: "not_sent",
    })

    assert.equal(result.action.status, "cancelled")
    assert.equal(result.handoff.state, "user_confirmed_not_sent")
})

test("accepts an idempotent existing resolution", async () => {
    const repository = buildRepository({
        result: buildResolved({ disposition: "existing" }),
    })
    const result = await resolveLibrelaAppleMessagesHandoff({
        repository,
        actionId: ACTION_ID,
        resolution: "sent",
    })

    assert.equal(result.disposition, "existing")
})

test("rejects missing, invalid, or conflicting resolution state", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () =>
            resolveLibrelaAppleMessagesHandoff({
                repository,
                actionId: ACTION_ID,
                resolution: "maybe",
            }),
        (error) => {
            assert.equal(error.reason, "invalid_resolution")
            return true
        }
    )
    assert.equal(repository.calls.length, 0)

    const conflictRepository = buildRepository({
        error: new Error(
            "handoff_resolution_conflict: private database detail"
        ),
    })

    await assert.rejects(
        () =>
            resolveLibrelaAppleMessagesHandoff({
                repository: conflictRepository,
                actionId: ACTION_ID,
                resolution: "sent",
            }),
        (error) => {
            assert.ok(error instanceof AppleMessagesHandoffResolutionError)
            assert.equal(error.status, 409)
            assert.equal(error.message.includes("private database"), false)
            return true
        }
    )
})
