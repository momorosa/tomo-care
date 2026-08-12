import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
    "../../supabase/migrations/202608120001_materialize_verified_weight.sql",
    import.meta.url
)

test("migration is service-role only and creates one atomic weight contract", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(sql, /create unique index if not exists facts_one_verified_weight_per_document_idx/i)
    assert.match(sql, /create or replace function public\.materialize_verified_weight_measurement/i)
    assert.match(sql, /for update/i)
    assert.match(sql, /status = 'verified'/i)
    assert.match(sql, /update public\.documents/i)
    assert.match(sql, /update public\.pets/i)
    assert.match(sql, /order by fact_date desc/i)
    assert.match(sql, /grant execute .* to service_role/i)
    assert.match(sql, /revoke all .* from authenticated/i)
})

test("migration preserves fact provenance and human verification metadata", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(sql, /source_context/i)
    assert.match(sql, /source_document_id/i)
    assert.match(sql, /verified_at/i)
    assert.match(sql, /verified_by/i)
    assert.match(sql, /verified_weight_v1/i)
})
