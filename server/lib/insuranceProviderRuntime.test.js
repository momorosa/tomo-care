import test from "node:test"
import assert from "node:assert/strict"
import { getInsuranceProviderForRuntime } from "./insuranceProviderRuntime.js"

test("demo reminders use a generic provider even when a real label is submitted", () => {
    assert.equal(
        getInsuranceProviderForRuntime("Nationwide", {
            TOMOCARE_RUNTIME_MODE: "demo",
        }),
        "Pet insurance"
    )
})

test("real care preserves its existing provider default and explicit labels", () => {
    const env = { TOMOCARE_RUNTIME_MODE: "real" }

    assert.equal(getInsuranceProviderForRuntime(undefined, env), "Nationwide")
    assert.equal(
        getInsuranceProviderForRuntime("Trusted insurer", env),
        "Trusted insurer"
    )
})
