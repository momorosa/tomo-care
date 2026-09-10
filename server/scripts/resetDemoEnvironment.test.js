import test from "node:test"
import assert from "node:assert/strict"
import {
    createSupabaseDemoResetRepository,
    prepareDemoReset,
    resetDemoEnvironment,
    runDemoReset,
    validateResetPlan,
} from "./resetDemoEnvironment.js"
import {
    DEMO_INTAKE_FIXTURE,
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
    DEMO_PROJECT_URL,
    DEMO_RESET_TARGETS,
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
        async removeStorageObjects(target) {
            calls.push(["storage", target])
        },
        async deleteDemoOwnedRecords({ petId, resetTargets }) {
            calls.push(["delete", petId])
            assert.equal(resetTargets, DEMO_RESET_TARGETS)
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
    assert.deepEqual(calls[0][1], {
        bucket: "tomo-docs",
        objectPaths: [DEMO_INTAKE_FIXTURE.storageKey],
    })
})

test("reset targets only exact manifest rows, source document links, and one Storage object", () => {
    assert.deepEqual(DEMO_RESET_TARGETS.storage.objectPaths, [
        DEMO_INTAKE_FIXTURE.storageKey,
    ])
    assert.deepEqual(DEMO_RESET_TARGETS.rows.events.documentIds, [
        DEMO_INTAKE_FIXTURE.documentId,
    ])
    assert.deepEqual(DEMO_RESET_TARGETS.rows.facts.documentIds, [
        DEMO_INTAKE_FIXTURE.documentId,
    ])
    assert.deepEqual(DEMO_RESET_TARGETS.rows.cost_items.documentIds, [
        DEMO_INTAKE_FIXTURE.documentId,
    ])
    assert.deepEqual(DEMO_RESET_TARGETS.rows.labs.documentIds, [
        DEMO_INTAKE_FIXTURE.documentId,
    ])
    assert.ok(
        DEMO_RESET_TARGETS.rows.documents.ids.includes(
            DEMO_INTAKE_FIXTURE.documentId
        )
    )
})

test("the Supabase reset repository never scopes destructive work by pet alone or lists a prefix", async () => {
    const calls = []
    const client = {
        storage: {
            from(bucket) {
                return {
                    async remove(paths) {
                        calls.push(["storage.remove", bucket, paths])
                        return { error: null }
                    },
                }
            },
        },
        from(table) {
            return {
                select(columns) {
                    if (table === "orchestration_runs") {
                        const filters = []
                        const query = {
                            eq(column, value) {
                                filters.push([column, value])
                                return query
                            },
                            then(resolve, reject) {
                                calls.push([
                                    "select.eq",
                                    table,
                                    columns,
                                    filters,
                                ])
                                return Promise.resolve({
                                    data: [
                                        {
                                            id: "draft-only-demo-run-id",
                                            state_json: {
                                                communication_handoff: {
                                                    draft: {
                                                        evidence: {
                                                            source_document_id:
                                                                DEMO_INTAKE_FIXTURE.documentId,
                                                        },
                                                    },
                                                },
                                            },
                                            result_json: null,
                                        },
                                        {
                                            id: "unrelated-run-id",
                                            state_json: null,
                                            result_json: {
                                                draft: {
                                                    evidence: {
                                                        source_document_id:
                                                            "unrelated-document-id",
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                    error: null,
                                }).then(resolve, reject)
                            },
                        }
                        return query
                    }

                    return {
                        async in(column, ids) {
                            calls.push(["select.in", table, column, ids])
                            if (table === "events") {
                                return {
                                    data: [{ id: "derived-event-id" }],
                                    error: null,
                                }
                            }
                            if (table === "care_actions") {
                                return {
                                    data: [
                                        {
                                            id: "derived-action-id",
                                            orchestration_run_id:
                                                "derived-run-id",
                                        },
                                    ],
                                    error: null,
                                }
                            }
                            throw new Error(
                                `Unexpected select: ${table} ${columns}`
                            )
                        },
                    }
                },
                delete() {
                    return {
                        async in(column, ids) {
                            calls.push(["delete.in", table, column, ids])
                            return { error: null }
                        },
                    }
                },
            }
        },
    }
    const repository = createSupabaseDemoResetRepository(client)

    await repository.removeStorageObjects(DEMO_RESET_TARGETS.storage)
    await repository.deleteDemoOwnedRecords({
        petId: DEMO_PET_ID,
        resetTargets: DEMO_RESET_TARGETS,
    })

    assert.deepEqual(calls[0], [
        "storage.remove",
        DEMO_RESET_TARGETS.storage.bucket,
        [DEMO_INTAKE_FIXTURE.storageKey],
    ])
    assert.ok(
        calls.some(
            ([operation, table, column, ids]) =>
                operation === "delete.in" &&
                table === "events" &&
                column === "doc_id" &&
                ids.includes(DEMO_INTAKE_FIXTURE.documentId)
        )
    )
    assert.ok(
        calls.some(
            ([operation, table, column, ids]) =>
                operation === "delete.in" &&
                table === "documents" &&
                column === "id" &&
                ids.includes(DEMO_INTAKE_FIXTURE.documentId)
        )
    )
    assert.ok(
        calls.some(
            ([operation, table, , filters]) =>
                operation === "select.eq" &&
                table === "orchestration_runs" &&
                filters.some(
                    ([column, value]) =>
                        column === "pet_id" && value === DEMO_PET_ID
                ) &&
                filters.some(
                    ([column, value]) =>
                        column === "workflow_type" &&
                        value === "librela_appointment_request"
                )
        )
    )
    const orchestrationDelete = calls.find(
        ([operation, table]) =>
            operation === "delete.in" && table === "orchestration_runs"
    )
    assert.deepEqual(orchestrationDelete, [
        "delete.in",
        "orchestration_runs",
        "id",
        ["derived-run-id", "draft-only-demo-run-id"],
    ])
    assert.equal(
        calls.some(
            ([operation, , column]) =>
                operation === "delete.in" && column === "pet_id"
        ),
        false
    )
    assert.equal(calls.some(([operation]) => operation === "storage.list"), false)

    await assert.rejects(
        () =>
            repository.removeStorageObjects({
                bucket: DEMO_RESET_TARGETS.storage.bucket,
                objectPaths: [
                    "demo/tomocare-demo-v1/intake/not-the-manifest-object.pdf",
                ],
            }),
        /exact manifest-owned object allowlist/
    )
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
