import { getCareDate } from "../lib/careDates.js"

const DRAFT_ACTION_PATTERN = /\b(draft|prepare|write|compose)\b/i
const MESSAGE_PATTERN =
    /\b(message|text|email|appointment request|request an appointment)\b/i
const APPOINTMENT_PATTERN = /\b(appointment|appt|schedule|scheduling)\b/i
const LIBRELA_PATTERN = /\b(librela|shot|injection)\b/i

export function isLibrelaAppointmentMessageRequest(question) {
    const text = String(question || "").trim()

    return (
        LIBRELA_PATTERN.test(text) &&
        DRAFT_ACTION_PATTERN.test(text) &&
        (MESSAGE_PATTERN.test(text) || APPOINTMENT_PATTERN.test(text))
    )
}

export function prepareLibrelaAppointmentMessage({
    context,
    currentCareDate = getCareDate(),
    senderName = "Rosa",
    petName = "Momo",
}) {
    const upcomingAppointment = findUpcomingLibrelaAppointment(
        context?.scheduledAppointments,
        currentCareDate
    )

    if (upcomingAppointment) {
        return {
            status: "appointment_exists",
            appointment: upcomingAppointment,
        }
    }

    const reminder = findCurrentLibrelaReminder(
        context?.plannedReminders,
        currentCareDate
    )

    if (!reminder) {
        return {
            status: "reminder_not_found",
        }
    }

    const dueDate = getReminderDueDate(reminder)

    if (!dueDate) {
        return {
            status: "due_date_not_found",
            reminder,
        }
    }

    const injection = findLatestLibrelaInjection(
        context?.librelaInjectionEvents
    )

    if (!injection) {
        return {
            status: "injection_not_found",
            reminder,
        }
    }

    const sourceDocument = findSourceDocument({
        context,
        reminder,
        injection,
    })
    const recipientName =
        reminder.details_json?.source_org || sourceDocument?.source_org || null

    if (!recipientName) {
        return {
            status: "recipient_not_found",
            reminder,
            injection,
        }
    }

    const messageBody = [
        `Hi ${recipientName},`,
        "",
        `I’d like to schedule ${petName}’s next Librela injection. Her last Librela injection was on ${formatDate(injection.event_date)}, and her next one is due around ${formatDate(dueDate)}. Do you have any appointments available around that date?`,
        "",
        "Thank you,",
        senderName,
    ].join("\n")

    return {
        status: "prepared",
        reminder,
        injection,
        sourceDocument,
        draft: {
            type: "librela_appointment_request",
            status: "draft",
            recipient_name: recipientName,
            recipient_basis: "trusted_record",
            recipient_contact: null,
            purpose: `Schedule ${petName}’s next Librela injection`,
            message_body: messageBody,
            dates: {
                last_verified_injection_date: injection.event_date,
                reminder_date: reminder.event_date,
                due_date: dueDate,
            },
            evidence: {
                injection_event_id: injection.id,
                reminder_event_id: reminder.id,
                source_document_id: sourceDocument?.id || reminder.doc_id || null,
            },
            delivery: {
                status: "not_sent",
                send_available: false,
            },
        },
    }
}

function findCurrentLibrelaReminder(reminders = [], currentCareDate) {
    const librelaReminders = reminders
        .filter(isLibrelaRelated)
        .sort((a, b) => {
            const aDate = getReminderDueDate(a) || a.event_date
            const bDate = getReminderDueDate(b) || b.event_date
            return new Date(aDate) - new Date(bDate)
        })

    return (
        librelaReminders.find(
            (reminder) =>
                (getReminderDueDate(reminder) || reminder.event_date) >=
                currentCareDate
        ) ||
        librelaReminders.at(-1) ||
        null
    )
}

function findLatestLibrelaInjection(injections = []) {
    return [...injections]
        .filter((event) => event?.event_date)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0] || null
}

function findUpcomingLibrelaAppointment(appointments = [], currentCareDate) {
    return [...appointments]
        .filter(isLibrelaRelated)
        .filter((event) => getEventDate(event) >= currentCareDate)
        .sort(
            (a, b) =>
                new Date(getEventDate(a)) - new Date(getEventDate(b))
        )[0] || null
}

function findSourceDocument({ context, reminder, injection }) {
    const documents = context?.documents || []
    const sourceDocumentId =
        reminder.details_json?.source_document_id ||
        reminder.doc_id ||
        injection.doc_id

    return documents.find((document) => document.id === sourceDocumentId) || null
}

function getReminderDueDate(reminder) {
    const details = reminder?.details_json || {}

    return (
        details.due_date ||
        details.dueDate ||
        details.target_date ||
        details.targetDate ||
        null
    )
}

function getEventDate(event) {
    return event?.event_date || String(event?.event_start || "").slice(0, 10)
}

function isLibrelaRelated(row) {
    const details = row?.details_json || {}
    const haystack = [
        row?.event_type,
        row?.status,
        details.subtype,
        details.target_subtype,
        details.medication,
        details.medication_name,
        details.title,
        details.description,
        details.reason,
        details.visit_type,
        details.appointment_type,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

function formatDate(value) {
    const date = new Date(`${value}T00:00:00`)

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date)
}
