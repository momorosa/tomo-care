import test from "node:test"
import assert from "node:assert/strict"
import {
    assertExternalSideEffectAllowed,
    EXTERNAL_CAPABILITIES,
} from "./externalSideEffects.js"
import {
    DEMO_PET_ID,
    DEMO_PROJECT_URL,
} from "../demo/scenarioManifest.js"

const VALID_DEMO_GMAIL_ENV = Object.freeze({
    TOMOCARE_RUNTIME_MODE: "demo",
    SUPABASE_URL: DEMO_PROJECT_URL,
    TOMO_PET_ID: DEMO_PET_ID,
    DEMO_GMAIL_ALLOWED_SENDER: "demo-sender@example.com",
    DEMO_GMAIL_RECIPIENT: "demo-inbox@example.com",
})

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

test("opens only the typed demo Gmail intake capability after exact validation", () => {
    assert.doesNotThrow(() =>
        assertExternalSideEffectAllowed(
            EXTERNAL_CAPABILITIES.DEMO_GMAIL_INTAKE,
            VALID_DEMO_GMAIL_ENV
        )
    )

    assert.throws(() =>
        assertExternalSideEffectAllowed(
            EXTERNAL_CAPABILITIES.DEMO_GMAIL_INTAKE,
            {
                ...VALID_DEMO_GMAIL_ENV,
                DEMO_GMAIL_ALLOWED_SENDER: "",
            }
        )
    )

    assert.throws(() =>
        assertExternalSideEffectAllowed(
            EXTERNAL_CAPABILITIES.GMAIL_INTAKE,
            VALID_DEMO_GMAIL_ENV
        )
    )

    assert.throws(
        () =>
            assertExternalSideEffectAllowed(
                EXTERNAL_CAPABILITIES.DEMO_GMAIL_INTAKE,
                {
                    TOMOCARE_RUNTIME_MODE: "real",
                    SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
                    TOMO_PET_ID: "10000000-0000-4000-8000-000000000001",
                }
            ),
        (error) => error.reason === "demo_gmail_runtime_mismatch"
    )
})
