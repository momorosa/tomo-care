import test from "node:test"
import assert from "node:assert/strict"
import {
    prepareDemoReset,
    resetDemoEnvironment,
    runDemoReset,
    validateResetPlan,
} from "./resetDemoEnvironment.js"
import {
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
    DEMO_PROJECT_URL,
} from "../demo/scenarioManifest.js"

const DEMO_ENV = Object.freeze({
    TOMOCARE_RUNTIME_MODE: "demo",
    SUPABASE_URL: DEMO_PROJECT_URL,
    SUPABASE_SECRET_KEY: "synthetic-test-secret",
    TOMO_PET_ID: DEMO_PET_ID,
    APP_TIME_ZONE: "America/Los_Angeles",
})

test("prepares reset only after every exact demo guard passes", () => {
    const prepared = prepareDemoReset({
        env: DEMO_ENV,
        argv: ["--project-ref", DEMO_PROJECT_REF],
        now: new Date("2026-09-04T03:00:00.000Z"),
    })

    assert.equal(prepared.runtime.mode, "demo")
    assert.equal(prepared.runtime.projectRef, DEMO_PROJECT_REF)
    assert.equal(prepared.scenario.careDate, "2026-09-03")
    assert.equal(validateResetPlan(prepared.scenario), true)
})

test("refuses real mode, a missing confirmation, and project mismatch", () => {
    const cases = [
        {
            env: {
                ...DEMO_ENV,
                TOMOCARE_RUNTIME_MODE: "real",
                SUPABASE_URL: "https://realcareproject123.supabase.co",
                TOMO_PET_ID: "a1000000-0000-4000-8000-000000000001",
            },
            argv: ["--project-ref", DEMO_PROJECT_REF],
        },
        { env: DEMO_ENV, argv: [] },
        { env: DEMO_ENV, argv: ["--project-ref", "wrong-project"] },
        {
            env: {
                ...DEMO_ENV,
                SUPABASE_URL: "https://wrong-project.supabase.co",
            },
            argv: ["--project-ref", DEMO_PROJECT_REF],
        },
    ]

    for (const input of cases) {
        assert.throws(() => prepareDemoReset(input))
    }
})

test("a rejected reset never creates a repository or reaches mutation", async () => {
    let repositoryCreated = false

    await assert.rejects(
        () =>
            runDemoReset({
                env: { ...DEMO_ENV, TOMOCARE_RUNTIME_MODE: "real" },
                argv: ["--project-ref", DEMO_PROJECT_REF],
                repositoryFactory() {
                    repositoryCreated = true
                    throw new Error("must not run")
                },
            })
    )

    assert.equal(repositoryCreated, false)
})

test("two resets leave the same logical row set without duplicates", async () => {
    const prepared = prepareDemoReset({
        env: DEMO_ENV,
        argv: [`--project-ref=${DEMO_PROJECT_REF}`],
        now: new Date("2026-09-04T03:00:00.000Z"),
    })
    const store = new Map()
    const calls = []
    const repository = {
        async removeStoragePrefix(target) {
            calls.push(["storage", target])
        },
        async deleteDemoOwnedRecords({ petId }) {
            calls.push(["delete", petId])
            store.clear()
        },
        async insertScenario(scenario) {
            calls.push(["insert", scenario.scenarioId])
            for (const [table, rows] of Object.entries(scenario.tables)) {
                store.set(table, structuredClone(rows))
            }
            return Object.fromEntries(
                [...store].map(([table, rows]) => [table, rows.length])
            )
        },
    }

    const first = await resetDemoEnvironment({ ...prepared, repository })
    const firstSnapshot = structuredClone(Object.fromEntries(store))
    const second = await resetDemoEnvironment({ ...prepared, repository })

    assert.deepEqual(Object.fromEntries(store), firstSnapshot)
    assert.deepEqual(second.records, first.records)
    assert.deepEqual(calls.map(([operation]) => operation), [
        "storage",
        "delete",
        "insert",
        "storage",
        "delete",
        "insert",
    ])
})

test("rejects any table or storage target outside the manifest allowlist", () => {
    const prepared = prepareDemoReset({
        env: DEMO_ENV,
        argv: ["--project-ref", DEMO_PROJECT_REF],
    })
    const wrongTable = {
        ...prepared.scenario,
        tables: { ...prepared.scenario.tables, field_plan: [] },
    }
    const wrongStorage = {
        ...prepared.scenario,
        storage: { ...prepared.scenario.storage, prefix: "" },
    }

    assert.throws(() => validateResetPlan(wrongTable), /table set/)
    assert.throws(() => validateResetPlan(wrongStorage), /storage target/)
})
