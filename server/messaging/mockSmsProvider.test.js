import test from "node:test"
import assert from "node:assert/strict"
import {
    MockSmsProviderError,
    createMockSmsProvider,
} from "./mockSmsProvider.js"

const MESSAGE = "Mock Librela appointment request"
const IDEMPOTENCY_KEY = "send:test:exact-message"

test("returns a deterministic mock acceptance without logging recipient data", async () => {
    const provider = createMockSmsProvider({
        outcome: "sent",
        now: () => "2026-07-28T19:00:00.000Z",
    })
    const args = {
        to: buildTestSmsAddress(),
        body: MESSAGE,
        idempotencyKey: IDEMPOTENCY_KEY,
    }

    const first = await provider.sendMessage(args)
    const second = await provider.sendMessage(args)

    assert.equal(first.outcome, "sent")
    assert.equal(first.providerMessageId, second.providerMessageId)
    assert.equal(JSON.stringify(first).includes(args.to), false)
    assert.equal(JSON.stringify(first).includes(MESSAGE), false)
})

test("supports a known mock failure", async () => {
    const provider = createMockSmsProvider({ outcome: "failed" })
    const result = await provider.sendMessage({
        to: buildTestSmsAddress(),
        body: MESSAGE,
        idempotencyKey: IDEMPOTENCY_KEY,
    })

    assert.equal(result.outcome, "failed")
    assert.equal(result.errorCode, "mock_rejected")
})

test("supports an explicitly unknown mock outcome", async () => {
    const provider = createMockSmsProvider({
        outcome: "outcome_unknown",
    })

    await assert.rejects(
        () =>
            provider.sendMessage({
                to: buildTestSmsAddress(),
                body: MESSAGE,
                idempotencyKey: IDEMPOTENCY_KEY,
            }),
        (error) => {
            assert.ok(error instanceof MockSmsProviderError)
            assert.equal(error.kind, "outcome_unknown")
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