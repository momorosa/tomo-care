import test from "node:test"
import assert from "node:assert/strict"
import { resetDemoReceipt } from "./resetDemoReceipt.js"
import {
    DEMO_INTAKE_FIXTURE as source,
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
    DEMO_PROJECT_URL,
} from "../demo/scenarioManifest.js"
import { LIBRELA_APPOINTMENT_WORKFLOW } from "../orchestration/persistedLibrelaAppointmentWorkflow.js"

const env = {
    TOMOCARE_RUNTIME_MODE: "demo",
    SUPABASE_URL: DEMO_PROJECT_URL,
    TOMO_PET_ID: DEMO_PET_ID,
    SUPABASE_SECRET_KEY: "synthetic-test",
}
const argv = ["--project-ref", DEMO_PROJECT_REF]
function fixture() {
    const doc = {
        id: source.documentId,
        pet_id: DEMO_PET_ID,
        doc_type: "receipt",
        title: source.title,
        file_url: source.storageKey,
        external_refs: {
            demo_owned: true,
            scenario_id: "tomocare-demo-v1",
            fixture_kind: source.fixtureKind,
            content_sha256: source.contentSha256,
        },
    }
    const rows = {
        documents: [doc],
        events: [],
        facts: [],
        cost_items: [],
        labs: [],
        care_actions: [],
        orchestration_runs: [],
        apple_messages_handoffs: [],
        pets: [{ id: DEMO_PET_ID }],
        provider_contacts: [{ id: "contact" }],
    }
    for (const table of ["events", "facts", "cost_items", "labs"]) {
        rows[table].push({
            id: `${table}-september`,
            pet_id: DEMO_PET_ID,
            doc_id: source.documentId,
        })
        for (const month of ["may", "july", "unrelated"])
            rows[table].push({
                id: `${table}-${month}`,
                pet_id: DEMO_PET_ID,
                doc_id: month,
            })
    }
    for (const month of ["may", "july", "unrelated"])
        rows.documents.push({ id: month, pet_id: DEMO_PET_ID })
    rows.care_actions.push({
        id: "action",
        pet_id: DEMO_PET_ID,
        source_event_id: "events-september",
        orchestration_run_id: "run",
    })
    rows.apple_messages_handoffs.push({
        id: "handoff",
        care_action_id: "action",
    })
    rows.orchestration_runs.push({
        id: "run",
        pet_id: DEMO_PET_ID,
        workflow_type: LIBRELA_APPOINTMENT_WORKFLOW,
        result_json: { sourceDocument: { id: source.documentId } },
    })
    const calls = []
    let failTable
    const client = {
        storage: {
            from(bucket) {
                return {
                    async remove(paths) {
                        calls.push({ kind: "storage", bucket, paths })
                        return { error: null }
                    },
                }
            },
        },
        from(table) {
            let deleting = false
            const predicates = []
            const q = {
                select() {
                    return q
                },
                delete() {
                    deleting = true
                    return q
                },
                eq(key, value) {
                    predicates.push((row) => row[key] === value)
                    return q
                },
                in(key, values) {
                    predicates.push((row) => values.includes(row[key]))
                    return q
                },
                limit() {
                    return q
                },
                then(resolve, reject) {
                    try {
                        const selected = rows[table].filter((row) =>
                            predicates.every((p) => p(row))
                        )
                        if (deleting) {
                            calls.push({
                                kind: "delete",
                                table,
                                ids: selected.map((row) => row.id),
                            })
                            if (failTable === table)
                                return Promise.resolve({
                                    error: new Error("injected failure"),
                                }).then(resolve, reject)
                            rows[table] = rows[table].filter(
                                (row) => !selected.includes(row)
                            )
                        }
                        return Promise.resolve({
                            data: structuredClone(selected),
                            error: null,
                        }).then(resolve, reject)
                    } catch (error) {
                        return Promise.reject(error).then(resolve, reject)
                    }
                },
            }
            return q
        },
    }
    const options = {
        env,
        argv,
        clientFactory: () => client,
        calendarReset: async ({ preview }) => {
            calls.push({ kind: "calendar", preview })
            return 1
        },
    }
    return {
        rows,
        calls,
        options,
        fail(table) {
            failTable = table
        },
    }
}

test("default preview selects only September and performs no mutations", async () => {
    const f = fixture(),
        before = structuredClone(f.rows)
    const result = await resetDemoReceipt(f.options)
    assert.equal(result.mode, "preview_only")
    assert.deepEqual(result.records.documents, [source.documentId])
    assert.deepEqual(result.records.events, ["events-september"])
    assert.deepEqual(f.rows, before)
    assert.deepEqual(f.calls, [{ kind: "calendar", preview: true }])
})

test("apply clears September dependencies, preserves all other rows byte-for-byte, and can repeat", async () => {
    const f = fixture()
    const preserved = Object.fromEntries(
        Object.entries(f.rows).map(([table, rows]) => [
            table,
            rows.filter(
                (row) =>
                    ![source.documentId, "action", "run", "handoff"].includes(
                        row.id
                    ) && !row.id.endsWith("-september")
            ),
        ])
    )
    const result = await resetDemoReceipt({
        ...f.options,
        argv: [...argv, "--apply"],
    })
    assert.equal(result.mode, "applied")
    assert.deepEqual(f.rows, preserved)
    assert.deepEqual(f.calls[0], { kind: "calendar", preview: false })
    assert.deepEqual(f.calls.find((call) => call.kind === "storage").paths, [
        source.storageKey,
    ])
    assert.equal(f.calls.at(-1).table, "documents")
    await resetDemoReceipt({ ...f.options, argv: [...argv, "--apply"] })
    assert.deepEqual(f.rows, preserved)
})

test("real mode, wrong project, missing confirmation and unknown flags never reach a client", async () => {
    for (const override of [
        { env: { ...env, TOMOCARE_RUNTIME_MODE: "real" } },
        { argv: ["--project-ref", "wrong"] },
        { argv: [] },
        { argv: [...argv, "--aply"] },
    ]) {
        await assert.rejects(
            resetDemoReceipt({
                env,
                argv,
                ...override,
                clientFactory() {
                    assert.fail("must not reach client")
                },
            })
        )
    }
})

test("changed document ownership, cross-pet records and shared drafts fail before calendar cleanup", async () => {
    for (const alter of [
        (f) => {
            f.rows.documents[0].external_refs.demo_owned = false
        },
        (f) => {
            f.rows.events[0].pet_id = "another-pet"
        },
        (f) => {
            f.rows.care_actions.push({
                id: "unrelated-action",
                orchestration_run_id: "run",
                source_event_id: "events-july",
            })
        },
    ]) {
        const f = fixture()
        alter(f)
        await assert.rejects(
            resetDemoReceipt({ ...f.options, argv: [...argv, "--apply"] })
        )
        assert.deepEqual(f.calls, [])
    }
})

test("calendar failure preserves every database row and the PDF", async () => {
    const f = fixture(),
        before = structuredClone(f.rows)
    await assert.rejects(
        resetDemoReceipt({
            ...f.options,
            argv: [...argv, "--apply"],
            calendarReset: async () => {
                throw new Error("calendar offline")
            },
        }),
        /calendar offline/
    )
    assert.deepEqual(f.rows, before)
    assert.deepEqual(f.calls, [])
})

test("a partial database failure leaves the source replay gate in place and retry completes", async () => {
    const f = fixture()
    f.fail("facts")
    await assert.rejects(
        resetDemoReceipt({ ...f.options, argv: [...argv, "--apply"] }),
        /removing facts/
    )
    assert.ok(f.rows.documents.some((doc) => doc.id === source.documentId))
    assert.ok(!f.calls.some((call) => call.kind === "storage"))
    f.fail(null)
    await resetDemoReceipt({ ...f.options, argv: [...argv, "--apply"] })
    assert.deepEqual(
        f.rows.documents.map((row) => row.id),
        ["may", "july", "unrelated"]
    )
    assert.equal(f.rows.orchestration_runs.length, 0)
})

test("an unlinked September appointment draft is removed, other drafts remain", async () => {
    const f = fixture()
    f.rows.care_actions = []
    f.rows.apple_messages_handoffs = []
    f.rows.orchestration_runs.push({
        id: "unrelated-run",
        pet_id: DEMO_PET_ID,
        workflow_type: LIBRELA_APPOINTMENT_WORKFLOW,
        result_json: { sourceDocument: { id: "july" } },
    })
    await resetDemoReceipt({ ...f.options, argv: [...argv, "--apply"] })
    assert.deepEqual(
        f.rows.orchestration_runs.map((row) => row.id),
        ["unrelated-run"]
    )
})
