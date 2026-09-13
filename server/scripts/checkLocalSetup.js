import "dotenv/config"
import process from "node:process"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { getServerRuntimeContext, toPublicRuntimeContext } from "../config/runtimeContext.js"
import { getSupabaseServerConfig } from "../config/supabaseConfig.js"
import { getGmailClient } from "../gmail/gmailInbox.js"
import { getDemoGmailIntakeContract, evaluateDemoGmailAccount } from "../demo/demoGmailIntakeContract.js"
import { resolvePythonBin, PROJECT_ROOT } from "../config/pythonRuntime.js"

export async function checkLocalSetup({ env = process.env, offline = false, dependencies = {} } = {}) {
    const checks = []
    const report = (name, ok, detail) => checks.push({ name, ok, detail })
    let runtime
    let config
    let demoContract
    try {
        runtime = getServerRuntimeContext(env)
        config = getSupabaseServerConfig(env)
        if (runtime.mode === "demo") demoContract = getDemoGmailIntakeContract(env)
        report("Environment", true, toPublicRuntimeContext(runtime).label)
    } catch {
        report("Environment", false, "Check the runtime mode, database identity, server key, pet, and demo allowlist in the selected environment file.")
        return { ok: false, offline, checks }
    }

    const runPython = dependencies.spawnSync || spawnSync
    try {
        const result = runPython(resolvePythonBin({ env }), [path.join(PROJECT_ROOT, "agent/scripts/check_local_setup.py")], {
            cwd: PROJECT_ROOT, env, encoding: "utf8", timeout: 30000,
        })
        const data = JSON.parse(result.stdout || "{}")
        const ok = result.status === 0 && data.ok === true
        report("PDF reader", ok, ok
            ? "The local synthetic invoice is readable; no document was imported."
            : "Install agent/requirements.txt in agent/.venv and check PYTHON_BIN. The local PDF check failed.")
    } catch {
        report("PDF reader", false, "Python could not complete the local check. Check agent/.venv and PYTHON_BIN.")
    }

    if (!offline) {
        try {
            const client = (dependencies.createClient || createClient)(config.url, config.secretKey, {
                auth: { autoRefreshToken: false, persistSession: false },
                global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
            })
            const { data, error } = await client.from("pets").select("id").eq("id", runtime.petId).limit(1)
            const ok = !error && data?.length === 1
            report("Database", ok, ok ? "Connected; the configured pet exists." : "Could not read the configured pet. Check the selected database and server key.")
        } catch {
            report("Database", false, "Connection failed. Check network access and database configuration.")
        }
        try {
            const gmail = await (dependencies.getGmailClient || getGmailClient)({ env })
            const { data } = await gmail.users.getProfile({ userId: "me" }, { timeout: 10000, retry: false })
            const ok = Boolean(data?.emailAddress) && (!demoContract || evaluateDemoGmailAccount({ authenticatedEmail: data.emailAddress, contract: demoContract }).accepted)
            report("Gmail", ok, ok ? "Connected; no messages or attachments were read or imported." : "Connected mailbox does not match the demo allowlist.")
        } catch {
            report("Gmail", false, "Connection failed. Check the Gmail OAuth configuration and network access.")
        }
    }
    return { ok: checks.every((check) => check.ok), offline, checks }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const result = await checkLocalSetup({ offline: process.argv.includes("--offline") })
    console.log(`TomoCare setup check (${result.offline ? "local only" : "read-only connections"})`)
    for (const check of result.checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`)
    console.log("No intake, reset, care-record writes, messages, or provider actions were performed.")
    process.exitCode = result.ok ? 0 : 1
}
