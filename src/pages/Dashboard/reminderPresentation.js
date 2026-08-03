import {
    formatDisplayDate,
    formatIsoDatesInText,
} from "../../lib/displayDate.js"

export const GOOGLE_CALENDAR_HOME_URL =
    "https://calendar.google.com/calendar/u/0/r"

export function getCompactReminderPresentation(
    reminder,
    { lastLibrelaDate = null } = {}
) {
    const details = reminder.details_json || {}
    const kind = getReminderKind(reminder)
    const title = getReminderTitle(reminder, kind)
    const primaryDate = getPrimaryDate(reminder, kind)

    return {
        kind,
        title,
        eyebrow: getEyebrow(kind),
        icon: getIcon(kind),
        dateLabel: primaryDate
            ? `Due ${formatDisplayDate(primaryDate)}`
            : "Date not set",
        statusLabel: getStatusLabel(reminder.timing_state),
        badgeClass: getStatusClass(reminder.timing_state),
        calendarUrl:
            reminder.google_calendar_url || GOOGLE_CALENDAR_HOME_URL,
        calendarIsSpecificEvent: Boolean(reminder.google_calendar_url),
        details: getReminderDetails({
            reminder,
            details,
            kind,
            lastLibrelaDate,
        }),
        note: getReminderNote(details, kind),
    }
}

function getReminderKind(reminder) {
    const details = reminder.details_json || {}
    const haystack = [
        details.care_item,
        details.care_category,
        details.reminder_type,
        details.medication,
        details.medication_name,
        details.subtype,
        reminder.title,
        reminder.body,
        reminder.eyebrow,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    if (haystack.includes("simparica")) return "simparica"
    if (haystack.includes("adequan")) return "adequan"
    if (haystack.includes("librela")) return "librela"
    if (
        haystack.includes("insurance") ||
        haystack.includes("claim") ||
        haystack.includes("receipt")
    ) {
        return "insurance"
    }

    return "generic"
}

function getReminderTitle(reminder, kind) {
    const details = reminder.details_json || {}

    if (kind === "librela") {
        return details.care_item || details.medication || "Librela"
    }

    if (kind === "insurance") {
        return details.care_item || reminder.title || "Insurance claim"
    }

    return (
        details.care_item ||
        details.medication ||
        details.subtype ||
        reminder.title ||
        "Care reminder"
    )
}

function getPrimaryDate(reminder, kind) {
    const details = reminder.details_json || {}

    if (kind === "librela") return details.due_date || reminder.event_date
    if (kind === "insurance") {
        return details.target_submit_date || reminder.event_date
    }

    return details.target_admin_date || details.due_date || reminder.event_date
}

function getEyebrow(kind) {
    return {
        simparica: "At-home medication",
        adequan: "At-home injection",
        librela: "Clinic care",
        insurance: "Insurance",
        generic: "Reminder",
    }[kind]
}

function getIcon(kind) {
    return {
        simparica: "pill",
        adequan: "syringe",
        librela: "medical_services",
        insurance: "receipt_long",
        generic: "notifications",
    }[kind]
}

function getStatusLabel(timingState) {
    if (timingState === "overdue") return "Overdue"
    if (timingState === "due_now") return "Due"
    return "Upcoming"
}

function getStatusClass(timingState) {
    if (timingState === "overdue") return "tomo-badge--danger"
    if (timingState === "due_now") return "tomo-badge--warning"
    return "tomo-badge--neutral"
}

function getReminderDetails({ reminder, details, kind, lastLibrelaDate }) {
    if (kind === "librela") {
        return compactRows([
            [
                "Last shot",
                details.last_verified_injection_date || lastLibrelaDate,
            ],
            ["Expected due", details.due_date],
        ])
    }

    if (kind === "simparica" || kind === "adequan") {
        return compactRows([
            ["Last given", details.last_administered_date],
            ["Target administration", details.target_admin_date],
            details.due_date !== details.target_admin_date
                ? ["Cadence due", details.due_date]
                : null,
        ])
    }

    if (kind === "insurance") {
        return compactRows([
            ["Treatment", details.treatment_date],
            ["Target filing", details.target_submit_date],
            ["Claim deadline", details.claim_deadline_date],
        ])
    }

    return reminder.body
        ? [{ label: null, value: formatIsoDatesInText(reminder.body) }]
        : []
}

function compactRows(rows) {
    return rows
        .filter((row) => row?.[1])
        .map(([label, value]) => ({
            label,
            value: formatDisplayDate(value),
        }))
}

function getReminderNote(details, kind) {
    const parts = []

    if (details.preferred_admin_day) {
        parts.push(`Preferred day: ${details.preferred_admin_day}`)
    }

    if (kind === "librela" || details.requires_appointment === true) {
        parts.push("Appointment needed")
    } else if (details.requires_appointment === false) {
        parts.push("No appointment needed")
    }

    return parts.join(" · ") || null
}
