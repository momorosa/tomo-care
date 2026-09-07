import test from "node:test"
import assert from "node:assert/strict"
import {
    getRuntimeMode,
    getServerRuntimeContext,
    parseHostedSupabaseProjectRef,
    toPublicRuntimeContext,
} from "./runtimeContext.js"
import {
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
    DEMO_PROJECT_URL,
} from "../demo/scenarioManifest.js"

const REAL_ENV = Object.freeze({
    TOMOCARE_RUNTIME_MODE: "real",
    SUPABASE_URL: "https://realcareproject123.supabase.co",
    TOMO_PET_ID: "a1000000-0000-4000-8000-000000000001",
})

test("accepts only explicit real and demo runtime modes", () => {
    assert.equal(getRuntimeMode({ TOMOCARE_RUNTIME_MODE: " real " }), "real")
    assert.equal(getRuntimeMode({ TOMOCARE_RUNTIME_MODE: " DEMO " }), "demo")

    for (const value of [undefined, "", "test", "production"]) {
        assert.throws(
            () => getRuntimeMode({ TOMOCARE_RUNTIME_MODE: value }),
            /must be exactly real or demo/
        )
    }
})

test("requires the exact allowlisted demo project and synthetic pet", () => {
    const runtime = getServerRuntimeContext({
        TOMOCARE_RUNTIME_MODE: "demo",
        SUPABASE_URL: DEMO_PROJECT_URL,
        TOMO_PET_ID: DEMO_PET_ID,
    })

    assert.equal(runtime.projectRef, DEMO_PROJECT_REF)
    assert.equal(runtime.petId, DEMO_PET_ID)

    assert.throws(
        () =>
            getServerRuntimeContext({
                TOMOCARE_RUNTIME_MODE: "demo",
                SUPABASE_URL: "https://wrongproject.supabase.co",
                TOMO_PET_ID: DEMO_PET_ID,
            }),
        /exact allowlisted Supabase demo project/
    )
    assert.throws(
        () =>
            getServerRuntimeContext({
                TOMOCARE_RUNTIME_MODE: "demo",
                SUPABASE_URL: DEMO_PROJECT_URL,
                TOMO_PET_ID: "a1000000-0000-4000-8000-000000000001",
            }),
        /exact synthetic pet identifier/
    )
})

test("real mode cannot point at either demo identity", () => {
    assert.deepEqual(getServerRuntimeContext(REAL_ENV), {
        mode: "real",
        supabaseUrl: REAL_ENV.SUPABASE_URL,
        projectRef: "realcareproject123",
        petId: REAL_ENV.TOMO_PET_ID,
    })

    assert.throws(
        () =>
            getServerRuntimeContext({
                ...REAL_ENV,
                SUPABASE_URL: DEMO_PROJECT_URL,
            }),
        /Real mode cannot target/
    )
})

test("public runtime context excludes project, pet, key, and provider details", () => {
    const runtime = getServerRuntimeContext({
        TOMOCARE_RUNTIME_MODE: "demo",
        SUPABASE_URL: DEMO_PROJECT_URL,
        TOMO_PET_ID: DEMO_PET_ID,
        SUPABASE_SECRET_KEY: "synthetic-test-secret",
        GMAIL_REFRESH_TOKEN: "synthetic-gmail-token",
        GCAL_CALENDAR_ID: "synthetic-calendar",
    })
    const publicContext = toPublicRuntimeContext(runtime, {
        now: new Date("2026-09-04T03:00:00.000Z"),
        timeZone: "America/Los_Angeles",
    })
    const serialized = JSON.stringify(publicContext)

    assert.deepEqual(publicContext, {
        mode: "demo",
        label: "Demo data",
        data_notice: "Fictional data only.",
        care_date: "2026-09-03",
    })
    for (const forbidden of [
        DEMO_PROJECT_REF,
        DEMO_PET_ID,
        "synthetic-test-secret",
        "synthetic-gmail-token",
        "synthetic-calendar",
        "supabase.co",
    ]) {
        assert.doesNotMatch(serialized, new RegExp(forbidden))
    }
})

test("accepts only an exact hosted Supabase project root URL", () => {
    assert.equal(
        parseHostedSupabaseProjectRef(DEMO_PROJECT_URL),
        DEMO_PROJECT_REF
    )

    for (const value of [
        `http://${DEMO_PROJECT_REF}.supabase.co`,
        `${DEMO_PROJECT_URL}/rest/v1`,
        `${DEMO_PROJECT_URL}?key=value`,
        "https://example.com",
        "not-a-url",
    ]) {
        assert.throws(() => parseHostedSupabaseProjectRef(value))
    }
})
