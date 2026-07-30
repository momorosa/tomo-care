import { coordinateLibrelaAppointmentRequest } from "../orchestration/librelaAppointmentCoordinator.js"

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
    currentCareDate,
    senderName,
    petName,
}) {
    return coordinateLibrelaAppointmentRequest({
        context,
        currentCareDate,
        senderName,
        petName,
    })
}
