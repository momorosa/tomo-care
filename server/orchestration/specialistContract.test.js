import assert from "node:assert/strict"
import test from "node:test"

import {
    defineSpecialistContract,
    invokeSpecialist,
    SPECIALIST_HANDOFF_SCHEMA_VERSION,
} from "./specialistContract.js"

function buildContract({ timeoutMs = 100 } = {}) {
    return defineSpecialistContract({
        name: "fixture_specialist",
        version: 1,
        description: "A bounded specialist used only by tests.",
        allowedTruthTiers: ["trusted"],
        allowedTools: ["read_fixture"],
        timeoutMs,
        validateInput: (input) => input?.schema_version === "fixture_input_v1",
        validateOutput: (output) => output?.status === "ready",
    })
}

test("invokes a specialist through its versioned contract and allowed tool", async () => {
    const calls = []
    const result = await invokeSpecialist({
        contract: buildContract(),
        input: { schema_version: "fixture_input_v1" },
        tools: {
            async read_fixture(input) {
                calls.push(input)
                return { id: "evidence-1" }
            },
        },
        async handler({ tools }) {
            const evidence = await tools.call("read_fixture", {
                id: "evidence-1",
            })
            return { status: "ready", evidence }
        },
    })

    assert.equal(result.schema_version, SPECIALIST_HANDOFF_SCHEMA_VERSION)
    assert.equal(result.status, "completed")
    assert.equal(result.specialist.name, "fixture_specialist")
    assert.deepEqual(calls, [{ id: "evidence-1" }])
})

test("rejects malformed input before the specialist or tools run", async () => {
    let handlerCalled = false
    const result = await invokeSpecialist({
        contract: buildContract(),
        input: { schema_version: "wrong" },
        tools: {},
        async handler() {
            handlerCalled = true
            return { status: "ready" }
        },
    })

    assert.equal(handlerCalled, false)
    assert.equal(result.status, "failed")
    assert.equal(result.failure.type, "malformed_input")
    assert.equal(result.failure.retryable, false)
})

test("blocks a tool that is outside the specialist allowlist", async () => {
    const result = await invokeSpecialist({
        contract: buildContract(),
        input: { schema_version: "fixture_input_v1" },
        tools: {
            async mutate_trusted_record() {
                throw new Error("must not run")
            },
        },
        async handler({ tools }) {
            await tools.call("mutate_trusted_record", {})
            return { status: "ready" }
        },
    })

    assert.equal(result.status, "failed")
    assert.equal(result.failure.type, "permission_denied")
    assert.equal(result.failure.retryable, false)
})

test("returns unavailable when an allowlisted tool is missing", async () => {
    const result = await invokeSpecialist({
        contract: buildContract(),
        input: { schema_version: "fixture_input_v1" },
        tools: {},
        async handler({ tools }) {
            await tools.call("read_fixture", {})
            return { status: "ready" }
        },
    })

    assert.equal(result.status, "failed")
    assert.equal(result.failure.type, "unavailable")
    assert.equal(result.failure.retryable, true)
})

test("rejects a malformed specialist result before manager synthesis", async () => {
    const result = await invokeSpecialist({
        contract: buildContract(),
        input: { schema_version: "fixture_input_v1" },
        tools: {},
        async handler() {
            return { status: "invented" }
        },
    })

    assert.equal(result.status, "failed")
    assert.equal(result.failure.type, "malformed_result")
})

test("returns a typed retryable timeout", async () => {
    const result = await invokeSpecialist({
        contract: buildContract({ timeoutMs: 10 }),
        input: { schema_version: "fixture_input_v1" },
        tools: {},
        async handler() {
            return new Promise(() => {})
        },
    })

    assert.equal(result.status, "failed")
    assert.equal(result.failure.type, "timeout")
    assert.equal(result.failure.retryable, true)
})
