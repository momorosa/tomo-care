export const SEND_LIBRELA_APPOINTMENT_REQUEST =
    "send_librela_appointment_request"

export function isLibrelaAppointmentRequest(action) {
    return action?.action_type === SEND_LIBRELA_APPOINTMENT_REQUEST
}

export function getRecoveredCareActionPhase(action) {
    if (action?.native_handoff?.state === "user_reported_sent") {
        return "user_reported_sent"
    }
    if (action?.native_handoff?.state === "user_confirmed_not_sent") {
        return "user_confirmed_not_sent"
    }
    if (action?.status === "proposed") return "reviewing"
    if (
        action?.status === "approved" &&
        action?.native_handoff?.state === "messages_handoff_requested" &&
        action?.native_handoff?.target_app === "apple_messages"
    ) {
        return "messages_handoff_requested"
    }
    if (action?.status === "approved") return "approved"
    if (action?.status === "succeeded") return "succeeded"

    if (isLibrelaAppointmentRequest(action)) {
        if (action?.status === "failed") return "failed"

        if (
            action?.status === "executing" ||
            action?.status === "outcome_unknown"
        ) {
            return "outcome_unknown"
        }
    }

    if (action?.status === "executing") return "recovery_error"

    return "idle"
}

export function getOutboundExecutionErrorPhase(error) {
    if (error?.outcomeUnknown) return "outcome_unknown"
    if (error?.reason === "delivery_failed") return "failed"
    if (error?.recovery === "review_delivery") return "outcome_unknown"

    return "approved"
}

export function buildRecoveredLibrelaDraft(action) {
    if (!isLibrelaAppointmentRequest(action)) return null

    const preview = action.preview_json || {}
    const payload = action.payload_json || {}

    return {
        type: "librela_appointment_request",
        status: "draft",
        workflow_run_id: action.orchestration_run_id || null,
        recipient_name:
            preview.recipient_name ||
            payload.recipient_name ||
            "Veterinary clinic",
        recipient_basis: "verified_provider_contact",
        purpose: "Schedule Momo’s next Librela injection",
        message_body: preview.message_body || payload.message_body || "",
        dates: {
            last_verified_injection_date:
                preview.last_verified_injection_date ||
                payload.last_verified_injection_date ||
                null,
            reminder_date:
                preview.reminder_date || payload.reminder_date || null,
            due_date: preview.due_date || payload.due_date || null,
        },
        evidence: {
            injection_event_id: payload.injection_event_id || null,
            reminder_event_id:
                payload.source_reminder_id || action.source_event_id || null,
        },
        delivery: {
            status: getDeliveryStatus(action),
            send_available: action.status === "proposed",
        },
        native_handoff: buildNativeHandoffSummary(action.native_handoff),
    }
}

function buildNativeHandoffSummary(handoff) {
    if (
        ![
            "messages_handoff_requested",
            "user_reported_sent",
            "user_confirmed_not_sent",
        ].includes(handoff?.state) ||
        handoff?.target_app !== "apple_messages"
    ) {
        return null
    }

    return {
        id: handoff.id,
        state: handoff.state,
        target_app: handoff.target_app,
        contract_version: handoff.contract_version,
        requested_at: handoff.requested_at,
        resolved_at: handoff.resolved_at || null,
    }
}

function getDeliveryStatus(action) {
    if (action?.native_handoff?.state === "user_reported_sent") {
        return "user_reported_sent"
    }
    if (action?.native_handoff?.state === "user_confirmed_not_sent") {
        return "not_sent"
    }
    if (action?.status === "succeeded") return "sent"
    if (action?.status === "failed") return "failed"

    if (
        action?.status === "executing" ||
        action?.status === "outcome_unknown"
    ) {
        return "outcome_unknown"
    }

    return "not_sent"
}
