import test from "node:test"
import assert from "node:assert/strict"
import {
    ActionExecutionError,
    executeCareAction,
} from "./executeCareAction.js"
import { SEND_LIBRELA_APPOINTMENT_REQUEST } from "./librelaAppointmentRequest.js"
import { createMockSmsProvider } from "../messaging/mockSmsProvider.js"

const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const CONTACT_ID = "33333333-3333-4333-8333-333333333333"
const MESSAGE_HASH = "a".repeat(64)

function buildAction(overrides = {}) {
    return {
        id: ACTION_ID,
        action_type: SEND_LIBRELA_APPOINTMENT_REQUEST,
        status: "approved",
        result_json: null,
        ...overrides,
    }
}

function buildClaim(overrides = {}) {
    return {
        disposition: "claimed",
        action_id: ACTION_ID,
        status: "executing",
        delivery: {
            recipient_address: buildTestSmsAddress(),
            recipient_name: "SoMa Animal Hospital",
            provider_contact_id: CONTACT_ID,
            message_body: "Please schedule Momo’s next Librela injection.",
            message_sha256: MESSAGE_HASH,
            idempotency_key: `send:${ACTION_ID}`,
        },
        ...overrides,
    }
}

function buildRepository({
    action = buildAction(),
    claim = buildClaim(),
    claimError = null,
    finalizeError = null,
} = {}) {
    const calls = {
        findActionById: [],
        claimSendLibrelaAppointmentRequest: [],
        finalizeSendLibrelaAppointmentRequest: [],
    }

    return {
        calls,
        async findActionById(actionId) {
            calls.findActionById.push(actionId)
            return action
        },
        async claimSendLibrelaAppointmentRequest(args) {
            calls.claimSendLibrelaAppointmentRequest.push(args)
            if (claimError) throw claimError
            return claim
        },
        async finalizeSendLibrelaAppointmentRequest(args) {
            calls.finalizeSendLibrelaAppointmentRequest.push(args)
            if (finalizeError) throw finalizeError

            const status =
                args.deliveryStatus === "sent"
                    ? "succeeded"
                    : args.deliveryStatus

            return {
                disposition: "executed",
                action_id: ACTION_ID,
                status,
                result: args.result,
                error: args.error,
            }
        },
    }
}

test("claims before one mock provider call and persists the sent result", async () => {
    const repository = buildRepository()
    const baseProvider = createMockSmsProvider({
        outcome: "sent",
        now: () => "2026-07-28T19:00:00.000Z",
    })
    let providerCalls = 0
    const provider = {
        ...baseProvider,
        async sendMessage(args) {
            providerCalls += 1
            return baseProvider.sendMessage(args)
        },
    }

    const result = await executeCareAction({
        repository,
        actionId: ACTION_ID,
        outboundMessageProvider: provider,
    })

    assert.equal(providerCalls, 1)
    assert.equal(result.status, "succeeded")
    assert.equal(result.result.delivery_status, "sent")
    assert.equal(result.result.provider_mode, "mock")
    assert.equal(
        repository.calls.finalizeSendLibrelaAppointmentRequest[0]
            .deliveryStatus,
        "sent"
    )
    assert.equal(
        JSON.stringify(result).includes(buildTestSmsAddress()),
        false
    )
})

test("returns an existing sent result without another provider call", async () => {
    const storedResult = {
        schema_version: 1,
        delivery_status: "sent",
        provider: "mock",
    }
    const repository = buildRepository({
        action: buildAction({
            status: "succeeded",
            result_json: storedResult,
        }),
        claim: {
            disposition: "existing",
            action_id: ACTION_ID,
            status: "succeeded",
            result: storedResult,
        },
    })
    let providerCalls = 0
    const provider = {
        name: "mock",
        mode: "mock",
        async sendMessage() {
            providerCalls += 1
        },
    }

    const result = await executeCareAction({
        repository,
        actionId: ACTION_ID,
        outboundMessageProvider: provider,
    })

    assert.equal(result.disposition, "existing")
    assert.equal(providerCalls, 0)
    assert.equal(
        repository.calls.finalizeSendLibrelaAppointmentRequest.length,
        0
    )
})

test("persists a known provider failure and does not claim delivery", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () =>
            executeCareAction({
                repository,
                actionId: ACTION_ID,
                outboundMessageProvider: createMockSmsProvider({
                    outcome: "failed",
                }),
            }),
        (error) => {
            assert.ok(error instanceof ActionExecutionError)
            assert.equal(error.reason, "delivery_failed")
            assert.equal(error.outcomeUnknown, false)
            assert.equal(error.retryable, false)
            return true
        }
    )

    const finalized =
        repository.calls.finalizeSendLibrelaAppointmentRequest[0]
    assert.equal(finalized.deliveryStatus, "failed")
    assert.equal(finalized.result.delivery_status, "failed")
    assert.equal(finalized.error.reason, "provider_rejected")
})

test("persists and locks an unknown provider outcome", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () =>
            executeCareAction({
                repository,
                actionId: ACTION_ID,
                outboundMessageProvider: createMockSmsProvider({
                    outcome: "outcome_unknown",
                }),
            }),
        (error) => {
            assert.ok(error instanceof ActionExecutionError)
            assert.equal(error.reason, "delivery_outcome_unknown")
            assert.equal(error.outcomeUnknown, true)
            assert.equal(error.retryable, false)
            assert.equal(error.recovery, "review_delivery")
            return true
        }
    )

    assert.equal(
        repository.calls.finalizeSendLibrelaAppointmentRequest[0]
            .deliveryStatus,
        "outcome_unknown"
    )
})

test("an executing or unknown action never makes another provider call", async () => {
    for (const status of ["executing", "outcome_unknown"]) {
        const repository = buildRepository({
            claim: {
                disposition: "locked",
                action_id: ACTION_ID,
                status,
                result: null,
            },
        })
        let providerCalls = 0
        const provider = {
            name: "mock",
            mode: "mock",
            async sendMessage() {
                providerCalls += 1
            },
        }

        await assert.rejects(
            () =>
                executeCareAction({
                    repository,
                    actionId: ACTION_ID,
                    outboundMessageProvider: provider,
                }),
            (error) => {
                assert.equal(error.reason, "delivery_outcome_unknown")
                assert.equal(error.retryable, false)
                return true
            }
        )
        assert.equal(providerCalls, 0)
    }
})

test("a persistence failure after provider acceptance is locked as unknown", async () => {
    const repository = buildRepository({
        finalizeError: new Error("database connection closed"),
    })

    await assert.rejects(
        () =>
            executeCareAction({
                repository,
                actionId: ACTION_ID,
                outboundMessageProvider: createMockSmsProvider({
                    outcome: "sent",
                }),
            }),
        (error) => {
            assert.equal(error.reason, "delivery_outcome_unknown")
            assert.equal(error.outcomeUnknown, true)
            assert.equal(error.retryable, false)
            return true
        }
    )
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