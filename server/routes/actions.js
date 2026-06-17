import express from "express"
import { sbAdmin } from "../supabase.js"
import {
    verifyGoogleCalendarConnection,
    getGoogleCalendarConfig,
    getGoogleCalendarService,
} from "../googleCalendar.js"

const router = express.Router()

// ---------------------------------------------------------------------------
// Config / rules
// ---------------------------------------------------------------------------

const LIBRELA_SUBTYPE = "Librela"
const DUE_INTERVAL_DAYS = 49
const REMIND_BEFORE_DAYS = 7
const RULE_VERSION = "librela_v1"

const INSURANCE_CLAIM_SUBTYPE = "Insurance claim"
const INSURANCE_TARGET_SUBMIT_DAYS = 30
const INSURANCE_ELIGIBILITY_WINDOW_DAYS = 180
const INSURANCE_RULE_VERSION = "insurance_claim_v1"

const CALENDAR_SYNC_ALLOWED_TIMING_STATES = new Set(["upcoming", "due_now"])

const DOCUMENT_COLUMNS =
    "id, pet_id, title, doc_type, doc_date, source_org, status"

const REMINDER_RETURN_COLUMNS =
    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        throw new Error(`Invalid date: ${value}`)
    }

    const [year, month, day] = value.split("-").map(Number)
    return new Date(Date.UTC(year, month - 1, day))
}

function formatIsoDate(date) {
    return date.toISOString().slice(0, 10)
}

function addDays(dateString, days) {
    const date = parseIsoDate(dateString)
    date.setUTCDate(date.getUTCDate() + days)
    return formatIsoDate(date)
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000)
}

function getReminderTimingState({ reminderDate, dueDate }) {
    const today = formatIsoDate(new Date())

    if (dueDate < today) return "overdue"
    if (reminderDate < today) return "reminder_window_passed"
    return "upcoming"
}

function resolveReminderTimingState(event) {
    const details = event?.details_json || {}

    if (details.timing_state) {
        return details.timing_state
    }

    if (!event?.event_date || !details.due_date) {
        return "unknown"
    }

    return getReminderTimingState({
        reminderDate: event.event_date,
        dueDate: details.due_date,
    })
}

function looksLikeLibrelaEvent(event) {
    const details = event?.details_json || {}

    const haystack = [
        event?.event_type,
        details.subtype,
        details.target_subtype,
        details.description,
        details.title,
        details.medication,
        details.drug,
        details.name,
        JSON.stringify(details),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

// ---------------------------------------------------------------------------
// Google Calendar payload builders
// ---------------------------------------------------------------------------

function buildCalendarTitle(event) {
    const details = event?.details_json || {}
    const subtype = details.subtype || "Reminder"

    if (subtype === INSURANCE_CLAIM_SUBTYPE) {
        return "Momo — file insurance claim"
    }

    if (subtype === LIBRELA_SUBTYPE) {
        return "Momo — Librela due soon"
    }

    return `Momo — ${subtype}`
}

function buildCalendarDescription(event) {
    const details = event?.details_json || {}

    const lines = [
        "TomoCare reminder",
        `Reminder type: ${details.subtype || "Reminder"}`,
        `Reminder date: ${event.event_date}`,
    ]

    if (details.message) {
        lines.push("")
        lines.push(details.message)
    }

    if (details.treatment_date) {
        lines.push(`Treatment date: ${details.treatment_date}`)
    }

    if (details.target_submit_date) {
        lines.push(`Preferred submit-by date: ${details.target_submit_date}`)
    }

    if (details.claim_deadline_date) {
        lines.push(`Final claim deadline: ${details.claim_deadline_date}`)
    }

    if (details.due_date && !details.claim_deadline_date) {
        lines.push(`Due date: ${details.due_date}`)
    }

    if (details.anchor_event_date) {
        lines.push(`Last completed event: ${details.anchor_event_date}`)
    }

    if (details.rule_version) {
        lines.push(`Rule: ${details.rule_version}`)
    }

    if (details.source_document_title) {
        lines.push("")
        lines.push(`Source: ${details.source_document_title}`)
    }

    lines.push("")
    lines.push(`TomoCare event_id: ${event.id}`)

    return lines.filter(Boolean).join("\n")
}

function buildCalendarTimeWindow(event, timezone) {
    const details = event?.details_json || {}
    const externalRefs = details.external_refs || {}

    // For due_now reminders, create a useful near-future calendar event
    // instead of creating a stale event earlier today. If already synced once,
    // preserve the existing Calendar time window on update.
    if (details.timing_state === "due_now") {
        if (
            externalRefs.google_calendar_start_date_time &&
            externalRefs.google_calendar_end_date_time
        ) {
            return {
                start: {
                    dateTime: externalRefs.google_calendar_start_date_time,
                },
                end: {
                    dateTime: externalRefs.google_calendar_end_date_time,
                },
            }
        }

        const start = addMinutes(new Date(), 15)
        const end = addMinutes(start, 30)

        return {
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
        }
    }

    return {
        start: {
            dateTime: `${event.event_date}T09:00:00`,
            timeZone: timezone,
        },
        end: {
            dateTime: `${event.event_date}T09:30:00`,
            timeZone: timezone,
        },
    }
}

function buildGoogleCalendarPayload(event, timezone) {
    const timeWindow = buildCalendarTimeWindow(event, timezone)

    return {
        summary: buildCalendarTitle(event),
        description: buildCalendarDescription(event),
        ...timeWindow,
        reminders: {
            useDefault: false,
            overrides: [
                { method: "popup", minutes: 60 },
                { method: "popup", minutes: 15 },
            ],
        },
    }
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

// Loads a document and asserts it is verified. Returns either { doc } or
// { error: { status, body } } so callers can respond without branching twice.
async function loadVerifiedDocument(docId, notVerifiedMessage) {
    const { data: doc, error } = await sbAdmin
        .from("documents")
        .select(DOCUMENT_COLUMNS)
        .eq("id", docId)
        .single()

    if (error || !doc) {
        return {
            error: {
                status: 404,
                body: {
                    ok: false,
                    error: error?.message || "Document not found",
                },
            },
        }
    }

    if (doc.status !== "verified") {
        return {
            error: {
                status: 409,
                body: { ok: false, error: notVerifiedMessage },
            },
        }
    }

    return { doc }
}

// Inserts a new planned reminder, or updates the existing one if passed.
// Returns the row plus whether it was "created" or "updated".
async function upsertPlannedReminder({ existing, payload }) {
    const query = existing
        ? sbAdmin.from("events").update(payload).eq("id", existing.id)
        : sbAdmin.from("events").insert(payload)

    const { data, error } = await query.select(REMINDER_RETURN_COLUMNS).single()

    if (error) throw error

    return {
        row: data,
        action: existing ? "updated" : "created",
    }
}

async function findVerifiedLibrelaInjectionForDoc({ docId, petId }) {
    const { data, error } = await sbAdmin
        .from("events")
        .select(
            "id, pet_id, doc_id, event_type, event_date, status, details_json"
        )
        .eq("doc_id", docId)
        .eq("pet_id", petId)
        .eq("event_type", "injection")
        .eq("status", "verified")
        .order("event_date", { ascending: false })

    if (error) throw error

    const rows = data || []
    return rows.find(looksLikeLibrelaEvent) || null
}

async function findExistingPlannedLibrelaReminder({ petId }) {
    const { data, error } = await sbAdmin
        .from("events")
        .select("id, pet_id, event_date, status, details_json")
        .eq("pet_id", petId)
        .eq("event_type", "reminder")
        .eq("status", "planned")
        .eq("details_json->>subtype", LIBRELA_SUBTYPE)
        .limit(1)

    if (error) throw error

    return data?.[0] || null
}

async function findExistingPlannedInsuranceClaimReminder({ docId, petId }) {
    const { data, error } = await sbAdmin
        .from("events")
        .select("id, pet_id, doc_id, event_date, status, details_json")
        .eq("doc_id", docId)
        .eq("pet_id", petId)
        .eq("event_type", "reminder")
        .eq("status", "planned")
        .eq("details_json->>subtype", INSURANCE_CLAIM_SUBTYPE)
        .limit(1)

    if (error) throw error

    return data?.[0] || null
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/documents/:docId/actions/librela-reminder
router.post("/documents/:docId/actions/librela-reminder", async (req, res) => {
    const { docId } = req.params
    const { requestedBy = "rosa" } = req.body || {}

    try {
        const { doc, error: docError } = await loadVerifiedDocument(
            docId,
            "Document must be verified before TomoCare can create reminders from it."
        )

        if (docError) {
            return res.status(docError.status).json(docError.body)
        }

        const injection = await findVerifiedLibrelaInjectionForDoc({
            docId,
            petId: doc.pet_id,
        })

        if (!injection) {
            return res.status(400).json({
                ok: false,
                error:
                    "No verified Librela injection event was found for this document.",
            })
        }

        const anchorDate = injection.event_date
        const dueDate = addDays(anchorDate, DUE_INTERVAL_DAYS)
        const reminderDate = addDays(dueDate, -REMIND_BEFORE_DAYS)
        const timingState = getReminderTimingState({ reminderDate, dueDate })
        const nowIso = new Date().toISOString()

        const payload = {
            pet_id: doc.pet_id,
            doc_id: doc.id,
            event_type: "reminder",
            event_date: reminderDate,
            status: "planned",
            details_json: {
                subtype: LIBRELA_SUBTYPE,
                action_type: "create_librela_reminder",
                target_event_type: "injection",
                target_subtype: LIBRELA_SUBTYPE,

                rule_version: RULE_VERSION,
                due_interval_days: DUE_INTERVAL_DAYS,
                remind_before_days: REMIND_BEFORE_DAYS,

                anchor_event_id: injection.id,
                anchor_event_date: anchorDate,
                due_date: dueDate,
                timing_state: timingState,

                source_document_id: doc.id,
                source_document_title: doc.title,
                source_org: doc.source_org,

                requested_by: requestedBy,
                requested_at: nowIso,
                created_from: "post_verify_action",
                calendar_sync_status: "not_synced",
            },
        }

        const existing = await findExistingPlannedLibrelaReminder({
            petId: doc.pet_id,
        })

        const { row: reminderRow, action } = await upsertPlannedReminder({
            existing,
            payload,
        })

        res.json({
            ok: true,
            action,
            message:
                action === "created"
                    ? "Librela reminder prepared."
                    : "Existing Librela reminder updated.",
            reminder: {
                id: reminderRow.id,
                event_date: reminderRow.event_date,
                status: reminderRow.status,
                due_date: reminderRow.details_json?.due_date,
                timing_state: reminderRow.details_json?.timing_state,
                anchor_event_date: reminderRow.details_json?.anchor_event_date,
                rule_version: reminderRow.details_json?.rule_version,
                calendar_sync_status:
                    reminderRow.details_json?.calendar_sync_status ||
                    "not_synced",
            },
            source: {
                document_id: doc.id,
                title: doc.title,
                injection_event_id: injection.id,
            },
        })
    } catch (err) {
        console.error("[librela-reminder] error:", err)

        res.status(500).json({
            ok: false,
            error: err?.message || "Failed to create Librela reminder.",
        })
    }
})

// POST /api/documents/:docId/actions/insurance-claim-reminder
router.post(
    "/documents/:docId/actions/insurance-claim-reminder",
    async (req, res) => {
        const { docId } = req.params
        const { requestedBy = "rosa", insuranceProvider = "Nationwide" } =
            req.body || {}

        try {
            const { doc, error: docError } = await loadVerifiedDocument(
                docId,
                "Document must be verified before TomoCare can create insurance claim reminders from it."
            )

            if (docError) {
                return res.status(docError.status).json(docError.body)
            }

            const treatmentDate = doc.doc_date

            if (!treatmentDate) {
                return res.status(400).json({
                    ok: false,
                    error:
                        "No treatment date was found for this verified document.",
                })
            }

            const targetSubmitDate = addDays(
                treatmentDate,
                INSURANCE_TARGET_SUBMIT_DAYS
            )
            const claimDeadlineDate = addDays(
                treatmentDate,
                INSURANCE_ELIGIBILITY_WINDOW_DAYS
            )
            const today = formatIsoDate(new Date())

            if (claimDeadlineDate < today) {
                return res.status(409).json({
                    ok: false,
                    reason: "claim_window_expired",
                    error:
                        "This treatment date is outside the 180-day insurance claim eligibility window.",
                    treatment_date: treatmentDate,
                    claim_deadline_date: claimDeadlineDate,
                })
            }

            const targetHasArrived = targetSubmitDate <= today
            const reminderDate = targetHasArrived ? today : targetSubmitDate
            const timingState = targetHasArrived ? "due_now" : "upcoming"
            const nowIso = new Date().toISOString()

            const message = targetHasArrived
                ? "It has been at least 30 days since the treatment date. Fill out your insurance claim now and get reimbursed."
                : "Submit this insurance claim within 30 days of the treatment date if possible."

            const payload = {
                pet_id: doc.pet_id,
                doc_id: doc.id,
                event_type: "reminder",
                event_date: reminderDate,
                status: "planned",
                details_json: {
                    subtype: INSURANCE_CLAIM_SUBTYPE,
                    action_type: "create_insurance_claim_reminder",

                    rule_version: INSURANCE_RULE_VERSION,
                    insurance_provider: insuranceProvider,

                    treatment_date: treatmentDate,
                    target_submit_date: targetSubmitDate,
                    claim_deadline_date: claimDeadlineDate,
                    due_date: claimDeadlineDate,

                    target_submit_days: INSURANCE_TARGET_SUBMIT_DAYS,
                    eligibility_window_days: INSURANCE_ELIGIBILITY_WINDOW_DAYS,

                    timing_state: timingState,
                    message,

                    source_document_id: doc.id,
                    source_document_title: doc.title,
                    source_org: doc.source_org,

                    requested_by: requestedBy,
                    requested_at: nowIso,
                    created_from: "post_verify_action",
                    calendar_sync_status: "not_synced",
                },
            }

            const existing = await findExistingPlannedInsuranceClaimReminder({
                docId: doc.id,
                petId: doc.pet_id,
            })

            const { row: reminderRow, action } = await upsertPlannedReminder({
                existing,
                payload,
            })

            res.json({
                ok: true,
                action,
                message:
                    action === "created"
                        ? "Insurance claim reminder prepared."
                        : "Existing insurance claim reminder updated.",
                reminder: {
                    id: reminderRow.id,
                    event_date: reminderRow.event_date,
                    status: reminderRow.status,
                    treatment_date: reminderRow.details_json?.treatment_date,
                    target_submit_date:
                        reminderRow.details_json?.target_submit_date,
                    claim_deadline_date:
                        reminderRow.details_json?.claim_deadline_date,
                    timing_state: reminderRow.details_json?.timing_state,
                    calendar_sync_status:
                        reminderRow.details_json?.calendar_sync_status ||
                        "not_synced",
                    message: reminderRow.details_json?.message,
                },
                source: {
                    document_id: doc.id,
                    title: doc.title,
                },
            })
        } catch (err) {
            console.error("[insurance-claim-reminder] error:", err)

            res.status(500).json({
                ok: false,
                error:
                    err?.message || "Failed to create insurance claim reminder.",
            })
        }
    }
)

// POST /api/events/:eventId/actions/sync-google-calendar
router.post(
    "/events/:eventId/actions/sync-google-calendar",
    async (req, res) => {
        const { eventId } = req.params

        try {
            const { data: event, error } = await sbAdmin
                .from("events")
                .select(
                    "id, pet_id, doc_id, event_type, event_date, status, details_json"
                )
                .eq("id", eventId)
                .single()

            if (error || !event) {
                return res.status(404).json({
                    ok: false,
                    error: error?.message || "Reminder event not found.",
                })
            }

            if (event.event_type !== "reminder") {
                return res.status(409).json({
                    ok: false,
                    reason: "not_a_reminder",
                    error:
                        "Only reminder events can be synced to Google Calendar.",
                })
            }

            if (event.status !== "planned") {
                return res.status(409).json({
                    ok: false,
                    reason: "not_planned",
                    error:
                        "Only planned reminders can be synced to Google Calendar.",
                    status: event.status,
                })
            }

            let details = event.details_json || {}
            const calendarSyncStatus =
                details.calendar_sync_status || "not_synced"
            const timingState = resolveReminderTimingState(event)

            // Backfill timing_state on the row if it was never persisted.
            if (!details.timing_state && timingState !== "unknown") {
                details = { ...details, timing_state: timingState }

                const { error: updateTimingErr } = await sbAdmin
                    .from("events")
                    .update({ details_json: details })
                    .eq("id", event.id)

                if (updateTimingErr) throw updateTimingErr

                event.details_json = details
            }

            if (!["not_synced", "synced"].includes(calendarSyncStatus)) {
                return res.status(409).json({
                    ok: false,
                    reason: "sync_status_not_allowed",
                    error:
                        "This reminder is not currently eligible for Google Calendar sync.",
                    calendar_sync_status: calendarSyncStatus,
                })
            }

            if (!CALENDAR_SYNC_ALLOWED_TIMING_STATES.has(timingState)) {
                return res.status(409).json({
                    ok: false,
                    reason: "timing_state_not_upcoming",
                    error:
                        timingState === "overdue"
                            ? "This reminder is overdue and will not be synced to Google Calendar."
                            : "This reminder is not eligible for Google Calendar sync.",
                    timing_state: timingState,
                    reminder: {
                        id: event.id,
                        event_date: event.event_date,
                        due_date: details.due_date || null,
                        subtype: details.subtype || null,
                        calendar_sync_status: calendarSyncStatus,
                    },
                })
            }

            const externalRefs = details.external_refs || {}
            const existingGoogleCalendarEventId =
                externalRefs.google_calendar_event_id || null

            if (calendarSyncStatus === "synced" && !existingGoogleCalendarEventId) {
                return res.status(409).json({
                    ok: false,
                    reason: "synced_missing_external_ref",
                    error:
                        "This reminder is marked as synced but does not have a Google Calendar event ID.",
                })
            }

            const calendar = getGoogleCalendarService()
            const { calendarId, timezone } = getGoogleCalendarConfig()
            const calendarPayload = buildGoogleCalendarPayload(event, timezone)

            let action = "created"
            let calendarEvent = null

            if (existingGoogleCalendarEventId) {
                const updated = await calendar.events.update({
                    calendarId,
                    eventId: existingGoogleCalendarEventId,
                    requestBody: calendarPayload,
                })

                action = "updated"
                calendarEvent = updated.data
            } else {
                const created = await calendar.events.insert({
                    calendarId,
                    requestBody: calendarPayload,
                })

                action = "created"
                calendarEvent = created.data
            }

            const nowIso = new Date().toISOString()

            const nextDetails = {
                ...details,
                timing_state: timingState,
                calendar_sync_status: "synced",
                external_refs: {
                    ...externalRefs,
                    google_calendar_calendar_id: calendarId,
                    google_calendar_event_id: calendarEvent.id,
                    google_calendar_html_link: calendarEvent.htmlLink,
                    google_calendar_last_synced_at: nowIso,
                    google_calendar_start_date_time:
                        calendarPayload.start?.dateTime || null,
                    google_calendar_end_date_time:
                        calendarPayload.end?.dateTime || null,
                },
            }

            const { data: updatedEvent, error: updateErr } = await sbAdmin
                .from("events")
                .update({ details_json: nextDetails })
                .eq("id", event.id)
                .select(
                    "id, event_type, event_date, status, details_json, updated_at"
                )
                .single()

            if (updateErr) throw updateErr

            res.json({
                ok: true,
                action,
                message:
                    action === "created"
                        ? "Reminder synced to Google Calendar."
                        : "Google Calendar reminder updated.",
                reminder: {
                    id: updatedEvent.id,
                    event_date: updatedEvent.event_date,
                    status: updatedEvent.status,
                    subtype: updatedEvent.details_json?.subtype || null,
                    timing_state:
                        updatedEvent.details_json?.timing_state || null,
                    calendar_sync_status:
                        updatedEvent.details_json?.calendar_sync_status || null,
                },
                google_calendar: {
                    calendar_id: calendarId,
                    event_id: calendarEvent.id,
                    html_link: calendarEvent.htmlLink || null,
                },
            })
        } catch (err) {
            console.error("[sync-google-calendar] error:", err)

            res.status(500).json({
                ok: false,
                error:
                    err?.message ||
                    "Failed to sync reminder to Google Calendar.",
                code: err?.code || null,
            })
        }
    }
)

// GET /api/debug/google-calendar
router.get("/debug/google-calendar", async (req, res) => {
    try {
        const result = await verifyGoogleCalendarConnection()
        res.json(result)
    } catch (err) {
        console.error("[google-calendar-health] error:", err)

        res.status(500).json({
            ok: false,
            error: err?.message || "Failed to connect to Google Calendar.",
            code: err?.code || null,
        })
    }
})

export default router