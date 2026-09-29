import process from "node:process"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { prepareDemoReset } from "./resetDemoEnvironment.js"
import { getSupabaseServerConfig } from "../config/supabaseConfig.js"
import { prepareDemoCalendarReset } from "../demo/demoCalendarReset.js"
import { isManifestOwnedDemoInvoice } from "../demo/demoInvoiceReviewContract.js"
import {
    DEMO_INTAKE_FIXTURE as source,
    DEMO_PET_ID,
    DEMO_STORAGE_BUCKET,
} from "../demo/scenarioManifest.js"
import { LIBRELA_APPOINTMENT_WORKFLOW } from "../orchestration/persistedLibrelaAppointmentWorkflow.js"

const derivedTables = ["cost_items", "labs", "facts", "events"]
const deleteOrder = [
    "apple_messages_handoffs",
    "care_actions",
    "orchestration_runs",
    ...derivedTables,
]

async function read(query, label) {
    const { data, error } = await query.limit(1000)
    if (error || !Array.isArray(data) || data.length >= 1000)
        throw new Error(
            `Receipt reset stopped: could not completely inspect ${label}. No further changes were made.`
        )
    return data
}

function checkPet(rows) {
    if (rows.some((row) => row.pet_id !== DEMO_PET_ID))
        throw new Error(
            "Receipt reset refused: a source-linked record belongs to another pet."
        )
}

function sourceLinkedRun(run) {
    const r = run.result_json,
        s = run.state_json
    return [
        r?.draft?.evidence?.source_document_id,
        r?.sourceDocument?.id,
        r?.reminder?.doc_id,
        r?.reminder?.details_json?.source_document_id,
        s?.communication_handoff?.draft?.evidence?.source_document_id,
        s?.records_handoff?.sourceDocument?.id,
        s?.records_handoff?.reminder?.doc_id,
        s?.records_handoff?.reminder?.details_json?.source_document_id,
    ].includes(source.documentId)
}

async function inspectReceipt(client) {
    const rows = {}
    rows.documents = await read(
        client.from("documents").select("*").eq("id", source.documentId),
        "the September receipt"
    )
    if (rows.documents.some((doc) => !isManifestOwnedDemoInvoice(doc)))
        throw new Error(
            "Receipt reset refused: the September document no longer matches the synthetic fixture ownership."
        )
    for (const table of derivedTables) {
        rows[table] = await read(
            client.from(table).select("*").eq("doc_id", source.documentId),
            table
        )
        checkPet(rows[table])
    }
    const eventIds = rows.events.map((row) => row.id)
    rows.care_actions = eventIds.length
        ? await read(
              client
                  .from("care_actions")
                  .select("*")
                  .in("source_event_id", eventIds),
              "receipt actions"
          )
        : []
    checkPet(rows.care_actions)
    const actionIds = rows.care_actions.map((row) => row.id)
    rows.apple_messages_handoffs = actionIds.length
        ? await read(
              client
                  .from("apple_messages_handoffs")
                  .select("*")
                  .in("care_action_id", actionIds),
              "receipt handoffs"
          )
        : []
    rows.orchestration_runs = (
        await read(
            client
                .from("orchestration_runs")
                .select("*")
                .eq("pet_id", DEMO_PET_ID)
                .eq("workflow_type", LIBRELA_APPOINTMENT_WORKFLOW),
            "appointment drafts"
        )
    ).filter(sourceLinkedRun)
    const runIds = rows.orchestration_runs.map((row) => row.id)
    if (runIds.length) {
        const linked = await read(
            client
                .from("care_actions")
                .select("id")
                .in("orchestration_run_id", runIds),
            "draft dependencies"
        )
        if (linked.some((row) => !actionIds.includes(row.id)))
            throw new Error(
                "Receipt reset refused: a September draft is shared with an unrelated action."
            )
    }
    return rows
}

// No caller-supplied targets: every apply builds its own fresh, fixed-source plan.
// Stop app/worker processes before applying. This administrative cleanup is staged,
// not a database transaction; failures are surfaced and the same command can retry.
export async function resetDemoReceipt({
    env = process.env,
    argv = process.argv.slice(2),
    clientFactory,
    calendarReset = prepareDemoCalendarReset,
} = {}) {
    const { values } = parseArgs({
        args: argv,
        options: {
            "project-ref": { type: "string" },
            apply: { type: "boolean", default: false },
        },
        strict: true,
        allowPositionals: false,
    })
    const { runtime } = prepareDemoReset({ env, argv })
    const { url, secretKey } = getSupabaseServerConfig(env)
    const makeClient =
        clientFactory || (await import("@supabase/supabase-js")).createClient
    const client = makeClient(url, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const rows = await inspectReceipt(client)
    // The same ownership and destination validation is used in preview and apply.
    const calendarEvents = await calendarReset({
        client,
        env,
        preview: !values.apply,
    })
    const result = {
        ok: true,
        mode: values.apply ? "applied" : "preview_only",
        project_ref: runtime.projectRef,
        document_id: source.documentId,
        records: Object.fromEntries(
            Object.entries(rows).map(([table, records]) => [
                table,
                records.map((row) => row.id),
            ])
        ),
        calendar_events: calendarEvents,
        storage_object: `${DEMO_STORAGE_BUCKET}/${source.storageKey}`,
        preserved:
            "May/July history, all unrelated records, pet profile, and the original Gmail email. No seed data is inserted.",
    }
    if (!values.apply) return result
    for (const table of deleteOrder) {
        if (!rows[table].length) continue
        let query = client
            .from(table)
            .delete()
            .in(
                "id",
                rows[table].map((row) => row.id)
            )
        if (table !== "apple_messages_handoffs")
            query = query.eq("pet_id", DEMO_PET_ID)
        if (derivedTables.includes(table))
            query = query.eq("doc_id", source.documentId)
        const { error } = await query
        if (error)
            throw new Error(
                `Receipt reset stopped while removing ${table}. Earlier scoped cleanup may remain; keep servers stopped and retry the same receipt-only command.`
            )
    }
    const { error: storageError } = await client.storage
        .from(DEMO_STORAGE_BUCKET)
        .remove([source.storageKey])
    if (storageError)
        throw new Error(
            "Receipt reset stopped at the saved PDF. Earlier scoped cleanup may remain; retry the receipt-only command."
        )
    // Remove the deduplication/source row last so the same Gmail attachment can re-enter intake.
    const { error } = await client
        .from("documents")
        .delete()
        .eq("id", source.documentId)
        .eq("pet_id", DEMO_PET_ID)
    if (error)
        throw new Error(
            "Receipt reset stopped at the document. Retry the receipt-only command before restarting the app."
        )
    const remaining = await inspectReceipt(client)
    if (Object.values(remaining).some((records) => records.length))
        throw new Error(
            "Receipt reset verification found new source-linked records. Stop all app/worker processes and retry."
        )
    return result
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    try {
        console.log(JSON.stringify(await resetDemoReceipt(), null, 2))
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
