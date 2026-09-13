import test from "node:test"
import assert from "node:assert/strict"
import { checkLocalSetup } from "./checkLocalSetup.js"
import { DEMO_PET_ID, DEMO_PROJECT_URL } from "../demo/scenarioManifest.js"

const env = {
    TOMOCARE_RUNTIME_MODE: "demo", SUPABASE_URL: DEMO_PROJECT_URL,
    TOMO_PET_ID: DEMO_PET_ID, SUPABASE_SECRET_KEY: "secret-do-not-print",
    DEMO_GMAIL_ALLOWED_SENDER: "sender@example.com", DEMO_GMAIL_RECIPIENT: "inbox@example.com",
}
const pythonOk = () => ({ status: 0, stdout: '{"ok":true}' })

test("setup reads only the configured pet and Gmail profile, without exposing credentials", async () => {
    const calls = []
    const result = await checkLocalSetup({ env, dependencies: {
        spawnSync: pythonOk,
        createClient() { return { from(table) {
            assert.equal(table, "pets")
            return { select(fields) {
                assert.equal(fields, "id")
                return { eq(column, value) {
                    assert.equal(column, "id"); assert.equal(value, DEMO_PET_ID)
                    return { async limit(count) {
                        assert.equal(count, 1); calls.push("pet")
                        return { data: [{ id: DEMO_PET_ID }], error: null }
                    } }
                } }
            } }
        } } },
        async getGmailClient() { return { users: { async getProfile() {
            calls.push("profile"); return { data: { emailAddress: env.DEMO_GMAIL_RECIPIENT } }
        } } } },
    } })
    assert.equal(result.ok, true)
    assert.deepEqual(calls, ["pet", "profile"])
    assert.doesNotMatch(JSON.stringify(result), /secret-do-not-print|inbox@example|supabase.co/)
})

test("offline setup never creates external clients", async () => {
    let connected = false
    const unexpected = () => { connected = true; throw new Error("unexpected") }
    const result = await checkLocalSetup({ env, offline: true, dependencies: {
        spawnSync: pythonOk, createClient: unexpected, getGmailClient: unexpected,
    } })
    assert.equal(result.ok, true)
    assert.equal(connected, false)
})

test("missing Python dependencies fail the check without leaking subprocess output", async () => {
    const result = await checkLocalSetup({ env, offline: true, dependencies: {
        spawnSync: () => ({ status: 1, stdout: '{"ok":false}', stderr: "sensitive diagnostic" }),
    } })
    assert.equal(result.ok, false)
    assert.doesNotMatch(JSON.stringify(result), /sensitive diagnostic/)
})

test("a wrong database identity prevents connection checks", async () => {
    let touched = false
    const result = await checkLocalSetup({ env: { ...env, TOMOCARE_RUNTIME_MODE: "real" }, dependencies: {
        spawnSync() { touched = true },
    } })
    assert.equal(result.ok, false)
    assert.equal(touched, false)
})

test("a wrong Gmail account is a failed setup check", async () => {
    const result = await checkLocalSetup({ env, dependencies: {
        spawnSync: pythonOk,
        createClient() { throw new Error("unavailable") },
        async getGmailClient() { return { users: { async getProfile() { return { data: { emailAddress: "wrong@example.com" } } } } } },
    } })
    assert.equal(result.ok, false)
    assert.equal(result.checks.find((check) => check.name === "Gmail").ok, false)
})
