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
configuration into `.env.demo` locally.

For the allowlisted synthetic-invoice intake, reuse the existing TomoCare
inbox's server-only Gmail OAuth configuration and add these two local values:

```text
GMAIL_CLIENT_ID=YOUR_EXISTING_TOMOCARE_GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET=YOUR_EXISTING_TOMOCARE_GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN=YOUR_EXISTING_TOMOCARE_GMAIL_REFRESH_TOKEN
GMAIL_REDIRECT_URI=YOUR_EXISTING_TOMOCARE_GMAIL_REDIRECT_URI
DEMO_GMAIL_ALLOWED_SENDER=YOUR_OTHER_SENDER_EMAIL
DEMO_GMAIL_RECIPIENT=YOUR_EXISTING_TOMOCARE_INBOX_EMAIL
```

The sender account requires no OAuth setup. It only sends the synthetic
message. Demo mode uses the existing inbox connection but constructs one
server-owned Gmail query from the configured sender and recipient, then
revalidates the authenticated inbox, direct sender, recipient, subject prefix,
attachment filename, MIME type, and PDF hash before ingestion. It does not use
the broad real-care Gmail query in demo mode.

Send this repository fixture from the configured sender to the configured
recipient:

```text
Attachment: demo/fixtures/tomocare-demo-v1-harborlight-invoice.pdf
Subject:    [TomoCare Demo] Librela visit
```

The text after `[TomoCare Demo]` may vary. The marker must begin at the first
character of the subject. Do not rename or modify the PDF; changed bytes fail
the manifest-owned content check.

The exact source travels through the existing raw-text, extraction,
Verification Intelligence, correction, and explicit verification path. The
synthetic candidate deliberately leaves the printed invoice number empty so
the review has one meaningful, insurance-relevant correction. In Verify,
compare the candidate with the PDF, enter `HVC-DEMO-090726`, and select
**Save correction & recheck**. Confirm that this save alone creates no trusted
event, weight, cost, or preventive-status row. Then select
**Verify and add to care record** and confirm the verification summary before
continuing to optional actions.

Run the focused Gate 3 contract before the manual check:

```bash
npm run test:demo-gmail-trusted
```

Expected review state after a successful non-dry inbox check:

- the source PDF, raw text, and editable candidate render together;
- Librela, 13.1 kg, four charge lines, the $177.00 paid total, and the
  clinic-reported Rabies status are present as candidate truth;
- Rabies administration remains absent;
- Verification Intelligence shows exactly one blocking item for `invoice_id`;
- saving the corrected draft reruns the review and clears that block without
  materializing trusted records.
- explicit verification creates one source-linked Librela event, one verified
  13.1 kg weight, four cost items totaling $177.00, and the exact
  clinic-reported Rabies status without creating Rabies administration;
- Dashboard, Chat, and Voice use the newly verified source-linked evidence;
- checking the inbox again skips the existing document and trusted rows.

Do not add Google Calendar, SMS, clinic-recipient, or Messages destination
configuration. Those capabilities remain blocked in demo mode.

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
5. Every row selector and the one removable Storage object match the frozen
   manifest allowlist.

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

The only removable Storage object is:

```text
tomo-docs/demo/tomocare-demo-v1/intake/tomocare-demo-v1-harborlight-invoice.pdf
```

Run the same reset command a second time. It should succeed with the same
logical records and counts, without duplicates. Reset does not list or sweep
the prefix and does not delete the retained source email from Gmail.

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

In the demo UI, only the exact synthetic Gmail intake contract may contact a
provider. Missing allowlist configuration, the wrong authenticated recipient,
or a nonmatching sender, subject, filename, MIME type, or PDF hash is rejected
or ignored before document creation. Google Calendar writes and Apple Messages
handoff preparation continue to return `demo_external_action_blocked`. They do
not call a provider, open a native destination, or claim success.

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
