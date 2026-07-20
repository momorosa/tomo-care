import test from "node:test"
import assert from "node:assert/strict"
import {
    ActionExecutionError,
    executeCareAction,
    mapDatabaseExecutionError,
} from "./executeCareAction.js"
import { MARK_HOME_MEDICATION_GIVEN } from "./homeMedicationGiven.js"

const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function buildResult() {
    return {
        schema_version: 1,
        execution_actor: "tomo-care-backend",
        administration_event_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        administration_date: "2026-07-20",
        completed_reminder_id: "11111111-1111-4111-8111-111111111111",
        next_reminder_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        next_reminder_date: "2026-08-16",
        next_target_admin_date: "2026-08-17",
        next_due_date: "2026-08-19",
    }
}

function buildAction(overrides = {}) {
    return {
        id: ACTION_ID,
        action_type: MARK_HOME_MEDICATION_GIVEN,
        status: "approved",
        result_json: null,
        ...overrides,
    }
}

function buildRepository({
    action = buildAction(),
    execution,
    executionError = null,
} = {}) {
    const calls = {
        findActionById: [],
        executeMarkHomeMedicationGiven: [],
    }

    return {
        calls,
        async findActionById(actionId) {
            calls.findActionById.push(actionId)
            return action
        },
        async executeMarkHomeMedicationGiven(args) {
            calls.executeMarkHomeMedicationGiven.push(args)
            if (executionError) throw executionError

            return (
                execution || {
                    disposition: "executed",
                    action_id: ACTION_ID,
                    status: "succeeded",
                    result: buildResult(),
                }
            )
        },
    }
}

function execute(repository, overrides = {}) {
    return executeCareAction({
        repository,
        actionId: ACTION_ID,
        currentCareDate: "2026-07-20",
        ...overrides,
    })
}

test("executes an approved action using only server-controlled inputs", async () => {
    const repository = buildRepository()
    const result = await execute(repository)

    assert.equal(result.disposition, "executed")
    assert.equal(result.status, "succeeded")
    assert.equal(result.result.next_reminder_date, "2026-08-16")
    assert.deepEqual(repository.calls.executeMarkHomeMedicationGiven, [
        {
            actionId: ACTION_ID,
            executedBy: "tomo-care-backend",
            careDate: "2026-07-20",
        },
    ])
})

test("returns an already-succeeded action without invoking execution again", async () => {
    const storedResult = buildResult()
    const repository = buildRepository({
        action: buildAction({
            status: "succeeded",
            result_json: storedResult,
        }),
    })
    const result = await execute(repository)

    assert.equal(result.disposition, "existing")
    assert.deepEqual(result.result, storedResult)
    assert.equal(repository.calls.executeMarkHomeMedicationGiven.length, 0)
})

test("does not claim success when a succeeded action is missing its result", async () => {
    const repository = buildRepository({
        action: buildAction({ status: "succeeded", result_json: null }),
    })

    await assert.rejects(
        () => execute(repository),
        (error) => {
            assert.equal(error.status, 502)
            assert.equal(error.reason, "invalid_execution_response")
            assert.equal(error.outcomeUnknown, true)
            return true
        }
    )
    assert.equal(repository.calls.executeMarkHomeMedicationGiven.length, 0)
})

test("blocks actions that have not been approved", async () => {
    for (const status of ["proposed", "executing", "failed", "cancelled"]) {
        const repository = buildRepository({
            action: buildAction({ status }),
        })

        await assert.rejects(
            () => execute(repository),
            (error) => {
                assert.ok(error instanceof ActionExecutionError)
                assert.equal(error.status, 409)
                assert.equal(error.reason, "action_not_approved")
                return true
            }
        )
        assert.equal(repository.calls.executeMarkHomeMedicationGiven.length, 0)
    }
})

test("blocks unsupported action types", async () => {
    const repository = buildRepository({
        action: buildAction({ action_type: "send_vet_message" }),
    })

    await assert.rejects(
        () => execute(repository),
        (error) => {
            assert.equal(error.status, 409)
            assert.equal(error.reason, "unsupported_action_type")
            return true
        }
    )
})

test("returns a typed 404 when the action does not exist", async () => {
    const repository = buildRepository({ action: null })

    await assert.rejects(
        () => execute(repository),
        (error) => {
            assert.equal(error.status, 404)
            assert.equal(error.reason, "action_not_found")
            return true
        }
    )
})

test("maps changed evidence to a reviewable, non-retryable response", async () => {
    const repository = buildRepository({
        executionError: new Error(
            "source_evidence_changed: the trusted reminder changed after approval"
        ),
    })

    await assert.rejects(
        () => execute(repository),
        (error) => {
            assert.equal(error.status, 409)
            assert.equal(error.reason, "source_evidence_changed")
            assert.equal(error.recovery, "prepare_again")
            assert.equal(error.retryable, false)
            assert.match(error.message, /Nothing was changed/)
            return true
        }
    )
})

test("maps ambiguous reminders without exposing database details", () => {
    const error = mapDatabaseExecutionError(
        new Error(
            "ambiguous_next_reminder: multiple planned reminders already exist"
        )
    )

    assert.equal(error.status, 409)
    assert.equal(error.reason, "ambiguous_next_reminder")
    assert.equal(error.recovery, "review_reminders")
    assert.doesNotMatch(error.message, /multiple planned reminders already exist/)
})

test("treats an unknown transport failure as an unknown but retry-safe outcome", async () => {
    const repository = buildRepository({
        executionError: new Error("socket closed before response"),
    })

    await assert.rejects(
        () => execute(repository),
        (error) => {
            assert.equal(error.status, 503)
            assert.equal(error.reason, "execution_outcome_unknown")
            assert.equal(error.retryable, true)
            assert.equal(error.outcomeUnknown, true)
            assert.equal(error.recovery, "refresh_or_retry")
            assert.doesNotMatch(error.message, /socket/)
            return true
        }
    )
})

test("rejects an incomplete response because the outcome cannot be confirmed", async () => {
    const repository = buildRepository({
        execution: {
            disposition: "executed",
            action_id: ACTION_ID,
            status: "succeeded",
            result: null,
        },
    })

    await assert.rejects(
        () => execute(repository),
        (error) => {
            assert.equal(error.status, 502)
            assert.equal(error.reason, "invalid_execution_response")
            assert.equal(error.outcomeUnknown, true)
            return true
        }
    )
})

test("requires an action id before reading action state", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () => execute(repository, { actionId: "" }),
        (error) => {
            assert.equal(error.status, 400)
            assert.equal(error.reason, "invalid_request")
            return true
        }
    )
    assert.equal(repository.calls.findActionById.length, 0)
})