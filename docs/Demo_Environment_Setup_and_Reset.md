# TomoCare Demo Environment Setup and Reset

**Slice:** Demo Environment and Resettable Synthetic Dataset  
**Allowlisted hosted project:** `gohzjjqsbtwavjuhjdwj`  
**Project URL:** `https://gohzjjqsbtwavjuhjdwj.supabase.co`

This setup keeps one TomoCare codebase while isolating all portfolio data in a
separate hosted Supabase project. The demo project receives the same schema,
one deterministic fictional scenario, and one guarded administrative reset.

Do not copy, restore, export, anonymize, or sample the real-care database.

## What is separate

The isolation boundary is the Supabase **project**, not a demo table inside the
real-care project. The demo project has its own Postgres database, Storage
bucket, URL, and server secret.

The browser never receives the project URL, project reference, pet UUID,
Supabase secret, provider configuration, or reset authority. It receives only
the confirmed runtime mode, a safe label, a fictional-data notice, and the
current care date.

## Step 1 — Create a dedicated server secret

In the `TomoCare Demo` Supabase project:

1. Open **Settings → API Keys**.
2. Open **Publishable and secret API keys**.
3. Select **Create new secret key**.
4. Name it `tomocare_demo_server`.
5. Copy it into your password manager.

Do not use a publishable key for the server. Do not paste the secret into chat,
commit it, put it in a screenshot, or prefix it with a browser-exposed variable
name.

## Step 2 — Initialize and link the local Supabase CLI

Run these commands from the TomoCare repository root:

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref gohzjjqsbtwavjuhjdwj
```

`supabase login` opens a browser sign-in. `supabase init` creates local CLI
configuration; it does not create or replace the existing migrations.
`supabase link` may ask for the database password created with the hosted demo
project.

Before continuing, confirm that the link command names this exact reference:

```text
gohzjjqsbtwavjuhjdwj
```

Stop if any other reference appears.

## Step 3 — Review and apply the schema migrations

Preview the migration plan first:

```bash
npx supabase db push --dry-run
```

The first migration should be:

```text
202607010001_create_tomocare_base_schema.sql
```

It fills the fresh-schema gap by creating the original base tables and the
private `tomo-docs` Storage bucket. Later migrations add governed actions,
orchestration, Apple Messages handoff state, verified weight materialization,
and verified vaccine evidence.

Apply the migrations only after the dry run targets the demo project:

```bash
npx supabase db push
```

The migration enables RLS on all original base tables. Only `field_plan` gets
browser-user policies; care tables remain available through the server-owned
secret rather than direct anonymous browser access.

## Step 4 — Create the local demo environment file

Create a new untracked file named `.env.demo` in the repository root. Add:

```text
TOMOCARE_RUNTIME_MODE=demo
SUPABASE_URL=https://gohzjjqsbtwavjuhjdwj.supabase.co
SUPABASE_SECRET_KEY=PASTE_THE_DEMO_SERVER_SECRET_HERE
TOMO_PET_ID=d3000000-0000-4000-8000-000000000001
APP_TIME_ZONE=America/Los_Angeles
```

For Chat and Voice validation, also copy the existing server-only OpenAI
configuration into `.env.demo` locally. Do not add Gmail, Google Calendar, SMS,
clinic-recipient, or Messages destination configuration. Those capabilities
fail closed in demo mode during this slice.

Keep `.env.demo` out of Git, ZIP files, chat, screenshots, and browser code.

## Step 5 — Run the guarded reset

Run the only demo reset command:

```bash
npm run demo:reset -- --project-ref gohzjjqsbtwavjuhjdwj
```

The script refuses mutation unless all of these are true before the first
delete, upload removal, or insert:

1. `TOMOCARE_RUNTIME_MODE` is exactly `demo`.
2. `SUPABASE_URL` resolves to the exact allowlisted project reference.
3. The command repeats that exact project reference.
4. `TOMO_PET_ID` matches the fixed fictional scenario manifest.
5. Every table and Storage prefix matches the hard-coded allowlist.

The successful result reports the current Pacific care date and these row
counts:

```text
pets:                       1
documents:                  5
events:                     4
cost_items:                 1
labs:                       0
facts:                      5
provider_contacts:          0
orchestration_runs:         0
care_actions:               0
apple_messages_handoffs:    0
```

The only removable Storage scope is:

```text
tomo-docs/demo/tomocare-demo-v1
```

Run the same reset command a second time. It should succeed with the same
logical records and counts, without duplicates.

## Step 6 — Start TomoCare in demo mode

```bash
npm run dev:demo
```

Open the local Vite URL. Before any care data appears, TomoCare confirms the
server-owned runtime context. The global header then shows a persistent,
accessible **Demo data** indicator across Dashboard, Verify, Chat, Voice, and
drawers.

Expected baseline:

- one clearly fictional Momo profile;
- four source-linked verified weight facts;
- one fictional verified Librela injection and current follow-up reminder;
- one fictional Simparica administration and current reminder;
- one clinic-reported Rabies next-due fact that does not claim administration;
- no pending invoice, provider contact, Calendar destination, or Messages
  destination.

## Step 7 — Confirm the fail-closed boundary

This command intentionally uses the wrong confirmation and must fail before
mutation:

```bash
npm run demo:reset -- --project-ref wrong-project
```

Expected reason:

```text
project_confirmation_mismatch
```

In the demo UI, Gmail inbox checks, Google Calendar writes, and Apple Messages
handoff preparation return a bounded `demo_external_action_blocked` response.
They do not call a provider, open a native destination, or claim success.

## Returning to real-care mode

The existing `.env` remains the real-care configuration. Before starting the
real application after this slice, add:

```text
TOMOCARE_RUNTIME_MODE=real
TOMO_PET_ID=YOUR_EXISTING_REAL_PET_UUID
```

Keep the existing real Supabase URL and backend key in `.env`. Real mode refuses
to start if either the allowlisted demo project or the fixed synthetic pet ID
is present.

Never run the demo reset command with the real-care `.env`.
