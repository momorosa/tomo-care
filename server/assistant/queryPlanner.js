import { resolveDateRange } from "./dateRanges.js"

export function buildQueryPlan(question) {
    const q = question.toLowerCase()
    const dateRange = resolveDateRange(question)

    if (isActionRequest(q)) {
        return basePlan({
            intent: "action_request",
            requires_action: true,
            dateRange,
        })
    }

    if (isLibrelaSpendQuestion(q)) {
        return basePlan({
            intent: "spend_summary",
            subject: "librela",
            scope: isLibrelaVisitTotalQuestion(q)
                ? "librela_visit_total"
                : "direct_librela_line_items",
            dateRange,
        })
    }

    if (isLibrelaShotCountQuestion(q)) {
        return basePlan({
            intent: "count_events",
            subject: "librela",
            scope: "verified_injections",
            dateRange,
        })
    }

    if (
        q.includes("last") &&
        (q.includes("librela") || q.includes("shot") || q.includes("injection"))
    ) {
        return basePlan({
            intent: "last_librela",
            subject: "librela",
            scope: "verified_injections",
            dateRange,
        })
    }

    if (isAppointmentStatusQuestion(q)) {
        return basePlan({
            intent: "appointment_status",
            subject: q.includes("librela") || q.includes("shot") || q.includes("injection")
                ? "librela"
                : "appointment",
            scope: "scheduled_appointments",
            dateRange,
        })
    }

    if (isNextLibrelaDueQuestion(q)) {
        return basePlan({
            intent: "next_librela_due",
            subject: "librela",
            scope: "care_schedule",
            dateRange,
        })
    }

    if (isNextLibrelaReminderQuestion(q)) {
        return basePlan({
            intent: "next_librela_reminder",
            subject: "librela",
            scope: "planned_reminders",
            dateRange,
        })
    }

    if (q.includes("reminder") || q.includes("active")) {
        return basePlan({
            intent: "active_reminders",
            subject: "reminders",
            scope: "planned_reminders",
            dateRange,
        })
    }

    if (
        q.includes("verified") ||
        q.includes("recent records") ||
        q.includes("recently")
    ) {
        return basePlan({
            intent: "recent_verified_records",
            subject: "documents",
            scope: "verified_documents",
            dateRange,
        })
    }

    return basePlan({
        intent: "unknown",
        subject: null,
        scope: null,
        dateRange,
    })
}

function basePlan({
    intent,
    subject = null,
    scope = null,
    dateRange,
    requires_action = false,
}) {
    return {
        intent,
        subject,
        scope,
        date_range: dateRange,
        trusted_only: true,
        requires_action,
    }
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

    if (directActionWords.some((word) => q.startsWith(word))) {
        return true
    }

    return /(can you|could you|would you|please).*(schedule|create|book|send|text|email|call|add)/.test(q)
}

function isLibrelaSpendQuestion(q) {
    return (
        q.includes("librela") &&
        (
            q.includes("how much") ||
            q.includes("spent") ||
            q.includes("spend") ||
            q.includes("cost") ||
            q.includes("paid") ||
            q.includes("total")
        )
    )
}

function isLibrelaVisitTotalQuestion(q) {
    return (
        q.includes("visit") ||
        q.includes("appointment") ||
        q.includes("whole visit") ||
        q.includes("full visit") ||
        q.includes("total visit") ||
        q.includes("entire visit")
    )
}

function isLibrelaShotCountQuestion(q) {
    return (
        (q.includes("how many") || q.includes("count") || q.includes("number of")) &&
        (q.includes("librela") || q.includes("shot") || q.includes("injection"))
    )
}

function isNextLibrelaDueQuestion(q) {
    const mentionsLibrela =
        q.includes("librela") ||
        q.includes("shot") ||
        q.includes("injection")

    const asksDueDate =
        q.includes("due") ||
        (
            q.includes("when") &&
            q.includes("next") &&
            (q.includes("shot") || q.includes("injection"))
        )

    return mentionsLibrela && asksDueDate && !q.includes("reminder")
}

function isNextLibrelaReminderQuestion(q) {
    return (
        q.includes("reminder") &&
        (q.includes("librela") || q.includes("shot") || q.includes("injection")) &&
        (q.includes("next") || q.includes("due") || q.includes("planned") || q.includes("when"))
    )
}

function isAppointmentStatusQuestion(q) {
    const mentionsAppointment =
        q.includes("appointment") ||
        q.includes("appt") ||
        q.includes("scheduled") ||
        q.includes("booked")

    const asksStatus =
        q.includes("have we") ||
        q.includes("do we") ||
        q.includes("is there") ||
        q.includes("made") ||
        q.includes("make") ||
        q.includes("booked") ||
        q.includes("scheduled")

    return mentionsAppointment && asksStatus
}