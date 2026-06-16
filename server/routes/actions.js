import express from "express"
import { sbAdmin } from "../supabase.js"

const router = express.Router()

const LIBRELA_SUBTYPE = "Librela"
const DUE_INTERVAL_DAYS = 49
const REMIND_BEFORE_DAYS = 7
const RULE_VERSION = "librela_v1"

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

export default router