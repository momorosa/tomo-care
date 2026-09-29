# Database read recovery — September 20, 2026

Status: application mitigation implemented and tested; the original hosted rejection was not reproduced today. This is not a claim that Supabase’s underlying timing issue has been eliminated.

Rosa completed the manual validation and accepted this recovery slice on September 22, 2026. The provider’s original intermittent cause remains unproven.

## Diagnosis and evidence

On September 19, two dashboard document-list requests reported `JWT issued at future`: the verified archive and the pending-review list. They use TomoCare’s Supabase database client, not Google Calendar authentication.

The demo uses an opaque `sb_secret_` key. TomoCare does not mint a user JWT for these calls or persist/refresh a user session. Supabase describes transforming these keys into short-lived JWTs at its hosted gateway: [JWT documentation](https://supabase.com/docs/guides/auth/jwts).

On September 20, 24 read-only probes of the allowlisted demo project succeeded. Response Date headers were within roughly one second of the local request-start time (coarse header precision and request latency apply). This does not measure the internal verifier clock. The Data API reported PostgREST **14.5**.

PostgREST documents the exact `PGRST303 / JWT issued at future` symptom and a later fix that removes a cached-time mechanism: [upstream fix](https://github.com/PostgREST/postgrest/pull/5208), [release history](https://github.com/PostgREST/postgrest/blob/main/CHANGELOG.md). This is relevant upstream evidence, not proof that the same defect caused our two requests. Supabase previously rolled back to 14.5 for a separate hosted incident: [provider incident](https://status.supabase.com/incidents/bv4ntm4x0btf). Version numbers alone are not a reason to alter the managed service.

No key rotation, Google reconnection, system-clock change, database migration, hosted restart, or provider upgrade was performed.

## Application changes

The shared server database client retries **once after one second**, only when all of these match:

- A GET/HEAD request to the configured Supabase origin’s REST table endpoint; RPC paths are excluded.
- HTTP 401 with a readable JSON response containing code `PGRST303` and exact message `JWT issued at future`.

The original query, headers and credentials are preserved. Aborting during the wait stops the retry. A second failure is returned normally. Writes, RPCs, Storage calls, other authentication failures and ambiguous network failures are never retried by this helper. HEAD responses without a readable matching error body pass through unchanged. The server emits the non-sensitive diagnostic code `supabase_read_token_timing_retry` when it retries; no tokens or request payloads are logged by the helper.

Inbox and Recently verified now track loading, success and failure separately. Failure shows **Couldn’t load documents**, with a dedicated **Retry loading documents** action. Existing records remain visible with an out-of-date warning. A failed initial load cannot display “No verified records yet” or a zero review count. Retry reads the saved list; it does not check Gmail or reprocess documents. Successful reloads replace stale results, including when the fresh list is empty.

These shared application changes apply to demo and private care. Provider permissions and care approval rules are unchanged.

## Validation

- 741 affected regression tests passed, including 13 new transport tests for SDK recovery, retry exhaustion, write/RPC/destination exclusions, other auth errors, network errors and cancellation.
- Injected one matching rejection ahead of a **real read-only demo query**: exactly two attempts, one retry, then all three verified documents loaded. The rejection was simulated; the successful read used the hosted database.
- Browser fixture: failed initial load, cached-record failure, successful retry in both panels, genuine empty result. Retrying left the fixture’s Gmail-call counter at zero.
- Actual demo browser: Recently verified listed all three documents; Inbox correctly showed zero pending review documents.
- Focused ESLint and production build passed. Existing LiveKit bundle-size warning remains.
- No care records, reminders, Calendar events or inbox messages were changed.

## Minimum manual check

Start `npm run dev:demo`; no reset is needed. Open **Recently verified** and confirm all three documents appear. Open **Inbox** and confirm its list/count loads. One reload of the page is enough; do not repeatedly attempt to induce a hosted error.

Optional: open `http://localhost:5173/tests/browser/document-loading-fixtures.html` to inspect the error safely. It uses the shipped drawer components with fictional local state and makes no API calls. **Retry loading documents** should replace the error with the sample record; the Gmail-call counter must remain zero.

Run `npm run test:database-recovery` for the focused automated checks.

## Remaining uncertainty

This closes the missing application recovery and misleading-empty-state defects. It does not guarantee that the upstream rejection cannot recur or that writes are immune. If failures persist after the bounded retry, retain the time and affected endpoint for a Supabase investigation. Do not refresh user sessions, rotate credentials, weaken JWT validation, or replay care writes as a workaround. Existing integrated Journey acceptance remains required before capture.
