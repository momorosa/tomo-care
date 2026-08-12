export function getLibrelaActionIntent({ recommendationState, phase }) {
    if (recommendationState !== "repair_required") {
        return "create_and_sync"
    }

    return phase === "repair_ready" ? "apply_repair" : "preview_repair"
}

export function buildLibrelaRepairPreviewMessage(preview, formatDate) {
    if (!preview) return "Review the repair plan before applying it."

    const anchorDate = formatDate(preview.anchor_date)
    const reminderDate = formatDate(preview.reminder_date)
    const dueDate = formatDate(preview.due_date)
    const eventAction =
        preview.canonical_event_action === "create"
            ? `add the missing verified Librela injection on ${anchorDate}`
            : `preserve the verified Librela injection on ${anchorDate}`
    const priorCount = Number(preview.prior_reminders_to_complete || 0)
    const priorAction =
        priorCount === 1
            ? "complete 1 earlier Librela reminder"
            : `complete ${priorCount} earlier Librela reminders`
    const nextAction =
        preview.next_reminder_action === "create" ? "create" : "preserve"

    return `TomoCare will ${eventAction}, ${priorAction}, and ${nextAction} the next reminder for ${reminderDate} (due ${dueDate}). Appointments and non-Librela reminders will stay unchanged.`
}
