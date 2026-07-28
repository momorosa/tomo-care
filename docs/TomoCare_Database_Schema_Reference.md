# TomoCare Database Schema Reference

**Captured:** July 18, 2026  
**Scope:** `pets` and `events` tables relevant to Phase 3B action design  
**Source:** Read-only PostgreSQL metadata queries against the TomoCare Supabase project

This file records structural metadata only. It intentionally contains no pet records, document contents, credentials, tokens, or private URLs.

## Why this reference exists

Phase 3B introduces governed action state and new trusted-event writes. This reference preserves the existing database conventions so future migrations can remain consistent without repeatedly asking Rosa to inspect the schema.

## Existing conventions

- Primary keys use UUIDs with `gen_random_uuid()` defaults.
- Foreign keys use explicit names such as `events_pet_id_fkey`.
- JSON payloads use `jsonb` with an empty-object default where appropriate.
- Audit timestamps use `timestamp with time zone` and default to `now()`.
- Mutable tables include `created_at` and `updated_at`.
- `updated_at` is maintained by a shared `set_updated_at()` trigger function.
- Business calendar dates such as `event_date` use PostgreSQL `date`.
- Exact moments such as `created_at`, `event_start`, and `event_end` use `timestamptz`.

## `public.pets`

| Position | Column | PostgreSQL type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `name` | `text` | No | — |
| 3 | `species` | `text` | No | `'canine'` |
| 4 | `breed` | `text` | Yes | — |
| 5 | `sex` | `text` | Yes | — |
| 6 | `spayed_neutered` | `boolean` | Yes | — |
| 7 | `birth_date` | `date` | Yes | — |
| 8 | `microchip_id` | `text` | Yes | — |
| 9 | `patient_external_id` | `text` | Yes | — |
| 10 | `weight_value` | `numeric` | Yes | — |
| 11 | `weight_unit` | `text` | Yes | `'kg'` |
| 12 | `notes` | `text` | Yes | — |
| 13 | `created_at` | `timestamptz` | No | `now()` |
| 14 | `updated_at` | `timestamptz` | No | `now()` |

### Constraints

- Primary key: `pets_pkey` on `id`
- Required-column checks are present for `id`, `name`, `species`, `created_at`, and `updated_at`

### Trigger

```text
pets_set_updated_at
BEFORE UPDATE
EXECUTE FUNCTION set_updated_at()
```

## `public.events`

| Position | Column | PostgreSQL type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | No | `gen_random_uuid()` |
| 2 | `pet_id` | `uuid` | No | — |
| 3 | `doc_id` | `uuid` | Yes | — |
| 4 | `event_type` | `text` | No | — |
| 5 | `event_date` | `date` | No | — |
| 6 | `event_start` | `timestamptz` | Yes | — |
| 7 | `event_end` | `timestamptz` | Yes | — |
| 8 | `status` | `text` | No | `'completed'` |
| 9 | `details_json` | `jsonb` | No | `'{}'::jsonb` |
| 10 | `created_at` | `timestamptz` | No | `now()` |
| 11 | `updated_at` | `timestamptz` | No | `now()` |

### Constraints

- Primary key: `events_pkey` on `id`
- Foreign key: `events_pet_id_fkey`, `pet_id -> pets.id`
- Foreign key: `events_doc_id_fkey`, `doc_id -> documents.id`
- Required-column checks are present for `id`, `pet_id`, `event_type`, `event_date`, `status`, `details_json`, `created_at`, and `updated_at`

### Trigger

```text
events_set_updated_at
BEFORE UPDATE
EXECUTE FUNCTION set_updated_at()
```

## Phase 3B implications

### Reuse existing conventions

The planned `care_actions` table should:

- Use a UUID primary key with `gen_random_uuid()`.
- Reference `pets.id` through `pet_id`.
- Use `jsonb` for structured proposal, preview, evidence, result, and error data.
- Store lifecycle moments as `timestamptz`.
- Include `created_at` and `updated_at` with `now()` defaults.
- Reuse `set_updated_at()` through a `BEFORE UPDATE` trigger.
- Use named status and request-source check constraints.
- Add indexes for active action lookup and idempotency.

### Preserve explicit event statuses

The `events.status` default is `completed`, but TomoCare workflows rely on explicit meanings. Phase 3B code must continue setting statuses explicitly:

```text
Verified medication administration:
event_type = medication_administration
status = verified

Active home-medication reminder:
event_type = reminder
status = planned

Handled reminder:
event_type = reminder
status = completed
```

Never rely on the `events.status` default for a trusted action write.

### Keep care dates separate from audit timestamps

- `event_date` represents the care day in `APP_TIME_ZONE`.
- `created_at`, `updated_at`, approval timestamps, and execution timestamps represent exact instants and remain `timestamptz` values.

## Metadata not yet captured

The supplied multi-statement query returned trigger metadata but did not include the index result set. Existing `pets` and `events` index definitions can be captured later if a migration needs to mirror a specific indexing convention. This does not block creation of the Phase 3B `care_actions` table.

