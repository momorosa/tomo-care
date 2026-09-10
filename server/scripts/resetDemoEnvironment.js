import process from "node:process"
import { pathToFileURL } from "node:url"
import {
    getServerRuntimeContext,
    RUNTIME_MODES,
} from "../config/runtimeContext.js"
import { getSupabaseServerConfig } from "../config/supabaseConfig.js"
import { getAppTimeZone, getCareDate } from "../lib/careDates.js"
import {
    buildDemoScenario,
    DEMO_OWNED_TABLES,
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
    DEMO_RESET_TARGETS,
    DEMO_STORAGE_BUCKET,
    DEMO_STORAGE_PREFIX,
    getDemoScenarioCounts,
} from "../demo/scenarioManifest.js"

const DOCUMENT_DERIVED_DELETE_ORDER = Object.freeze([
    "cost_items",
    "labs",
    "facts",
    "events",
])

const SEED_ORDER = Object.freeze([
    "pets",
    "documents",
    "events",
    "cost_items",
    "labs",
    "facts",
    "provider_contacts",
    "orchestration_runs",
    "care_actions",
    "apple_messages_handoffs",
])

export class DemoResetError extends Error {
    constructor(reason, message) {
        super(message)
        this.name = "DemoResetError"
        this.reason = reason
    }
}

export function prepareDemoReset({ env, argv, now = new Date() }) {
    const runtime = getServerRuntimeContext(env)

    if (runtime.mode !== RUNTIME_MODES.DEMO) {
        throw resetError(
            "demo_mode_required",
            "Reset refused: TOMOCARE_RUNTIME_MODE must be demo."
        )
    }

    const confirmedProjectRef = getConfirmedProjectRef(argv)
    if (confirmedProjectRef !== DEMO_PROJECT_REF) {
        throw resetError(
            "project_confirmation_mismatch",
            `Reset refused: pass --project-ref ${DEMO_PROJECT_REF}.`
        )
    }

    if (
        runtime.projectRef !== DEMO_PROJECT_REF ||
        runtime.petId !== DEMO_PET_ID
    ) {
        throw resetError(
            "demo_identity_mismatch",
            "Reset refused: the configured demo project or pet identity does not match the allowlist."
        )
    }

    const careDate = getCareDate(now, getAppTimeZone(env))
    const scenario = buildDemoScenario(careDate)
    validateResetPlan(scenario)
    getSupabaseServerConfig(env)

    return Object.freeze({ runtime, scenario })
}

export async function resetDemoEnvironment({
    runtime,
    scenario,
    repository,
}) {
    validateResetPlan(scenario)
    assertRepository(repository)

    await repository.removeStorageObjects(DEMO_RESET_TARGETS.storage)
    await repository.deleteDemoOwnedRecords({
        petId: DEMO_PET_ID,
        resetTargets: DEMO_RESET_TARGETS,
    })
    const insertedCounts = await repository.insertScenario(scenario)

    return Object.freeze({
        ok: true,
        mode: runtime.mode,
        project_ref: runtime.projectRef,
        scenario_id: scenario.scenarioId,
        care_date: scenario.careDate,
        storage_prefix: `${scenario.storage.bucket}/${scenario.storage.prefix}`,
        records: insertedCounts,
    })
}

export function validateResetPlan(scenario) {
    if (
        scenario?.scenarioId !== "tomocare-demo-v1" ||
        scenario?.projectRef !== DEMO_PROJECT_REF ||
        scenario?.petId !== DEMO_PET_ID
    ) {
        throw resetError(
            "invalid_demo_manifest",
            "Reset refused: the synthetic scenario identity is invalid."
        )
    }

    if (
        scenario.storage?.bucket !== DEMO_STORAGE_BUCKET ||
        scenario.storage?.prefix !== DEMO_STORAGE_PREFIX
    ) {
        throw resetError(
            "invalid_storage_allowlist",
            "Reset refused: the demo storage target is not allowlisted."
        )
    }

    const tableNames = Object.keys(scenario.tables || {}).sort()
    const allowlistedTableNames = [...DEMO_OWNED_TABLES].sort()
    if (
        tableNames.length !== allowlistedTableNames.length ||
        tableNames.some(
            (tableName, index) => tableName !== allowlistedTableNames[index]
        )
    ) {
        throw resetError(
            "invalid_table_allowlist",
            "Reset refused: the scenario table set does not match the explicit allowlist."
        )
    }

    for (const [table, rows] of Object.entries(scenario.tables)) {
        if (!Array.isArray(rows)) {
            throw resetError(
                "invalid_demo_manifest",
                `Reset refused: ${table} rows are invalid.`
            )
        }

        for (const row of rows) {
            const rowPetId = table === "pets" ? row.id : row.pet_id
            if (
                !["provider_contacts", "apple_messages_handoffs"].includes(
                    table
                ) &&
                rowPetId !== DEMO_PET_ID
            ) {
                throw resetError(
                    "invalid_demo_ownership",
                    `Reset refused: ${table} contains a row outside the synthetic pet allowlist.`
                )
            }
        }
    }

    return true
}

export function createSupabaseDemoResetRepository(client) {
    return {
        async removeStorageObjects({ bucket, objectPaths }) {
            assertExactStorageObjects(bucket, objectPaths)
            if (objectPaths.length === 0) return 0

            const { error } = await client.storage
                .from(bucket)
                .remove([...objectPaths])
            throwOnSupabaseError(error, "remove demo storage objects")
            return objectPaths.length
        },

        async deleteDemoOwnedRecords({ petId, resetTargets }) {
            if (
                petId !== DEMO_PET_ID ||
                resetTargets !== DEMO_RESET_TARGETS
            ) {
                throw resetError(
                    "invalid_demo_ownership",
                    "Reset refused: delete ownership does not match the manifest."
                )
            }

            const eventIds = await loadIdsByExactTargets(
                client,
                "events",
                resetTargets.rows.events
            )
            const { data: actions, error: actionLookupError } = eventIds.length
                ? await client
                      .from("care_actions")
                      .select("id, orchestration_run_id")
                      .in("source_event_id", eventIds)
                : { data: [], error: null }
            throwOnSupabaseError(
                actionLookupError,
                "load manifest-derived demo care actions"
            )

            const actionIds = (actions || []).map((action) => action.id)
            const orchestrationRunIds = (actions || [])
                .map((action) => action.orchestration_run_id)
                .filter(Boolean)

            await deleteRowsByIds(
                client,
                "apple_messages_handoffs",
                "care_action_id",
                actionIds,
                "delete manifest-derived demo Messages handoffs"
            )
            await deleteRowsByIds(
                client,
                "care_actions",
                "id",
                actionIds,
                "delete manifest-derived demo care actions"
            )
            await deleteRowsByIds(
                client,
                "orchestration_runs",
                "id",
                orchestrationRunIds,
                "delete manifest-derived demo orchestration runs"
            )

            for (const table of DOCUMENT_DERIVED_DELETE_ORDER) {
                assertAllowlistedTable(table)
                const target = resetTargets.rows[table]
                await deleteRowsByIds(
                    client,
                    table,
                    "id",
                    target.ids,
                    `delete manifest-owned demo ${table}`
                )
                await deleteRowsByIds(
                    client,
                    table,
                    "doc_id",
                    target.documentIds,
                    `delete source-linked demo ${table}`
                )
            }

            await deleteRowsByIds(
                client,
                "documents",
                "id",
                resetTargets.rows.documents.ids,
                "delete manifest-owned demo documents"
            )
            await deleteRowsByIds(
                client,
                "provider_contacts",
                "id",
                resetTargets.rows.provider_contacts.ids,
                "delete manifest-owned demo provider contacts"
            )
            await deleteRowsByIds(
                client,
                "pets",
                "id",
                resetTargets.rows.pets.ids,
                "delete the manifest-owned demo pet"
            )
        },

        async insertScenario(scenario) {
            validateResetPlan(scenario)
            const insertedCounts = {}

            for (const table of SEED_ORDER) {
                assertAllowlistedTable(table)
                const rows = scenario.tables[table]
                if (rows.length === 0) {
                    insertedCounts[table] = 0
                    continue
                }

                const { data, error } = await client
                    .from(table)
                    .insert(rows)
                    .select("id")
                throwOnSupabaseError(error, `insert demo ${table}`)
                insertedCounts[table] = data?.length || 0
            }

            return insertedCounts
        },
    }
}

export async function runDemoReset({
    env = process.env,
    argv = process.argv.slice(2),
    now = new Date(),
    repositoryFactory = createSupabaseDemoResetRepository,
} = {}) {
    const prepared = prepareDemoReset({ env, argv, now })
    const { url, secretKey } = getSupabaseServerConfig(env)
    const { createClient } = await import("@supabase/supabase-js")
    const client = createClient(url, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const repository = repositoryFactory(client)

    return resetDemoEnvironment({ ...prepared, repository })
}

function getConfirmedProjectRef(argv) {
    const inline = argv.find((arg) => arg.startsWith("--project-ref="))
    if (inline) return inline.slice("--project-ref=".length)

    const index = argv.indexOf("--project-ref")
    return index >= 0 ? argv[index + 1] : null
}

function assertExactStorageObjects(bucket, objectPaths) {
    const expected = DEMO_RESET_TARGETS.storage.objectPaths
    if (
        bucket !== DEMO_STORAGE_BUCKET ||
        !Array.isArray(objectPaths) ||
        objectPaths.length !== expected.length ||
        objectPaths.some((path, index) => path !== expected[index])
    ) {
        throw resetError(
            "invalid_storage_allowlist",
            "Reset refused: Storage cleanup does not match the exact manifest-owned object allowlist."
        )
    }
}

async function loadIdsByExactTargets(client, table, target) {
    const ids = new Set(target.ids || [])

    if (target.documentIds?.length) {
        const { data, error } = await client
            .from(table)
            .select("id")
            .in("doc_id", target.documentIds)
        throwOnSupabaseError(error, `load source-linked demo ${table}`)
        for (const row of data || []) ids.add(row.id)
    }

    return [...ids]
}

async function deleteRowsByIds(
    client,
    table,
    column,
    ids = [],
    operation
) {
    if (!ids.length) return 0
    assertAllowlistedTable(table)

    const { error } = await client.from(table).delete().in(column, [...ids])
    throwOnSupabaseError(error, operation)
    return ids.length
}

function assertAllowlistedTable(table) {
    if (!DEMO_OWNED_TABLES.includes(table)) {
        throw resetError(
            "invalid_table_allowlist",
            `Reset refused: ${table} is not an allowlisted demo table.`
        )
    }
}

function assertRepository(repository) {
    for (const method of [
        "removeStorageObjects",
        "deleteDemoOwnedRecords",
        "insertScenario",
    ]) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function throwOnSupabaseError(error, operation) {
    if (error) {
        throw resetError(
            "demo_reset_failed",
            `Demo reset could not ${operation}. Run the same guarded command again.`
        )
    }
}

function resetError(reason, message) {
    return new DemoResetError(reason, message)
}

async function main() {
    try {
        const result = await runDemoReset()
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    } catch (error) {
        const reason = error?.reason || "demo_reset_failed"
        process.stderr.write(`${reason}: ${error.message}\n`)
        process.exitCode = 1
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    await main()
}

export const EXPECTED_DEMO_RECORD_COUNTS = getDemoScenarioCounts(
    buildDemoScenario("2026-01-15")
)
