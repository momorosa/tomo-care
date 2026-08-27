import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
    "../../supabase/migrations/202608260001_materialize_verified_vaccine_evidence.sql",
    import.meta.url
)
const routeUrl = new URL("../routes/documents.js", import.meta.url)

test("migration keeps Rabies materialization server-only, deduped, and conflict-safe", async () => {
    const sql = await readFile(migrationUrl, "utf8")

    assert.match(sql, /security definer/i)
    assert.match(sql, /only a certificate may establish a Rabies administration date/i)
    assert.match(sql, /Conflicting trusted Rabies next-due date requires review/i)
    assert.match(sql, /source_document_ids/i)
    assert.match(sql, /product_expiration_date/i)
    assert.match(sql, /grant execute .* service_role/is)
    assert.doesNotMatch(sql, /grant execute .* authenticated/is)
    assert.doesNotMatch(sql, /event_type[^;]*reminder/is)
})

test("approval invokes the vaccine transaction before other trusted inserts", async () => {
    const source = await readFile(routeUrl, "utf8")
    const vaccineRpc = source.indexOf(
        '"materialize_verified_vaccine_evidence"'
    )
    const eventInsert = source.indexOf(
        'sbAdmin.from("events").insert(eventsToInsert)'
    )
    const weightRpc = source.indexOf(
        '"materialize_verified_weight_measurement"'
    )

    assert.ok(vaccineRpc > 0)
    assert.ok(vaccineRpc < eventInsert)
    assert.ok(vaccineRpc < weightRpc)
    assert.match(source, /The document remains in review/i)
})
