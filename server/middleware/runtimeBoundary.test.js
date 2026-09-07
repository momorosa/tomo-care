import test from "node:test"
import assert from "node:assert/strict"
import { getRuntimeBoundaryDecision } from "./runtimeBoundary.js"

const DEMO_RUNTIME = Object.freeze({
    mode: "demo",
    petId: "d3000000-0000-4000-8000-000000000001",
})

test("rewrites only the current-pet alias to the server-owned identity", () => {
    assert.deepEqual(
        getRuntimeBoundaryDecision({
            method: "GET",
            pathname: "/api/pets/current/reminders",
            runtime: DEMO_RUNTIME,
        }),
        {
            type: "rewrite_current_pet",
            pathname:
                "/api/pets/d3000000-0000-4000-8000-000000000001/reminders",
        }
    )

    assert.deepEqual(
        getRuntimeBoundaryDecision({
            method: "GET",
            pathname: "/api/pets/another-pet/reminders",
            runtime: DEMO_RUNTIME,
        }),
        { type: "reject_pet_scope" }
    )
})

test("blocks Gmail, Calendar, and Messages boundaries before route execution", () => {
    const requests = [
        ["POST", "/api/gmail/check-inbox", "Gmail intake"],
        [
            "POST",
            "/api/events/event-1/actions/sync-google-calendar",
            "Google Calendar write",
        ],
        ["GET", "/api/debug/google-calendar", "Google Calendar connection"],
        [
            "POST",
            "/api/care-actions/action-1/apple-messages-handoff",
            "Apple Messages handoff",
        ],
        [
            "POST",
            "/api/care-actions/action-1/apple-messages-handoff/resolve",
            "Apple Messages handoff",
        ],
    ]

    for (const [method, pathname, capability] of requests) {
        assert.deepEqual(
            getRuntimeBoundaryDecision({
                method,
                pathname,
                runtime: DEMO_RUNTIME,
            }),
            { type: "blocked_demo_side_effect", capability }
        )
    }
})

test("real mode preserves the existing provider routes", () => {
    assert.deepEqual(
        getRuntimeBoundaryDecision({
            method: "POST",
            pathname: "/api/gmail/check-inbox",
            runtime: { ...DEMO_RUNTIME, mode: "real" },
        }),
        { type: "allow" }
    )
})
