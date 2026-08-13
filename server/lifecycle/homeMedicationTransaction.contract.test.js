import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const MIGRATION_URL = new URL(
    "../../supabase/migrations/202607200001_execute_home_medication_action.sql",
    import.meta.url
)
const SQL = readFileSync(MIGRATION_URL, "utf8")

test("keeps home-medication execution inside one approved and idempotent transaction", () => {
    assert.match(SQL, /^begin;/m)
    assert.match(SQL, /create or replace function public\.execute_mark_home_medication_given/)
    assert.match(SQL, /from public\.care_actions[\s\S]*?for update;/)
    assert.match(SQL, /if v_action\.status = 'succeeded' then[\s\S]*?'disposition', 'existing'/)
    assert.match(SQL, /if v_action\.status <> 'approved' then/)
    assert.match(SQL, /update public\.care_actions[\s\S]*?set status = 'executing'/)
    assert.match(SQL, /update public\.care_actions[\s\S]*?set status = 'succeeded'/)
    assert.match(SQL, /^commit;/m)

    assert.ok(
        SQL.indexOf("if v_action.status = 'succeeded' then") <
            SQL.indexOf("if v_action.status <> 'approved' then")
    )
})

test("locks trusted evidence and protects one administration plus exactly one successor", () => {
    assert.match(SQL, /v_payload ->> 'source_reminder_updated_at'/)
    assert.match(SQL, /v_next_due_date <> v_administered_date \+ v_cadence_days/)
    assert.match(SQL, /target date does not match the preferred weekday rule/)
    assert.match(SQL, /next reminder date does not match the reminder rule/)
    assert.match(SQL, /from public\.events[\s\S]*?where id = v_source_reminder_id[\s\S]*?for update;/)
    assert.match(SQL, /insert into public\.events \([\s\S]*?'medication_administration'/)
    assert.match(SQL, /update public\.events[\s\S]*?set status = 'completed'/)
    assert.match(SQL, /limit 2[\s\S]*?for update/)
    assert.match(SQL, /cardinality\(v_next_reminder_candidate_ids\).*?> 1[\s\S]*?ambiguous_next_reminder/)
    assert.match(SQL, /cardinality\(v_next_reminder_candidate_ids\).*?= 1[\s\S]*?update public\.events[\s\S]*?else[\s\S]*?insert into public\.events/)
    assert.match(SQL, /'administration_event_id', v_administration_event_id/)
    assert.match(SQL, /'next_reminder_id', v_next_reminder_id/)
})

test("keeps the trusted write boundary server-only", () => {
    assert.match(
        SQL,
        /revoke all on function public\.execute_mark_home_medication_given\(uuid, text, date\)[\s\S]*?from public;/
    )
    assert.match(
        SQL,
        /revoke execute on function public\.execute_mark_home_medication_given\(uuid, text, date\)[\s\S]*?from anon, authenticated;/
    )
    assert.match(
        SQL,
        /grant execute on function public\.execute_mark_home_medication_given\(uuid, text, date\)[\s\S]*?to service_role;/
    )
})
