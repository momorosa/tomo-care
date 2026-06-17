import express from "express"
import { sbAdmin } from "../supabase.js"

const router = express.Router()

const LIBRELA_SUBTYPE = "Librela"
const DUE_INTERVAL_DAYS = 49
const REMIND_BEFORE_DAYS = 7
const RULE_VERSION = "librela_v1"

const INSURANCE_CLAIM_SUBTYPE = "Insurance claim"
const INSURANCE_TARGET_SUBMIT_DAYS = 30
const INSURANCE_ELIGIBILITY_WINDOW_DAYS = 180
const INSURANCE_RULE_VERSION = "insurance_claim_v1"

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

async function findVerifiedLibrelaInjectionForDoc({ docId, petId }) {
    const { data, error } = await sbAdmin
        .from("events")
        .select("id, pet_id, doc_id, event_type, event_date, status, details_json")
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

// POST /api/documents/:docId/actions/librela-reminder
router.post("/documents/:docId/actions/librela-reminder", async (req, res) => {
    const { docId } = req.params
    const { requestedBy = "rosa" } = req.body || {}

    try {
        const { data: doc, error: docErr } = await sbAdmin
            .from("documents")
            .select("id, pet_id, title, doc_type, doc_date, source_org, status")
            .eq("id", docId)
            .single()

        if (docErr || !doc) {
            return res.status(404).json({
                ok: false,
                error: docErr?.message || "Document not found",
            })
        }

        if (doc.status !== "verified") {
            return res.status(409).json({
                ok: false,
                error: "Document must be verified before TomoCare can create reminders from it.",
            })
        }

        const injection = await findVerifiedLibrelaInjectionForDoc({
            docId,
            petId: doc.pet_id,
        })

        if (!injection) {
            return res.status(400).json({
                ok: false,
                error: "No verified Librela injection event was found for this document.",
            })
        }

        const anchorDate = injection.event_date
        const dueDate = addDays(anchorDate, DUE_INTERVAL_DAYS)
        const reminderDate = addDays(dueDate, -REMIND_BEFORE_DAYS)
        const timingState = getReminderTimingState({
            reminderDate,
            dueDate,
        })
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

        let action = "created"
        let reminderRow = null

        if (existing) {
            action = "updated"

            const { data, error } = await sbAdmin
                .from("events")
                .update(payload)
                .eq("id", existing.id)
                .select(
                    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"
                )
                .single()

            if (error) throw error
            reminderRow = data
        } else {
            const { data, error } = await sbAdmin
                .from("events")
                .insert(payload)
                .select(
                    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"
                )
                .single()

            if (error) throw error
            reminderRow = data
        }

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
                    reminderRow.details_json?.calendar_sync_status || "not_synced",
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
router.post("/documents/:docId/actions/insurance-claim-reminder", async (req, res) => {
    const { docId } = req.params
    const { requestedBy = "rosa", insuranceProvider = "Nationwide" } = req.body || {}

    try {
        const { data: doc, error: docErr } = await sbAdmin
            .from("documents")
            .select("id, pet_id, title, doc_type, doc_date, source_org, status")
            .eq("id", docId)
            .single()

        if (docErr || !doc) {
            return res.status(404).json({
                ok: false,
                error: docErr?.message || "Document not found",
            })
        }

        if (doc.status !== "verified") {
            return res.status(409).json({
                ok: false,
                error: "Document must be verified before TomoCare can create insurance claim reminders from it.",
            })
        }

        const treatmentDate = doc.doc_date

        if (!treatmentDate) {
            return res.status(400).json({
                ok: false,
                error: "No treatment date was found for this verified document.",
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
                error: "This treatment date is outside the 180-day insurance claim eligibility window.",
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

        let action = "created"
        let reminderRow = null

        if (existing) {
            action = "updated"

            const { data, error } = await sbAdmin
                .from("events")
                .update(payload)
                .eq("id", existing.id)
                .select(
                    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"
                )
                .single()

            if (error) throw error
            reminderRow = data
        } else {
            const { data, error } = await sbAdmin
                .from("events")
                .insert(payload)
                .select(
                    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"
                )
                .single()

            if (error) throw error
            reminderRow = data
        }

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
                target_submit_date: reminderRow.details_json?.target_submit_date,
                claim_deadline_date:
                    reminderRow.details_json?.claim_deadline_date,
                timing_state: reminderRow.details_json?.timing_state,
                calendar_sync_status:
                    reminderRow.details_json?.calendar_sync_status || "not_synced",
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
                err?.message ||
                "Failed to create insurance claim reminder.",
        })
    }
})

// POST /api/events/:eventId/actions/sync-google-calendar
router.post("/events/:eventId/actions/sync-google-calendar", async (req, res) => {
    const { eventId } = req.params

    try {
        const { data: event, error } = await sbAdmin
            .from("events")
            .select("id, pet_id, doc_id, event_type, event_date, status, details_json")
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
                error: "Only reminder events can be synced to Google Calendar.",
            })
        }

        if (event.status !== "planned") {
            return res.status(409).json({
                ok: false,
                reason: "not_planned",
                error: "Only planned reminders can be synced to Google Calendar.",
                status: event.status,
            })
        }

        let details = event.details_json || {}
        const calendarSyncStatus = details.calendar_sync_status || "not_synced"
        const timingState = resolveReminderTimingState(event)

        if (!details.timing_state && timingState !== "unknown") {
            details = {
                ...details,
                timing_state: timingState,
            }

            const { error: updateTimingErr } = await sbAdmin
                .from("events")
                .update({ details_json: details })
                .eq("id", event.id)

            if (updateTimingErr) throw updateTimingErr

            event.details_json = details
        }

        if (calendarSyncStatus === "synced") {
            return res.status(409).json({
                ok: false,
                reason: "already_synced",
                error: "This reminder has already been synced to Google Calendar.",
                calendar_sync_status: calendarSyncStatus,
                external_refs: details.external_refs || null,
            })
        }

        if (calendarSyncStatus !== "not_synced") {
            return res.status(409).json({
                ok: false,
                reason: "sync_status_not_allowed",
                error: "This reminder is not currently eligible for Google Calendar sync.",
                calendar_sync_status: calendarSyncStatus,
            })
        }

        if (timingState !== "upcoming") {
            return res.status(409).json({
                ok: false,
                reason: "timing_state_not_upcoming",
                error:
                    timingState === "overdue"
                        ? "This reminder is overdue and will not be synced to Google Calendar."
                        : "This reminder is not upcoming and will not be synced to Google Calendar.",
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

        // OAuth / Google Calendar creation will be added in the next slice.
        return res.status(501).json({
            ok: false,
            reason: "google_calendar_not_wired",
            error: "Google Calendar sync passed safety checks, but Calendar API wiring is not implemented yet.",
            reminder: {
                id: event.id,
                event_date: event.event_date,
                due_date: details.due_date || null,
                subtype: details.subtype || null,
                timing_state: timingState,
                calendar_sync_status: calendarSyncStatus,
            },
        })
    } catch (err) {
        console.error("[sync-google-calendar] error:", err)

        res.status(500).json({
            ok: false,
            error: err?.message || "Failed to sync reminder to Google Calendar.",
        })
    }
})

export default router