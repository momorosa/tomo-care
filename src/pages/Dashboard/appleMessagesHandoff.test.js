import assert from "node:assert/strict"
import test from "node:test"
import {
    requestAppleMessagesDraft,
    validateAppleMessagesHandoffContract,
} from "./appleMessagesHandoff.js"

function buildHandoff(overrides = {}) {
    return {
        id: "handoff-1",
        state: "messages_handoff_requested",
        target_app: "apple_messages",
        recipient_name: "SoMa Animal Hospital",
        recipient_display: "Trusted number ending in 0199",
        launch_uri: `sms:${buildTestSmsAddress()}?body=Please%20schedule%20Momo.`,
        contract_version: 1,
        issued_at: "2026-08-13T02:45:00.000Z",
        expires_at: "2026-08-13T02:46:00.000Z",
        ...overrides,
    }
}

test("requests one native draft for a valid unexpired contract", () => {
    const calls = []
    const handoff = buildHandoff()

    requestAppleMessagesDraft({
        handoff,
        location: {
            assign(uri) {
                calls.push(uri)
            },
        },
        now: () => Date.parse("2026-08-13T02:45:30.000Z"),
    })

    assert.deepEqual(calls, [handoff.launch_uri])
})

test("never navigates for an expired or malformed contract", () => {
    for (const handoff of [
        buildHandoff({ expires_at: "2026-08-13T02:45:20.000Z" }),
        buildHandoff({ launch_uri: "https://example.com" }),
        buildHandoff({ target_app: "unknown" }),
        buildHandoff({ recipient_name: "" }),
    ]) {
        const calls = []

        assert.throws(() =>
            requestAppleMessagesDraft({
                handoff,
                location: { assign: (uri) => calls.push(uri) },
                now: () => Date.parse("2026-08-13T02:45:30.000Z"),
            })
        )
        assert.equal(calls.length, 0)
    }
})

test("accepts only the bounded Phase 3F handoff semantics", () => {
    const handoff = validateAppleMessagesHandoffContract(buildHandoff(), {
        now: () => Date.parse("2026-08-13T02:45:30.000Z"),
    })

    assert.equal(handoff.state, "messages_handoff_requested")
    assert.equal("sent" in handoff, false)
    assert.equal("delivered" in handoff, false)
    assert.equal("booked" in handoff, false)
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
