import test from "node:test"
import assert from "node:assert/strict"
import { assertExternalSideEffectAllowed } from "./externalSideEffects.js"

test("external provider execution fails closed in demo mode", () => {
    assert.throws(
        () =>
            assertExternalSideEffectAllowed("Gmail intake", {
                TOMOCARE_RUNTIME_MODE: "demo",
            }),
        (error) =>
            error.reason === "demo_external_action_blocked" &&
            /Nothing was contacted/.test(error.message)
    )
})

test("real mode preserves the existing provider boundary", () => {
    assert.doesNotThrow(() =>
        assertExternalSideEffectAllowed("Google Calendar", {
            TOMOCARE_RUNTIME_MODE: "real",
        })
    )
})
