import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
    "../../supabase/migrations/202608120002_create_apple_messages_handoffs.sql",
    import.meta.url
)

test("keeps native handoff atomic, idempotent, and service-role only", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(sql, /begin;[\s\S]*create or replace function[\s\S]*commit;/i)
    assert.match(sql, /for update;/i)
    assert.match(sql, /unique index apple_messages_handoffs_one_per_action_idx/i)
    assert.match(sql, /on conflict \(care_action_id\) do nothing/i)
    assert.match(sql, /grant execute[\s\S]*to service_role;/i)
    assert.match(sql, /revoke execute[\s\S]*from anon, authenticated;/i)
})

test("revalidates approval, trusted evidence, recipient, hashes, and workflow", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    for (const evidence of [
        "status <> 'approved'",
        "source_reminder_updated_at",
        "injection_event_updated_at",
        "provider_contact_updated_at",
        "recipient_fingerprint_sha256",
        "message_sha256",
        "idempotency_key",
        "external_action_taken",
        "external_action_status",
        "governed_action,status",
    ]) {
        assert.match(sql, new RegExp(evidence.replace(",", "[,}]"), "i"))
    }
    assert.match(sql, /extensions\.digest/i)
    assert.match(sql, /address !~ '\^\\\+1\[2-9\]\[0-9\]\{9\}\$'/i)
})

test("stores no recipient address, message body, URI, or delivery claim", async () => {
    const sql = await readFile(migrationUrl, "utf8")
    const tableDefinition = sql.match(
        /create table public\.apple_messages_handoffs \(([\s\S]*?)\n\);/i
    )?.[1]

    assert.ok(tableDefinition)
    assert.doesNotMatch(tableDefinition, /\baddress\b/i)
    assert.doesNotMatch(tableDefinition, /\bmessage_body\b/i)
    assert.doesNotMatch(tableDefinition, /\blaunch_uri\b/i)
    assert.doesNotMatch(tableDefinition, /\bdelivered\b|\breceived\b|\bbooked\b/i)
    assert.match(tableDefinition, /messages_handoff_requested/i)
})
