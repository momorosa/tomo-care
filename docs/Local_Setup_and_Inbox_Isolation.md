# Local setup and inbox isolation

Use one codebase with separate private-care and demo database configurations.
Starting the app is separate from checking its dependencies and connections.

## Laptop setup

Use Node 22.12 or newer and Python 3.12 for this repository's pinned Python
dependencies. From the repository root:

```bash
npm ci
python3.12 -m venv agent/.venv
agent/.venv/bin/python -m pip install -r agent/requirements.txt
```

The intake worker and setup check prefer `agent/.venv` automatically, so an
activated shell environment is unnecessary. `PYTHON_BIN` remains an optional
override; if copied from another laptop, update or remove that old path.

The PDF reader is [PyMuPDF](https://pymupdf.readthedocs.io/en/latest/installation.html),
installed as `PyMuPDF` and imported as `pymupdf`. Do not install the unrelated
package named `fitz`. A missing reader previously produced the same Inbox
message as a PDF with unreadable text.

Keep `.env` for private care. Configure `.env.demo` using
[Demo Environment Setup and Reset](./Demo_Environment_Setup_and_Reset.md).
Environment files and credentials remain untracked. Existing shell variables
take precedence over env-file values; the setup output and app header must
confirm the intended environment before intake.

## Check setup without importing documents

```bash
npm run setup:check
npm run setup:check:demo
```

Each command validates the selected runtime/database identity and checks:

- the configured Python environment and extraction of the local synthetic PDF;
- read access to the one configured pet in the selected database;
- Gmail OAuth connectivity using only the account profile, including the
  exact recipient match in demo mode.

It never searches or downloads Gmail messages, creates document rows, writes
care records, resets data, sends messages, or calls animation or AI providers.
It reports safe summaries rather than credentials or raw provider errors.
These checks do not establish end-to-end Chat, Voice, Storage, extraction-AI,
or live-animation health.

For local configuration and PDF dependencies only, without connection checks:

```bash
npm run setup:check:demo -- --offline
```

## Start the intended environment

Stop any existing development servers first.

| Purpose | Command | Header |
| --- | --- | --- |
| Portfolio demo, local Voice and static/local motion | `npm run dev:demo` | Demo data |
| Private care, including the optional avatar worker | `npm run dev:all` | Private care |
| Private care without the avatar worker | `npm run dev` | Private care |

There is no in-app environment switch. Refresh an existing browser tab after
switching servers so its confirmed runtime and care data reload together.
The demo launcher does not start the optional avatar worker.

## Gmail isolation

Demo mode continues to use the exact existing sender, recipient, subject,
filename, MIME type, and content-hash allowlist. Its source is retained for
replay and its database remains separate.

Private care excludes the known demo source using the project-specific
subject marker, exact fixture filename, or PDF fingerprint. The fingerprint
also catches a byte-identical renamed copy with a changed subject. Intake
checks again before database lookup or Storage writes, and processing refuses
previously saved demo identities in private care. The Inbox reports that demo
documents were excluded.

This is a guard for this known scenario, not a general classifier for every
possible synthetic document. Ordinary veterinary attachments with words such
as `sample` or `demo` remain eligible when they do not match the known source.

## September 13 setup checkpoint

Branch: `setup-inbox-isolation`, based on `main` at `41061a3`.
The existing remote `final-voice-animation-ui-polish` branch was at that same
commit and was not modified. Merge this setup checkpoint before updating the
polish branch from main.

Read-only inspection found one copy of the synthetic invoice in private care,
still `ingested`, with no raw text or extracted candidate. It had zero linked
events, facts, cost items, or labs. No database or Storage cleanup was performed.

If cleanup is approved later, revalidate that exact document's fingerprint,
private pet ownership, status, and zero dependent rows immediately before
removing its exact document row and exact saved Storage object. Inspect any
other references first; do not sweep a bucket or filename prefix, reset private
care, or delete the Gmail source or the demo-project copy. No cleanup command
is introduced in this checkpoint.

Validation: 13 focused setup/isolation tests passed; 79 affected regression
tests passed with `TOMOCARE_RUNTIME_MODE=real` for the legacy lifecycle test;
changed JavaScript passed ESLint; the production build passed. The existing
large-chunk advisory remains. Both configurations passed the live read-only
setup check. Demo mode was started and its global label verified in the browser.
