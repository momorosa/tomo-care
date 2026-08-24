const CONTEXTUAL_INTENTS = new Set([
    "active_reminders",
    "attention_summary",
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
    "attention",
    "care_timeline",
    "documents",
    "librela",
    "rabies_vaccine",
    "reminders",
    "simparica_trio",
    "vaccine",
    "weight",
])

const ACTION_CLARIFICATION_INTENT =
    "home_medication_given_action"
const ACTION_PENDING_DETAILS = new Set([
    "medication_and_date",
    "administration_date",
])

export function sanitizeConversationContext(value) {
    if (!value || typeof value !== "object") return null

    const intent =
        typeof value.intent === "string" ? value.intent.trim() : ""
    const subject =
        typeof value.subject === "string" ? value.subject.trim() : ""
    const pendingDetail =
        typeof value.pending_detail === "string"
            ? value.pending_detail.trim()
            : ""

    if (intent === ACTION_CLARIFICATION_INTENT) {
        if (subject && !CONTEXTUAL_SUBJECTS.has(subject)) return null
        if (!ACTION_PENDING_DETAILS.has(pendingDetail)) return null

        return {
            intent,
            subject: subject || null,
            pending_detail: pendingDetail,
        }
    }

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
    if (queryPlan?.intent === ACTION_CLARIFICATION_INTENT) {
        const issue = queryPlan?.action?.issue

        if (!issue || issue === "uncertain_statement") return null

        return sanitizeConversationContext({
            intent: ACTION_CLARIFICATION_INTENT,
            subject: queryPlan?.subject,
            pending_detail:
                issue === "missing_date" ||
                issue === "ambiguous_date"
                    ? "administration_date"
                    : "medication_and_date",
        })
    }

    const current = sanitizeConversationContext({
        intent: queryPlan?.intent,
        subject: queryPlan?.subject,
    })

    return current || sanitizeConversationContext(previousContext)
}
