const HOME_MEDICATION_REMINDER_TYPE = "home_medication"

export function isHomeMedicationReminder(event) {
    return (
        event?.event_type === "reminder" &&
        event?.details_json?.reminder_type === HOME_MEDICATION_REMINDER_TYPE
    )
}

export function buildHomeMedicationCalendarDescription(event) {
    if (!isHomeMedicationReminder(event)) {
        throw new Error("A home-medication reminder is required.")
    }

    const details = event.details_json
    const careItem = details.care_item || "Home medication"

    const lines = [
        `${careItem} reminder for Momo`,
        `Reminder date: ${event.event_date}`,
    ]

    if (details.target_admin_date) {
        lines.push(`Target date: ${details.target_admin_date}`)
    }

    if (
        details.due_date &&
        details.due_date !== details.target_admin_date
    ) {
        lines.push(`Cadence due date: ${details.due_date}`)
    }

    if (details.preferred_admin_day) {
        lines.push(`Preferred day: ${details.preferred_admin_day}`)
    }

    if (details.route) {
        lines.push(`How to give: ${details.route}`)
    }

    if (details.requires_appointment === false) {
        lines.push("No appointment needed.")
    }

    if (details.last_administered_date || details.anchor_event_date) {
        lines.push("")
        lines.push(
            `Based on the last confirmed dose on ${
                details.last_administered_date ||
                details.anchor_event_date
            }.`
        )
    }

    lines.push("")
    lines.push("Created by TomoCare.")

    return lines.join("\n")
}

export function getStableGoogleCalendarEventId(tomoCareEventId) {
    const stableId = String(tomoCareEventId || "")
        .replaceAll("-", "")
        .toLowerCase()

    if (!/^[0-9a-v]{5,1024}$/.test(stableId)) {
        throw new Error(
            "The TomoCare event ID cannot be used as a Google Calendar event ID."
        )
    }

    return stableId
}