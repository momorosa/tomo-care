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

    if (
        (q.includes("next") || q.includes("due")) &&
        (q.includes("librela") || q.includes("reminder") || q.includes("shot"))
    ) {
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