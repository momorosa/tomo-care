# TomoCare

> A governed AI system that turns scattered pet-care documents into trusted, actionable records without taking the human out of the loop.

TomoCare is a personal AI build for one real user: my dog, Momo.

It ingests vet receipts, lab reports, and visit notes; extracts the facts that matter; and only after human verification promotes them into structured records the system can reason over and act on. Today, that includes verified timelines, cost records, reminders, grounded answers, approval-gated actions, voice interaction, and an optional animated Tomo. The larger goal is to explore how governed AI systems can handle high-stakes document workflows with provenance, approval gates, and durable memory.

**Status:** Work in progress. Phases 0–2 and 3A–3D are shipped. The Phase 3C messaging foundation is complete in mock mode; live Twilio delivery remains pending provider approval. The next product focus is assistant coverage and governed skills.

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
* Server-side provider boundary ready for live Twilio delivery after A2P approval

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

## Next product work

* Expand assistant coverage, freshness rules, and citations across everything visible in Profile, Reminders, Inbox, Recently verified, and pending approvals.
* Add governed skills that can guide the user into the relevant product or external tool, starting with opening the correct Google Calendar reminder or Calendar view.
* Return to meaning-based character reactions for `happy`, `laughing`, and `oops` after the core coverage and skill contract is stable.
* Complete live outbound Twilio delivery after A2P approval without adding inbound reply interpretation to the same slice.

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
* **Approved messaging:** Twilio mock provider; live delivery pending A2P approval
* **Live character:** Runway animated avatar through LiveKit

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
Chat layout. The stage stays visually quiet, while the full scrollable transcript
opens from the floating control dock with citations and reminder evidence intact.
When that panel opens, Tomo and the dock recenter within the remaining stage so
the avatar stays conversationally present instead of being covered. Listening,
thinking, speaking, playback, and mute controls remain in the dock.

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
stored as a fixed number in the interface.

Assistant coverage is intentionally narrower than the visible product surface
today. The next coverage slice will define supported questions, freshness,
citations, and privacy rules for Profile, Reminders, Inbox, Recently verified,
and pending approvals before Tomo claims knowledge of every item shown in the
app. A later governed-skill slice will let Tomo guide the user into the relevant
product or external tool without treating navigation as authorization for a
care-state change.
