# TomoCare

> A governed AI system that turns scattered pet-care documents into trusted, actionable records without taking the human out of the loop.

TomoCare is a personal AI build for one real user: my dog, Momo.

It ingests vet receipts, lab reports, and visit notes; extracts the facts that matter; and only after human verification promotes them into structured records the system can reason over and act on. Today, that includes verified timelines, cost records, Librela reminders, and calendar sync. The larger goal is to explore how agentic systems can handle high-stakes document workflows with provenance, approval gates, and durable memory.

**Status:** Work in progress. Phase 0 and Phase 1 are shipped. Phase 2 is in active development.

![TomoCare system diagram](./assets/tomoCare-system-diagram.png)

## Core idea: three tiers of truth

TomoCare does not treat AI output as fact. Data moves through three deliberate trust layers:

| Tier                | What it is                                               | Trust level      |
| ------------------- | -------------------------------------------------------- | ---------------- |
| **Source truth**    | Original PDFs stored in private Supabase Storage         | Immutable source |
| **Candidate truth** | AI-extracted JSON stored for inspection and debugging    | Unverified       |
| **Trusted truth**   | Materialized database rows used for logic and automation | Human-approved   |

The system is built around three guardrails:

* Every trusted record links back to its source document.
* Candidate truth cannot trigger external actions on its own.
* Any action that leaves the system, such as messaging or booking, requires explicit approval.

These patterns are designed to transfer beyond pet care into other high-stakes document workflows where provenance, review, and controlled automation matter.

## What works today

### Phase 0 — Working Brain

Shipped the underlying ingestion and memory layer:

* Private PDF storage in Supabase
* Document records with stable storage keys
* Raw text extraction as an auditable intermediate
* AI extraction into structured JSON candidate truth
* Materialization into trusted event and cost records
* Deterministic Librela reminder logic
* Google Calendar sync with persisted external references to prevent duplicates

### Phase 1 — Verification UI

Shipped a human-in-the-loop review workflow:

* Review queue for documents awaiting verification
* Side-by-side source PDF and extracted data
* AI triage that flags fields as auto-confirmed, needs review, or unreadable
* Editable candidate truth before approval
* Save draft and save-and-verify flows
* Approval-gated materialization into trusted records

## In progress

### Phase 2 — TomoCare as a Product

Currently building the product layer:

* Dashboard view for upcoming care, documents, and reminders
* Gmail ingestion through a dedicated TomoCare inbox
* Automatic receipt/lab intake into the existing verification pipeline
* Notification card for documents needing review
* First approval-gated agentic action: draft an appointment request, send only after approval, parse the response, and write the result back to the calendar

## Planned

### Phase 3 — Grounded Assistant

A bounded conversational layer that answers only from trusted records:

* “When is Momo’s next Librela shot?”
* “What was her last weight?”
* “How much have I spent on Librela this year?”
* “Which lab values were abnormal in the latest panel?”

The assistant will cite source documents and route any action request back through the approval gate.

## What TomoCare is not

* Not a diagnostic tool or a replacement for a veterinarian.
* Not an autonomous black-box agent.
* Not a polished consumer app.
* Not a system where AI output silently becomes operational truth.

Correctness, provenance, and governance come before polish.

## Stack

* **Frontend:** React
* **Backend:** Node, Express
* **Agent / tools:** Python, Google ADK, Gemini
* **Database / storage:** Supabase Postgres, Supabase Storage
* **AI review:** Anthropic API
* **Calendar automation:** Google Calendar API
* **In progress:** Gmail API ingestion
* **Planned:** Twilio messaging, MCP-exposed tools

## Design principles

* **Provenance first:** Every derived fact should trace back to a source document.
* **Deterministic before agentic:** Known workflows use explicit rules before model inference.
* **Human approval gates:** The system can assist, but the human decides what becomes trusted.
* **Idempotent automation:** External actions should update existing records instead of creating duplicates.
* **Trust before polish:** The product should be inspectable and correct before it becomes polished.

## Repo note

This project uses real pet-care data in development, so private PDFs, API keys, OAuth tokens, and environment files are not included in the repository.

## Voice troubleshooting

TomoCare records from the microphone selected by the browser and operating
system. On a Mac, an iPhone may take over as the input through Continuity
Camera. If Tomo does not hear the Mac microphone:

1. In macOS, open **System Settings → Sound → Input** and select the Mac
   microphone.
2. Reload the TomoCare browser tab and allow microphone access.
3. If the iPhone still takes over, temporarily turn off **Settings → General →
   AirPlay & Continuity → Continuity Camera** on the iPhone.

Voice recording stops automatically after Tomo detects speech followed by a
short pause. The Stop button remains available as a manual fallback.
