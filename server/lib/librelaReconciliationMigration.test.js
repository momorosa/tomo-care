import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
    "../../supabase/migrations/202608110001_reconcile_verified_librela_cycle.sql",
    import.meta.url
)

test("keeps the Librela repair atomic, idempotent, and service-role only", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(sql, /begin;[\s\S]*create or replace function[\s\S]*commit;/i)
    assert.match(sql, /for update;/i)
    assert.match(sql, /events_librela_reconciliation_key_unique/i)
    assert.match(sql, /newer_verified_injection_exists/i)
    assert.match(sql, /grant execute[\s\S]*to service_role;/i)
    assert.match(sql, /revoke execute[\s\S]*from anon, authenticated;/i)
})

test("never deletes events and completes only planned Librela reminders", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.doesNotMatch(sql, /delete\s+from\s+public\.events/i)
    assert.match(
        sql,
        /update public\.events event[\s\S]*event_type = 'reminder'[\s\S]*event\.status = 'planned'[\s\S]*subtype' = 'Librela'/i
    )
    assert.match(sql, /completion_reason'[\s\S]*superseded_by_verified_librela_injection/i)
})
