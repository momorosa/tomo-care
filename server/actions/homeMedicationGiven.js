import { addDaysToIsoDate, getCareDate } from "../lib/careDates.js"

export const MARK_HOME_MEDICATION_GIVEN = "mark_home_medication_given"

const HOME_MEDICATION_REMINDER_TYPE = "home_medication"
const ALLOWED_CARE_CATEGORIES = new Set([
    "at_home_medication",
    "at_home_injection",
])
const ALLOWED_REQUEST_SOURCES = new Set([
    "dashboard",
    "assistant",
    "system",
])
const WEEKDAY_INDEX = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
}

export function buildMarkHomeMedicationGivenProposal({
    petId,
    reminder,
    administeredDate,
    requestSource,
    requestedBy,
    currentCareDate = getCareDate(),
}) {
    assertNonBlank(petId, "petId")
    assertNonBlank(requestedBy, "requestedBy")

    if (!ALLOWED_REQUEST_SOURCES.has(requestSource)) {
        throw new Error(`Unsupported request source: ${requestSource}`)
    }

    const details = validateHomeMedicationReminder({ petId, reminder })
    validateAdministrationDate({
        administeredDate,
        currentCareDate,
        lastAdministeredDate: details.last_administered_date,
    })

    const nextDueDate = addDaysToIsoDate(
        administeredDate,
        details.cadence_days
    )
    const nextTargetAdminDate = getPreferredDateOnOrBefore({
        dueDate: nextDueDate,
        preferredDay: details.preferred_admin_day,
    })
    const nextReminderDate = addDaysToIsoDate(
        nextTargetAdminDate,
        -details.reminder_days_before
    )

    const idempotencyKey = [
        MARK_HOME_MEDICATION_GIVEN,
        petId,
        reminder.id,
        administeredDate,
    ].join(":")

    return {
        pet_id: petId,
        source_event_id: reminder.id,
        action_type: MARK_HOME_MEDICATION_GIVEN,
        status: "proposed",
        request_source: requestSource,
        requested_by: requestedBy,
        idempotency_key: idempotencyKey,
        preview_json: {
            title: `Mark ${details.care_item} as given`,
            confirmation_message:
                `Record ${details.care_item} as given on ${administeredDate}, ` +
                `complete the current reminder, and prepare the next reminder ` +
                `for ${nextReminderDate}?`,
            care_item: details.care_item,
            administered_date: administeredDate,
            next_due_date: nextDueDate,
            next_target_admin_date: nextTargetAdminDate,
            next_reminder_date: nextReminderDate,
            changes: [
                {
                    operation: "create",
                    record_type: "medication_administration",
                    status: "verified",
                    event_date: administeredDate,
                },
                {
                    operation: "update",
                    record_type: "reminder",
                    record_id: reminder.id,
                    status: "completed",
                },
                {
                    operation: "upsert",
                    record_type: "reminder",
                    status: "planned",
                    event_date: nextReminderDate,
                },
            ],
        },
        payload_json: {
            schema_version: 1,
            pet_id: petId,
            source_reminder_id: reminder.id,
            source_reminder_updated_at: reminder.updated_at,
            care_item: details.care_item,
            care_category: details.care_category,
            administered_date: administeredDate,
            cadence_days: details.cadence_days,
            previous_administered_date: details.last_administered_date,
            next_due_date: nextDueDate,
            next_target_admin_date: nextTargetAdminDate,
            next_reminder_date: nextReminderDate,
            preferred_admin_day: details.preferred_admin_day,
            reminder_days_before: details.reminder_days_before,
            requires_appointment: false,
            route: details.route || null,
            administered_by: details.administered_by || requestedBy,
            source: "owner_confirmation",
        },
        evidence_json: [
            {
                type: "event",
                id: reminder.id,
                label: "Current planned home-medication reminder",
                event_date: reminder.event_date,
                updated_at: reminder.updated_at,
            },
        ],
    }
}

export function getPreferredDateOnOrBefore({ dueDate, preferredDay }) {
    const preferredDayIndex = WEEKDAY_INDEX[preferredDay]

    if (preferredDayIndex === undefined) {
        throw new Error(`Unsupported preferred administration day: ${preferredDay}`)
    }

    const normalizedDueDate = addDaysToIsoDate(dueDate, 0)
    const [year, month, day] = normalizedDueDate.split("-").map(Number)
    const dueDayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    const daysBack = (dueDayIndex - preferredDayIndex + 7) % 7

    return addDaysToIsoDate(normalizedDueDate, -daysBack)
}

function validateHomeMedicationReminder({ petId, reminder }) {
    if (!reminder || typeof reminder !== "object") {
        throw new Error("A trusted reminder is required.")
    }

    assertNonBlank(reminder.id, "reminder.id")
    assertNonBlank(reminder.updated_at, "reminder.updated_at")

    if (reminder.pet_id !== petId) {
        throw new Error("Reminder does not belong to this pet.")
    }

    if (reminder.event_type !== "reminder") {
        throw new Error("Source event must be a reminder.")
    }

    if (reminder.status !== "planned") {
        throw new Error("Only a planned reminder can be marked as given.")
    }

    const details = reminder.details_json || {}

    if (details.reminder_type !== HOME_MEDICATION_REMINDER_TYPE) {
        throw new Error("Reminder is not a home-medication reminder.")
    }

    if (!ALLOWED_CARE_CATEGORIES.has(details.care_category)) {
        throw new Error(`Unsupported care category: ${details.care_category}`)
    }

    if (details.requires_appointment !== false) {
        throw new Error("This care item is not confirmed for at-home administration.")
    }

    assertNonBlank(details.care_item, "details_json.care_item")
    assertNonBlank(
        details.last_administered_date,
        "details_json.last_administered_date"
    )

    addDaysToIsoDate(details.last_administered_date, 0)

    if (!Number.isInteger(details.cadence_days) || details.cadence_days <= 0) {
        throw new Error("cadence_days must be a positive integer.")
    }

    if (
        !Number.isInteger(details.reminder_days_before) ||
        details.reminder_days_before < 0
    ) {
        throw new Error("reminder_days_before must be a non-negative integer.")
    }

    if (WEEKDAY_INDEX[details.preferred_admin_day] === undefined) {
        throw new Error(
            `Unsupported preferred administration day: ${details.preferred_admin_day}`
        )
    }

    return details
}

function validateAdministrationDate({
    administeredDate,
    currentCareDate,
    lastAdministeredDate,
}) {
    const normalizedAdministeredDate = addDaysToIsoDate(administeredDate, 0)
    const normalizedCurrentCareDate = addDaysToIsoDate(currentCareDate, 0)

    if (normalizedAdministeredDate > normalizedCurrentCareDate) {
        throw new Error("Administration date cannot be in the future.")
    }

    if (normalizedAdministeredDate <= lastAdministeredDate) {
        throw new Error(
            "Administration date must be after the last verified administration."
        )
    }
}

function assertNonBlank(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} is required.`)
    }
}