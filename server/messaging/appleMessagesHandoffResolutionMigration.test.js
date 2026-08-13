import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
    "../../supabase/migrations/202608120003_resolve_apple_messages_handoffs.sql",
    import.meta.url
)

test("records only explicit human-reported handoff resolutions", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(sql, /user_reported_sent/i)
    assert.match(sql, /user_confirmed_not_sent/i)
    assert.match(sql, /delivery_verified', false/i)
    assert.match(sql, /appointment_booked', false/i)
    assert.match(sql, /provider_mode', 'native_handoff'/i)
    assert.doesNotMatch(sql, /delivery_status', 'sent'/i)
})

test("keeps resolution atomic, idempotent, and service-role only", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(sql, /begin;[\s\S]*create or replace function[\s\S]*commit;/i)
    assert.match(sql, /where id = p_action_id[\s\S]*for update;/i)
    assert.match(sql, /where care_action_id = v_action\.id[\s\S]*for update;/i)
    assert.match(sql, /if v_handoff\.state = v_target_state[\s\S]*'existing'/i)
    assert.match(sql, /handoff_resolution_conflict/i)
    assert.match(sql, /grant execute[\s\S]*to service_role;/i)
    assert.match(sql, /revoke execute[\s\S]*from anon, authenticated;/i)
})

test("finishes sent reports and cancels confirmed not-sent actions", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(
        sql,
        /v_target_state = 'user_reported_sent'[\s\S]*status = 'succeeded'/i
    )
    assert.match(
        sql,
        /else[\s\S]*status = 'cancelled'[\s\S]*cancelled_at = v_now/i
    )
    assert.match(sql, /external_action_status = 'user_reported_sent'/i)
    assert.match(sql, /external_action_taken = false/i)
})
