import assert from "node:assert/strict"
import test from "node:test"
import {
    AppleMessagesHandoffError,
    prepareLibrelaAppleMessagesHandoff,
} from "./prepareLibrelaAppleMessagesHandoff.js"

const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const HANDOFF_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function buildPrepared(overrides = {}) {
    return {
        disposition: "created",
        handoff_id: HANDOFF_ID,
        state: "messages_handoff_requested",
        target_app: "apple_messages",
        contract_version: 1,
        recipient_name: "SoMa Animal Hospital",
        recipient_address: buildTestSmsAddress(),
        message_body: "Please schedule Momo’s next Librela injection.",
        ...overrides,
    }
}

function buildRepository({ prepared = buildPrepared(), error = null } = {}) {
    const calls = []

    return {
        calls,
        async prepareLibrelaAppleMessagesHandoff(args) {
            calls.push(args)
            if (error) throw error
            return prepared
        },
    }
}

test("returns one short-lived native draft contract from the atomic repository result", async () => {
    const repository = buildRepository()
    const result = await prepareLibrelaAppleMessagesHandoff({
        repository,
        actionId: ACTION_ID,
        now: () => new Date("2026-08-13T02:45:00.000Z"),
    })

    assert.deepEqual(repository.calls, [
        { actionId: ACTION_ID, requestedBy: "Rosa" },
    ])
    assert.equal(result.disposition, "created")
    assert.equal(result.handoff.id, HANDOFF_ID)
    assert.equal(result.handoff.recipient_name, "SoMa Animal Hospital")
    assert.equal(
        result.handoff.recipient_display,
        "Trusted number ending in 0199"
    )
    assert.equal(
        result.handoff.launch_uri.startsWith(
            `sms:${buildTestSmsAddress()}?body=`
        ),
        true
    )
    assert.equal(result.handoff.issued_at, "2026-08-13T02:45:00.000Z")
    assert.equal(result.handoff.expires_at, "2026-08-13T02:46:00.000Z")
})

test("repeated preparation reuses the database handoff and issues a fresh contract", async () => {
    const repository = buildRepository({
        prepared: buildPrepared({ disposition: "existing" }),
    })
    const result = await prepareLibrelaAppleMessagesHandoff({
        repository,
        actionId: ACTION_ID,
        now: () => new Date("2026-08-13T03:00:00.000Z"),
    })

    assert.equal(result.disposition, "existing")
    assert.equal(result.handoff.id, HANDOFF_ID)
    assert.equal(result.handoff.issued_at, "2026-08-13T03:00:00.000Z")
})

test("maps changed trusted state to reviewable conflicts", async () => {
    for (const reason of [
        "action_not_approved",
        "source_evidence_changed",
        "recipient_not_verified",
        "orchestration_run_changed",
    ]) {
        const repository = buildRepository({
            error: new Error(`${reason}: database detail stays private`),
        })

        await assert.rejects(
            () =>
                prepareLibrelaAppleMessagesHandoff({
                    repository,
                    actionId: ACTION_ID,
                }),
            (error) => {
                assert.ok(error instanceof AppleMessagesHandoffError)
                assert.equal(error.status, 409)
                assert.equal(error.reason, reason)
                assert.equal(error.message.includes("database detail"), false)
                return true
            }
        )
    }
})

test("rejects an incomplete private RPC contract without returning a URI", async () => {
    const repository = buildRepository({
        prepared: buildPrepared({ recipient_address: null }),
    })

    await assert.rejects(
        () =>
            prepareLibrelaAppleMessagesHandoff({
                repository,
                actionId: ACTION_ID,
            }),
        (error) => {
            assert.equal(error.reason, "invalid_handoff_response")
            assert.equal(error.status, 502)
            return true
        }
    )
})

test("requires only the server-owned action identity", async () => {
    const repository = buildRepository()

    await assert.rejects(
        () =>
            prepareLibrelaAppleMessagesHandoff({
                repository,
                actionId: "",
            }),
        (error) => {
            assert.equal(error.reason, "invalid_request")
            return true
        }
    )
    assert.equal(repository.calls.length, 0)
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
