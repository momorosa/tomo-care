import { getCareDate } from "../lib/careDates.js"

export const LIBRELA_REMINDER_SUBTYPE = "Librela"
export const INSURANCE_CLAIM_REMINDER_SUBTYPE = "Insurance claim"
export const HOME_MEDICATION_REMINDER_TYPE = "home_medication"

export function resolveReminderTimingState(
    event,
    { currentCareDate = getCareDate() } = {}
) {
    const details = event?.details_json || {}

    if (details.subtype === INSURANCE_CLAIM_REMINDER_SUBTYPE) {
        return getInsuranceClaimTimingState({
            targetSubmitDate: details.target_submit_date,
            claimDeadlineDate: details.claim_deadline_date,
            currentCareDate,
        })
    }

    if (details.subtype === LIBRELA_REMINDER_SUBTYPE) {
        return getLibrelaTimingState({
            reminderDate: event?.event_date,
            dueDate: details.due_date,
            currentCareDate,
        })
    }

    if (details.reminder_type === HOME_MEDICATION_REMINDER_TYPE) {
        return getHomeMedicationTimingState({
            reminderDate: event?.event_date,
            targetAdminDate:
                details.target_admin_date ||
                details.due_date ||
                event?.event_date,
            currentCareDate,
        })
    }

    return "unknown"
}

function getLibrelaTimingState({
    reminderDate,
    dueDate,
    currentCareDate,
}) {
    if (!reminderDate || !dueDate) return "unknown"
    if (dueDate < currentCareDate) return "overdue"
    if (reminderDate < currentCareDate) return "reminder_window_passed"
    return "upcoming"
}

function getInsuranceClaimTimingState({
    targetSubmitDate,
    claimDeadlineDate,
    currentCareDate,
}) {
    if (!targetSubmitDate || !claimDeadlineDate) return "unknown"
    if (claimDeadlineDate < currentCareDate) return "claim_window_expired"
    if (targetSubmitDate <= currentCareDate) return "due_now"
    return "upcoming"
}

function getHomeMedicationTimingState({
    reminderDate,
    targetAdminDate,
    currentCareDate,
}) {
    if (!targetAdminDate || !reminderDate) return "unknown"
    if (targetAdminDate < currentCareDate) return "overdue"
    if (reminderDate <= currentCareDate) return "due_now"
    return "upcoming"
}
