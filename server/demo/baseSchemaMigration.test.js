import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const migrationUrl = new URL(
    "../../supabase/migrations/202607010001_create_tomocare_base_schema.sql",
    import.meta.url
)

test("fresh-schema migration creates every original base table without care rows", async () => {
    const source = await readFile(migrationUrl, "utf8")

    for (const table of [
        "pets",
        "documents",
        "events",
        "cost_items",
        "labs",
        "facts",
        "field_plan",
    ]) {
        assert.match(source, new RegExp(`create table if not exists public\\.${table}`))
        assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`))
    }

    assert.match(source, /insert into storage\.buckets/)
    assert.match(source, /'tomo-docs'/)
    assert.match(source, /false,/)
    assert.doesNotMatch(source, /insert into public\.(pets|documents|events|facts|labs|cost_items)/)
    assert.doesNotMatch(source, /6e90e0b7|Momo|SoMa Animal Hospital/)
})
