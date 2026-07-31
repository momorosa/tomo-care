const CONTEXTUAL_INTENTS = new Set([
    "active_reminders",
    "appointment_status",
    "care_timeline_summary",
    "count_events",
    "home_medication_due",
    "home_medication_status",
    "last_librela",
    "last_weight",
    "next_librela_due",
    "next_librela_reminder",
    "recent_verified_records",
    "spend_summary",
    "vaccine_record_lookup",
    "weight_change",
    "weight_trend",
])

const CONTEXTUAL_SUBJECTS = new Set([
    "adequan",
    "appointment",
    "care_timeline",
    "documents",
    "librela",
    "rabies_vaccine",
    "reminders",
    "simparica_trio",
    "vaccine",
    "weight",
])

export function sanitizeConversationContext(value) {
    if (!value || typeof value !== "object") return null

    const intent =
        typeof value.intent === "string" ? value.intent.trim() : ""
    const subject =
        typeof value.subject === "string" ? value.subject.trim() : ""

    if (!CONTEXTUAL_INTENTS.has(intent)) return null
    if (subject && !CONTEXTUAL_SUBJECTS.has(subject)) return null

    return {
        intent,
        subject: subject || null,
    }
}

export function getNextConversationContext({
    queryPlan,
    previousContext,
}) {
    const current = sanitizeConversationContext({
        intent: queryPlan?.intent,
        subject: queryPlan?.subject,
    })

    return current || sanitizeConversationContext(previousContext)
}
