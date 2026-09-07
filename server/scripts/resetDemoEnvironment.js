import "dotenv/config"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { createClient } from "@supabase/supabase-js"
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
    DEMO_RECORD_IDS,
    DEMO_STORAGE_BUCKET,
    DEMO_STORAGE_PREFIX,
    getDemoScenarioCounts,
} from "../demo/scenarioManifest.js"

const PET_OWNED_DELETE_ORDER = Object.freeze([
    "care_actions",
    "orchestration_runs",
    "cost_items",
    "labs",
    "facts",
    "events",
    "documents",
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

    await repository.removeStoragePrefix({
        bucket: DEMO_STORAGE_BUCKET,
        prefix: DEMO_STORAGE_PREFIX,
    })
    await repository.deleteDemoOwnedRecords({
        petId: DEMO_PET_ID,
        recordIds: DEMO_RECORD_IDS,
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
        async removeStoragePrefix({ bucket, prefix }) {
            assertExactStorageTarget(bucket, prefix)
            const paths = await listStorageObjectPaths(client, bucket, prefix)
            if (paths.length === 0) return 0

            const { error } = await client.storage.from(bucket).remove(paths)
            throwOnSupabaseError(error, "remove demo storage objects")
            return paths.length
        },

        async deleteDemoOwnedRecords({ petId, recordIds }) {
            if (petId !== DEMO_PET_ID || recordIds !== DEMO_RECORD_IDS) {
                throw resetError(
                    "invalid_demo_ownership",
                    "Reset refused: delete ownership does not match the manifest."
                )
            }

            const { data: actions, error: actionLookupError } = await client
                .from("care_actions")
                .select("id")
                .eq("pet_id", petId)
            throwOnSupabaseError(actionLookupError, "load demo care actions")

            const actionIds = (actions || []).map((action) => action.id)
            if (actionIds.length > 0) {
                const { error } = await client
                    .from("apple_messages_handoffs")
                    .delete()
                    .in("care_action_id", actionIds)
                throwOnSupabaseError(error, "delete demo Messages handoffs")
            }

            for (const table of PET_OWNED_DELETE_ORDER) {
                assertAllowlistedTable(table)
                const { error } = await client
                    .from(table)
                    .delete()
                    .eq("pet_id", petId)
                throwOnSupabaseError(error, `delete demo ${table}`)
            }

            if (recordIds.providerContacts.length > 0) {
                const { error } = await client
                    .from("provider_contacts")
                    .delete()
                    .in("id", recordIds.providerContacts)
                throwOnSupabaseError(error, "delete demo provider contacts")
            }

            const { error: petDeleteError } = await client
                .from("pets")
                .delete()
                .eq("id", petId)
            throwOnSupabaseError(petDeleteError, "delete demo pet")
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
    const client = createClient(url, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const repository = repositoryFactory(client)

    return resetDemoEnvironment({ ...prepared, repository })
}

async function listStorageObjectPaths(client, bucket, prefix) {
    assertExactStorageTarget(bucket, prefix)
    const paths = []

    async function visit(currentPrefix) {
        const { data, error } = await client.storage.from(bucket).list(
            currentPrefix,
            { limit: 1000, sortBy: { column: "name", order: "asc" } }
        )
        throwOnSupabaseError(error, "list demo storage objects")

        for (const item of data || []) {
            const itemPath = `${currentPrefix}/${item.name}`
            if (item.id) {
                paths.push(itemPath)
            } else {
                await visit(itemPath)
            }
        }
    }

    await visit(prefix)
    return paths
}

function getConfirmedProjectRef(argv) {
    const inline = argv.find((arg) => arg.startsWith("--project-ref="))
    if (inline) return inline.slice("--project-ref=".length)

    const index = argv.indexOf("--project-ref")
    return index >= 0 ? argv[index + 1] : null
}

function assertExactStorageTarget(bucket, prefix) {
    if (bucket !== DEMO_STORAGE_BUCKET || prefix !== DEMO_STORAGE_PREFIX) {
        throw resetError(
            "invalid_storage_allowlist",
            "Reset refused: storage cleanup is outside the demo prefix allowlist."
        )
    }
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
        "removeStoragePrefix",
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
