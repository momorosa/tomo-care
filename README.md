# TomoCare

> A governed AI system that turns scattered pet-care documents into trusted, actionable records without taking the human out of the loop.

TomoCare is a personal AI build for one real user: my dog, Momo.

It ingests vet receipts, lab reports, and visit notes; extracts the facts that matter; and only after human verification promotes them into structured records the system can reason over and act on. Today, that includes verified timelines, cost records, reminders, grounded answers, approval-gated actions, voice interaction, and an optional animated Tomo. The larger goal is to explore how governed AI systems can handle high-stakes document workflows with provenance, approval gates, and durable memory.

**Status:** Work in progress. Phases 0–2 and 3A–3D are shipped. Phase 3E is in progress through 3E.9, including lifecycle hardening for Librela, Simparica, and Adequan; governed attention and navigation; governed Profile grounding and microchip retrieval; risk-weighted Verification Intelligence; the governed Tomo manager with Verification Intelligence and Care Operations specialists; the verified Rabies evidence foundation; and a source-linked verified weight-trend visualization shared across Chat and Voice. Phase 3F's native Apple Messages handoff and the bounded Animate Tomo reliability-and-recovery slice are also shipped. The next bounded slice is the Demo Environment and Resettable Synthetic Dataset.

Project direction and current-state details live in the [TomoCare Operating Brief](./docs/TomoCare_Operating_Brief.md), [Product Roadmap and Portfolio Checkpoint](./docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md), [Multi-Agent Orchestration Decision and Build Plan](./docs/TomoCare_Multi_Agent_Orchestration_Decision_and_Build_Plan.md), and [Animate Tomo reliability closeout and demo-environment handover](./docs/AnimateTomo_Reliability_Closeout_and_Demo_Environment_Handover.md).

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

### Phase 2 — Care Desk

Shipped the usable product loop around the verified data foundation:

* Gmail intake through a dedicated TomoCare inbox
* Dashboard views for care, documents, reminders, and review work
* Automatic receipt and lab intake into the verification pipeline
* Post-verification recommendations and persistent reminders
* Approval-gated Google Calendar sync with duplicate and stale-state guards

### Phase 3A — Grounded Assistant

Shipped a bounded assistant that answers from trusted records:

* Grounded answers with citations and source evidence
* Schedule, spend, weight, home-medication, and care-timeline coverage
* Clear no-data, appointment-state, medical, and action boundaries
* Regression evals for the assistant's core promises

### Phase 3B — Governed Actions

Shipped reusable approval-gated state changes:

* Durable proposed, approved, executing, succeeded, failed, and cancelled states
* Medication and insurance actions from the dashboard or assistant
* Atomic care updates, fresh-evidence checks, retry safety, and recovery
* Google Calendar follow-through as a separate user-initiated action

### Phase 3C — Approved Messaging Foundation

Shipped the governed workflow and orchestration boundary for clinic messaging:

* Exact-message review and approval contract
* Persistent workflow state and recovery
* Mock delivery for safe end-to-end testing
* Server-side provider boundary and Twilio self-test as architectural proof
* Explicit separation between approval, handoff, delivery, and reply interpretation

### Phase 3D — Conversational Tomo

Shipped the voice-first, conversation-centered experience:

* Natural-language routing inside the supported capability map
* Bounded relationship context and personality around unchanged grounded answers
* One session transcript across Voice and Chat
* Microphone capture, transcription, concise speech, and recoverable local playback
* Conversation-centered home with accessible care and evidence panels
* Optional Runway + LiveKit lip-sync that remains a visual layer over TomoCare's existing assistant
* Pose-matched local motion clips with one-shot playback and final-frame holds
* Numeric-only latency instrumentation and static/local-audio fallback

### Phase 3E — Lifecycle Integrity and Governed Skills

Shipped the first lifecycle and assistant-coverage slices:

* Post-verification eligibility hardening plus production Gmail and Calendar authorization recovery
* Librela reconciliation, Calendar recovery, verified weight materialization, and golden lifecycle idempotency
* Golden Librela-to-Messages path from trusted records through grounded answer, approved draft, verified recipient, and native handoff intent
* Shared Simparica and Adequan home-medication lifecycle with explicit confirmation, atomic trusted writes, reminder completion, exactly one cadence-based successor, Calendar sync, grounded answers, and retry safety
* Governed attention summaries across qualifying reminders, pending or recoverable actions, and documents awaiting review
* Deterministic today, tomorrow, this-week, and this-month attention windows with natural Chat and Voice responses
* Typed navigation to the governing reminder, action, review document, or allowlisted Google Calendar destination without granting write authority
* Governed Profile answers from the current `pets` record, deterministic age calculation, honest missing-data behavior, warm relationship context, and typed read-only Profile navigation
* Risk-weighted Verification Intelligence that combines current-source comparison, deterministic checks, and up to five comparable trusted records
* Consolidated date and invoice checks, established-pattern grouping, meaningful change detection, stale-assessment protection, and explicit unsupported-content disclosure
* Backend enforcement that only the current reviewed candidate can be promoted, with fail-safe manual review and no vaccine or preventive-care materialization
* Collapsed historical labeling for verified documents reviewed under older triage rules and consistent two-decimal currency presentation
* Tomo as the explicit manager over a versioned, allowlisted specialist registry with schema validation, permission enforcement, bounded evidence, typed failures, and durable recovery
* Verification Intelligence invoked through a governed handoff without weakening current-candidate fingerprints, manual review, or human-controlled promotion to trusted truth
* Care Operations reconciliation over trusted Simparica and Adequan state, with answer-only, clarification, ineligible, recovered, and one-proposal outcomes while approval and execution remain deterministic
* Product-visible orchestration traces across VerifyDocs, Chat, and Voice that show manager, specialist, bounded evidence, result, safe reuse, and the human-control boundary without exposing prompts or hidden reasoning
* End-to-end Gmail ingestion and governed review for a strict Rabies pilot, with certificate-backed administration, clinic-reported next due, clinic-reported status, and product expiration kept as separate meanings
* Server-only, source-linked materialization of verified Rabies administration and preventive status, grounded Agent Tomo answers, and direct access to the verified certificate
* Receipt and review recovery that names failed intake stages, preserves readable candidate truth, supports correction and bounded AI recheck, and never promotes data automatically
* A typed verified weight-trend contract that uses the complete requested trusted history for deterministic narrative, chart, summary, and concise Voice speech while the visible evidence drawer remains capped at ten recent sources
* A responsive accessible weight chart with source-linked points, explicit selected-state meaning, lb-first or kg display choice, truthful one-reading and tied-value states, and no medical interpretation
* Governed read-only microchip retrieval from the allowlisted `pets` row across Profile, Chat, and Voice, with direct-only disclosure and honest missing or unavailable states
* A clearer Profile drawer that separates Profile details from care overview, keeps long identifiers readable, and preserves existing navigation and care content
* A default-open, user-collapsible Voice transcript so charts, evidence, links, and limits remain visible during spoken conversations
* Typed non-sensitive Animate Tomo startup, disconnect, session-expiry, and playback recovery states with intentional ending kept distinct from failure
* One user-initiated animation retry after complete cleanup, with no automatic reconnect, answer replay, resynthesis, duplicate audio, or loss of local Voice

The accepted architecture is a small manager-style hybrid multi-agent system:

* **Tomo manager:** owns conversation, specialist selection, synthesis, approval guidance, and recovery language
* **Verification Intelligence Agent:** shipped in Phase 3E.5 as a bounded document-review specialist that returns a structured summary, differences, and review exceptions
* **Care Operations Agent:** reconciles trusted events, reminders, and actions, then prepares the next governed step
* **Deterministic services:** continue to own calculations, validation, fingerprints, materialization, idempotency, and provider execution

Specialists do not directly promote candidate truth or execute consequential actions. Rosa retains the existing verification and action approvals. Phase 3E.6 shipped the manager, specialist handoffs, permissions, recovery, and product-visible traces while deterministic services retained trusted materialization and consequential execution.

### Phase 3F — Native Apple Messages Handoff

Shipped a truthful single-user clinic-message handoff:

* Tomo prepares the exact message from trusted state
* The server verifies the recipient and exposes only masked recipient details
* Rosa reviews and explicitly approves the message
* Native Apple Messages opens an editable draft; Rosa makes the final send decision
* Copy fallback and idempotent recovery remain available
* TomoCare records handoff intent without claiming sent, delivered, received, or booked

## Next product work

TomoCare now follows one product roadmap with two release tracks:

* The **real-care track** continues toward a comprehensive long-term health sidekick for Momo.
* The **portfolio track** creates a reliable, visually polished checkpoint of the same governed product using separate, resettable synthetic demo data.

Animate Tomo reliability and recovery is complete. The remaining near-term sequence is:

1. Create a separate demo environment and deterministic synthetic Momo dataset without forking the application code.
2. Finalize clearly labeled synthetic veterinary documents and pass them through a demo-safe Gmail intake.
3. Polish Voice, animation, and the complete end-to-end UI before freezing the portfolio v1 checkpoint.
4. Return to additional vaccines, annual wellness, annual-lab lifecycle state, preventive screening, and preventive actions as bounded Real-Care work after the portfolio checkpoint or when Rosa explicitly reprioritizes it.

Medication refill or renewal, additional preventive-care lifecycle expansion, lab-result interpretation, longitudinal analyte comparison, urinalysis or imaging intelligence, broad medical-document intelligence, and generic feedback controls remain post-portfolio work unless a later bounded contract promotes them. The shipped Rabies foundation is reusable Real-Care infrastructure, not a claim of general vaccine, wellness, or laboratory coverage. See the [Product Roadmap and Portfolio Checkpoint](./docs/TomoCare_Product_Roadmap_and_Portfolio_Checkpoint.md) for the complete decision and definition of done.

## What TomoCare is not

* Not a diagnostic tool or a replacement for a veterinarian.
* Not an autonomous black-box agent.
* Not a polished consumer app.
* Not a system where AI output silently becomes operational truth.

Correctness, provenance, and governance come before polish.

## Stack

* **Frontend:** React, Vite
* **Backend:** Node, Express
* **Ingestion utilities:** Python
* **Database / storage:** Supabase Postgres, Supabase Storage
* **AI review:** Anthropic API
* **Assistant and voice:** OpenAI API
* **Connected tools:** Gmail API, Google Calendar API
* **Approved messaging:** Native Apple Messages draft handoff; Rosa remains the sender
* **Live character:** Runway animated avatar through LiveKit

## Design principles

* **Provenance first:** Every derived fact should trace back to a source document.
* **Deterministic before agentic:** Known workflows use explicit rules before model inference.
* **Agents for bounded ambiguity:** Add a specialist only when context, reasoning, permissions, failure modes, and evals are genuinely distinct.
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

## Gmail authorization recovery

If **Check inbox** reports that Tomo's inbox key stopped working, Google's
saved Gmail authorization is no longer valid. Generate a new refresh token:

```bash
node server/scripts/get-gmail-refresh-token.js
```

Open the printed authorization URL, complete consent, replace
`GMAIL_REFRESH_TOKEN` in the local `.env`, and restart TomoCare. Keep the token
out of source control and chat.

For an external OAuth app left in Google's **Testing** publishing state, this
may recur every seven days. Moving the OAuth consent screen to **In production**
prevents that specific test-token expiration.

## Semantic understanding

TomoCare routes explicit supported questions and all governed actions through
the existing deterministic planner first. A schema-constrained OpenAI request
may map otherwise unknown phrasing to one supported read-only intent and may
also return bounded, fact-free personality language. The request uses `store:
false` and includes no trusted records, composed answers, citations, or action
payloads.

Semantic interpretation uses the existing server-only `OPENAI_API_KEY`.
The default model is `gpt-5.6-terra`; it can be changed locally with:

```text
TOMO_SEMANTIC_MODEL=gpt-5.6-terra
```

Conversation context is intentionally limited to the previous supported care
intent and subject. It is held in the browser session only and is not written
to the database.

## Personality and relationship context

TomoCare keeps a small, versioned relationship profile separate from verified
care records. It contains only intentional stable details about Rosa, Momo, and
Tomo's communication style. It is not medical evidence and cannot create or
change trusted care history.

For an ordinary grounded question, the model may add one short, fact-free
opening or closing around the deterministically composed answer. The grounded
answer remains an unchanged contiguous part of the final response. Medical
judgment, pain, health uncertainty, clarification, message drafts, and governed
actions always use restrained mode. Personality never changes facts, citations,
limitations, or action status.

For harmless conversation—greetings, thanks, praise, corrections, frustration,
and goodbyes—the model may write a fresh response of no more than two short
sentences. Server validation rejects language containing numbers, amounts,
care-record claims, medical conclusions, or claims that an action occurred.
Small deterministic response pools remain available only when OpenAI is
unavailable, the interpretation does not match the locally recognized intent,
or generated language fails validation. Social replies never load care records.

Tomo's capability description and Momo's profile remain deterministically
assembled because they make factual claims about the product and relationship
profile.

Tomo can also describe Momo from the bounded relationship profile without
confusing her with Tomo or treating family details as medical evidence. Weight
trend answers lead with a factual pattern and key comparisons instead of
reciting every data point. Named-month calendar questions filter the primary
reminder list to that month; an earlier still-active reminder may be called out
separately so it is not misrepresented as part of the requested month.

## Conversational home

The Phase 3D home makes Tomo and the current conversation the primary product
surface. A collapsible care navigation and contextual drawer keep Momo's
profile, reminders, inbox, and recently verified documents available without
turning the experience back into a dashboard grid. Closing either sidebar area
reallocates its width to the Voice/Chat canvas.

Voice is the default mode. Voice and Chat share one session-only transcript, so
switching modes does not restart the conversation. Refreshing the page or using
Clear starts a new session; clearing also resets the bounded previous-topic
anchor. Verified records, citations, reminder actions, and approval dialogs
continue to use the existing governed backend.

Voice uses an immersive, avatar-first stage rather than the information-dense
Chat layout. The full scrollable transcript opens by default so charts,
citations, links, limits, and reminder evidence remain available during spoken
conversation; Rosa can collapse and reopen it from the floating control dock.
Clearing the session clears its content without unexpectedly collapsing the
panel. When the transcript is open, Tomo and the dock recenter within the
remaining stage so the avatar stays conversationally present instead of being
covered. Listening, thinking, speaking, playback, and mute controls remain in
the dock.

Local one-shot motion clips cover idle, acknowledgment, listening, and thinking.
Each completed clip holds its final frame instead of looping. If the user selects
**Animate Tomo**, a Runway character stream replaces the local media only for
lip-synced playback. Runway remains a visual layer over the existing answer and
speech pipeline. The static image and local audio remain available for loading,
provider failure, and reduced-motion behavior.

Chat starts directly at the session boundary and uses a multiline composer.
Enter sends; Shift+Enter adds a new line. Tomo's visible identity uses the
TomoCare logo in both the voice presence and transcript. Reminder citations
resolve against the same loaded reminder records as the contextual drawer, so
timing status, display date, and Google Calendar links remain consistent across
both surfaces.

Compact reminder cards preserve complete category eyebrows, medication names,
and care-specific icons for quick scanning. Calendar sits in a dedicated footer
below a divider and remains the final card row when details expand. It opens the
specific Google Calendar event when TomoCare has its URL, or Google Calendar
itself when no event link is stored. Calendar sync remains a separate explicit
action. User-facing record and reminder dates use `MM-DD-YYYY`; database values,
API payloads, and editable schema fields remain ISO `YYYY-MM-DD` so care logic
and validation do not change.

Momo's profile reads safe identity fields from the `pets` table. Displayed age
is calculated from `birth_date` at runtime and changes on her birthday; it is not
stored as a fixed number in the interface. Phase 3E.9 adds the existing
`microchip_id` through the same explicit read-only allowlist and displays it in
a Profile-details group separate from the care overview. Tomo answers a direct
microchip question from that governed value but does not volunteer the
identifier in broad Profile answers or speech.

Phase 3E.3 now answers “What needs my attention?” from governed reminder,
care-action, and document-review state. It ranks no more than five supported
items, explains each item in plain language, discloses unavailable sources, and
uses typed navigation to the governing TomoCare or Google Calendar destination.
The same contract supports natural paraphrases and bounded today, tomorrow,
this-week, and this-month follow-ups across Chat and Voice. Candidate document
contents remain untrusted, and navigation grants no authority to change care
state.

Phase 3E.4 grounds Profile questions in the current `pets` row, calculates age
from `birth_date`, discloses missing fields, and opens the existing Profile
panel. The versioned relationship profile may add warmth and harmless personal
context, but it cannot replace or override governed identity fields. Broad
wellbeing questions remain distinct from identity questions and receive a
question-aware clarification when current health cannot be established from the
bounded record.

Assistant coverage is still narrower than the visible product surface. Stored
Inbox state and deeper Recently verified follow-up remain later bounded slices.
