import express from "express"
import { sbAdmin } from "../supabase.js"

const router = express.Router()

router.post("/pets/:petId/assistant/query", async (req, res) => {
    const { petId } = req.params
    const { question } = req.body || {}

    if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question is required." })
    }

    try {
        const intent = classifyIntent(question)
        const context = await buildTrustedContext(petId)

        const response = composeGroundedAnswer({
            question,
            intent,
            context,
        })

        res.json(response)
    } catch (err) {
        console.error("[assistant] query failed:", err)
        res.status(500).json({
            error: err?.message || "Assistant query failed.",
        })
    }
})

function classifyIntent(question) {
    const q = question.toLowerCase()

    if (isActionRequest(q)) {
        return "action_request"
    }

    if (
        q.includes("last") &&
        (q.includes("librela") || q.includes("shot") || q.includes("injection"))
    ) {
        return "last_librela"
    }

    if (
        (q.includes("next") || q.includes("due")) &&
        (q.includes("librela") || q.includes("reminder") || q.includes("shot"))
    ) {
        return "next_librela_reminder"
    }

    if (q.includes("reminder") || q.includes("active")) {
        return "active_reminders"
    }

    if (
        (q.includes("how much") || q.includes("spent") || q.includes("cost")) &&
        q.includes("librela")
    ) {
        return "librela_spend"
    }

    if (
        q.includes("verified") ||
        q.includes("recent records") ||
        q.includes("recently")
    ) {
        return "recent_verified_records"
    }

    return "unknown"
}

function isActionRequest(q) {
    const directActionWords = [
        "send",
        "text",
        "sms",
        "email",
        "book",
        "call",
        "create",
        "add to calendar",
        "make appointment",
    ]

    if (directActionWords.some((word) => q.includes(word))) {
        return true
    }

    return /(can you|could you|would you|please).*(schedule|create|book|send|text|email|call|add)/.test(q)
}

async function buildTrustedContext(petId) {
    const [eventsResult, costItemsResult, docsResult] = await Promise.all([
        sbAdmin
            .from("events")
            .select("id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at")
            .eq("pet_id", petId)
            .in("status", ["verified", "planned"])
            .order("event_date", { ascending: false }),

        sbAdmin
            .from("cost_items")
            .select("id, pet_id, doc_id, service_date, category, item_name, amount, currency, status, verified_at, verified_by")
            .eq("pet_id", petId)
            .eq("status", "verified")
            .order("service_date", { ascending: false }),

        sbAdmin
            .from("documents")
            .select("id, title, doc_type, doc_date, source_org, status, file_url, updated_at")
            .eq("pet_id", petId)
            .eq("status", "verified")
            .order("doc_date", { ascending: false })
            .limit(10),
    ])

    if (eventsResult.error) throw new Error(eventsResult.error.message)
    if (costItemsResult.error) throw new Error(costItemsResult.error.message)
    if (docsResult.error) throw new Error(docsResult.error.message)

    const events = eventsResult.data || []
    const costItems = costItemsResult.data || []
    const documents = docsResult.data || []

    const verifiedEvents = events.filter((e) => e.status === "verified")
    const plannedReminders = events.filter(
        (e) => e.status === "planned" && e.event_type === "reminder"
    )

    const librelaEvents = verifiedEvents.filter(isLibrelaRelated)
    const librelaCostItems = costItems.filter(isLibrelaRelated)

    return {
        petId,
        verifiedEvents,
        plannedReminders,
        librelaEvents,
        librelaCostItems,
        documents,
    }
}

function composeGroundedAnswer({ question, intent, context }) {
    switch (intent) {
        case "last_librela":
            return answerLastLibrela(context)

        case "next_librela_reminder":
            return answerNextLibrelaReminder(context)

        case "active_reminders":
            return answerActiveReminders(context)

        case "librela_spend":
            return answerLibrelaSpend(context)

        case "recent_verified_records":
            return answerRecentVerifiedRecords(context)

        case "action_request":
            return {
                answer:
                    "I can help prepare that, but I cannot take action directly from chat. Any booking, message, calendar write, or external action needs to go through TomoCare’s approval gate first.",
                answer_type: "action_request",
                confidence: "high",
                citations: [],
                limitations: [
                    "Phase 3A is read-only.",
                    "External actions must route through the Phase 2 approval flow.",
                ],
                proposed_action: {
                    status: "requires_approval_gate",
                    reason:
                        "The user asked for an action. TomoCare can prepare actions later, but execution requires explicit approval.",
                },
            }

        default:
            return {
                answer:
                    "I don’t have enough trusted information to answer that yet. I can only answer from verified TomoCare records, and this question is not supported in the first read-only assistant slice.",
                answer_type: "unsupported_question",
                confidence: "low",
                citations: [],
                limitations: [
                    "No unsupported inference was made.",
                    "The assistant is currently limited to verified records, reminders, Librela history, spend, and recently verified documents.",
                ],
                proposed_action: null,
            }
    }
}

function answerLastLibrela(context) {
    const injections = context.verifiedEvents
        .filter((event) => event.event_type === "injection")
        .filter(isLibrelaRelated)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))

    const latest = injections[0]

    if (!latest) {
        return noTrustedDataAnswer(
            "I don’t have a verified Librela injection record yet, so I can’t answer that from trusted data."
        )
    }

    return {
        answer: `Momo’s last verified Librela injection was on ${formatDate(latest.event_date)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: [eventCitation(latest, "Verified Librela injection")],
        limitations: [],
        proposed_action: null,
    }
}

function answerNextLibrelaReminder(context) {
    const reminders = context.plannedReminders
        .filter(isLibrelaRelated)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    const today = getTodayDateString()
    const upcomingReminder = reminders.find((reminder) => reminder.event_date >= today)
    const next = upcomingReminder || reminders[0]

    if (!next) {
        return noTrustedDataAnswer(
            "I don’t see an active planned Librela reminder in trusted records yet."
        )
    }

    const isPast = next.event_date < today

    return {
        answer: isPast
            ? `Momo has a planned Librela reminder from ${formatDate(next.event_date)}. That date has already passed, so it may need attention.`
            : `Momo’s next Librela reminder is planned for ${formatDate(next.event_date)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: [eventCitation(next, "Planned Librela reminder")],
        limitations: isPast
            ? ["This reminder is still stored as planned, but its reminder date has already passed."]
            : [],
        proposed_action: null,
    }
}

function answerActiveReminders(context) {
    const reminders = [...context.plannedReminders].sort(
        (a, b) => new Date(a.event_date) - new Date(b.event_date)
    )

    if (!reminders.length) {
        return noTrustedDataAnswer("I don’t see any active planned reminders right now.")
    }

    const reminderText = reminders
        .slice(0, 5)
        .map((r) => {
            const label = getReminderLabel(r)
            return `${label} on ${formatDate(r.event_date)}`
        })
        .join("; ")

    return {
        answer: `I found ${reminders.length} active planned reminder${reminders.length === 1 ? "" : "s"}: ${reminderText}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: reminders
            .slice(0, 5)
            .map((r) => eventCitation(r, "Planned reminder")),
        limitations:
            reminders.length > 5
                ? ["Only the first five reminders are shown in this answer."]
                : [],
        proposed_action: null,
    }
}

function answerLibrelaSpend(context) {
    const items = context.librelaCostItems

    if (!items.length) {
        return noTrustedDataAnswer(
            "I don’t have verified Librela cost items yet, so I can’t calculate Librela spend from trusted data."
        )
    }

    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const currency = items[0]?.currency || "USD"

    return {
        answer: `Momo’s direct Librela line-item spend is ${formatMoney(total, currency)} across ${items.length} verified line item${items.length === 1 ? "" : "s"}. This includes Librela medication, injection line items, and discounts. It does not include general nurse or tech visit fees unless the line item itself names Librela.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: items.map((item) =>
            costItemCitation(item, "Verified Librela cost item")
        ),
        limitations: [
            "This is a direct Librela line-item total, not a full visit total.",
            "General nurse, tech, or office visit fees are excluded unless the line item itself clearly references Librela.",
        ],
        proposed_action: null,
    }
}

function answerRecentVerifiedRecords(context) {
    const docs = context.documents || []

    if (!docs.length) {
        return noTrustedDataAnswer("I don’t see any verified documents yet.")
    }

    const text = docs
        .slice(0, 5)
        .map((d) => {
            const title = d.title || "Verified document"
            return `${title}${d.doc_date ? ` (${formatDate(d.doc_date)})` : ""}`
        })
        .join("; ")

    return {
        answer: `The most recent verified records are: ${text}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: docs
            .slice(0, 5)
            .map((d) => documentCitation(d, "Verified document")),
        limitations:
            docs.length > 5
                ? ["Only the five most recent verified documents are shown."]
                : [],
        proposed_action: null,
    }
}

function noTrustedDataAnswer(answer) {
    return {
        answer,
        answer_type: "no_trusted_data",
        confidence: "low",
        citations: [],
        limitations: ["No answer was generated without trusted records."],
        proposed_action: null,
    }
}

function isLibrelaRelated(row) {
    const details = row.details_json || {}

    const haystack = [
        row.event_type,
        row.category,
        row.item_name,

        details.medication,
        details.medication_name,
        details.drug,
        details.drug_name,
        details.product,
        details.product_name,
        details.subtype,
        details.title,
        details.label,
        details.description,
        details.reason,
        details.procedure,
        details.treatment,
        details.visit_type,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

function getReminderLabel(reminder) {
    const details = reminder.details_json || {}

    return (
        details.title ||
        details.label ||
        details.subtype ||
        details.description ||
        details.reason ||
        details.medication ||
        details.treatment ||
        "Reminder"
    )
}

function eventCitation(event, label) {
    return {
        type: "trusted_event",
        table: "events",
        id: event.id,
        doc_id: event.doc_id,
        label,
        date: event.event_date,
    }
}

function costItemCitation(item, label) {
    return {
        type: "trusted_cost_item",
        table: "cost_items",
        id: item.id,
        doc_id: item.doc_id,
        label,
        date: item.service_date,
    }
}

function documentCitation(doc, label) {
    return {
        type: "source_document",
        table: "documents",
        id: doc.id,
        doc_id: doc.id,
        label,
        date: doc.doc_date,
        title: doc.title,
        source_org: doc.source_org,
    }
}

function formatDate(value) {
    if (!value) return "an unknown date"

    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date)
}

function formatMoney(value, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(value)
}

function getTodayDateString() {
    return new Date().toISOString().slice(0, 10)
}

export default router