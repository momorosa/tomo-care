import "dotenv/config"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { isDeepStrictEqual } from "node:util"
import { getServerRuntimeContext } from "../config/runtimeContext.js"
import { getSupabaseServerConfig } from "../config/supabaseConfig.js"
import { getAppTimeZone, getCareDate } from "../lib/careDates.js"
import { buildDemoHistoricalVisits, DEMO_PET_ID, DEMO_PROJECT_REF } from "../demo/scenarioManifest.js"

export function prepareDemoHistory({ env, argv = [], now = new Date() }) {
    const runtime = getServerRuntimeContext(env)
    const flag = argv.indexOf("--project-ref")
    const confirmed = argv.find(a => a.startsWith("--project-ref="))?.slice(14) || (flag >= 0 ? argv[flag + 1] : null)
    if (runtime.mode !== "demo" || runtime.projectRef !== DEMO_PROJECT_REF || runtime.petId !== DEMO_PET_ID || confirmed !== DEMO_PROJECT_REF) {
        throw new Error("History seed refused: demo mode and the exact demo project confirmation are required.")
    }
    const careDate = getCareDate(now, getAppTimeZone(env))
    return { runtime, tables: buildDemoHistoricalVisits(careDate) }
}

// Existing records are never overwritten, including fixture rows a reviewer edited.
// Ignore audit timestamps and database-added defaults when comparing an exact seed ID.
function matchesSeed(existing, expected) {
    return Object.entries(expected).every(([key, value]) =>
        ["created_at", "updated_at", "verified_at"].includes(key) || isDeepStrictEqual(existing[key], value)
    )
}

export async function seedDemoHistory({ env, argv, now, clientFactory } = {}) {
    const { tables } = prepareDemoHistory({ env, argv, now })
    const config = getSupabaseServerConfig(env)
    const makeClient = clientFactory || (await import("@supabase/supabase-js")).createClient
    const client = makeClient(config.url, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: pet, error: petError } = await client.from("pets").select("id").eq("id", DEMO_PET_ID).maybeSingle()
    if (petError || !pet) throw new Error("History seed refused: initialize the demo pet first.")
    const missing = {}
    // Preflight every table before the first write. No deletion, upsert, Storage or intake.
    for (const [table, rows] of Object.entries(tables)) {
        const { data, error } = await client.from(table).select("*").in("id", rows.map(row => row.id))
        if (error) throw new Error(`Could not inspect demo history in ${table}.`)
        const existing = new Map((data || []).map(row => [row.id, row]))
        for (const row of rows) {
            if (existing.has(row.id) && !matchesSeed(existing.get(row.id), row)) {
                throw new Error(`History seed refused: an existing ${table} fixture differs; no records were changed.`)
            }
        }
        missing[table] = rows.filter(row => !existing.has(row.id))
    }
    const inserted = {}
    for (const [table, rows] of Object.entries(missing)) {
        inserted[table] = 0
        if (!rows.length) continue
        const { data, error } = await client.from(table).insert(rows).select("id")
        if (error || data?.length !== rows.length) {
            throw new Error(`Could not finish demo history in ${table}. Earlier inserts may remain; rerunning safely fills only missing rows.`)
        }
        inserted[table] = data.length
    }
    return { ok: true, project_ref: DEMO_PROJECT_REF, inserted, message: "Preloaded synthetic history only. Existing invoice, reminders and review state were preserved." }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        console.log(JSON.stringify(await seedDemoHistory({ env: process.env, argv: process.argv.slice(2) }), null, 2))
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
