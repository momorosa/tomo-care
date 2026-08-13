import assert from "node:assert/strict"
import test from "node:test"
import {
    buildRecoveredLibrelaDraft,
    getRecoveredCareActionPhase,
    getOutboundExecutionErrorPhase,
    isLibrelaAppointmentRequest,
    SEND_LIBRELA_APPOINTMENT_REQUEST,
} from "./careActionRecovery.js"

function outboundAction(status, overrides = {}) {
    return {
        id: "action-1",
        orchestration_run_id: "run-1",
        source_event_id: "reminder-1",
        action_type: SEND_LIBRELA_APPOINTMENT_REQUEST,
        status,
        preview_json: {
            recipient_name: "SoMa Animal Hospital",
            message_body: "Please schedule Momo.",
            last_verified_injection_date: "2026-06-10",
            reminder_date: "2026-07-22",
            due_date: "2026-07-29",
        },
        payload_json: {
            source_reminder_id: "reminder-1",
            injection_event_id: "injection-1",
            provider_contact_id: "contact-1",
            recipient_fingerprint_sha256: "private-fingerprint",
        },
        ...overrides,
    }
}

test("identifies the governed Librela outbound action", () => {
    assert.equal(isLibrelaAppointmentRequest(outboundAction("proposed")), true)
    assert.equal(
        isLibrelaAppointmentRequest({
            action_type: "mark_home_medication_given",
        }),
        false
    )
})

test("recovers every outbound terminal and locked state without clearing it", () => {
    assert.equal(
        getRecoveredCareActionPhase(outboundAction("proposed")),
        "reviewing"
    )
    assert.equal(
        getRecoveredCareActionPhase(outboundAction("approved")),
        "approved"
    )
    assert.equal(
        getRecoveredCareActionPhase(outboundAction("succeeded")),
        "succeeded"
    )
    assert.equal(
        getRecoveredCareActionPhase(outboundAction("failed")),
        "failed"
    )
    assert.equal(
        getRecoveredCareActionPhase(outboundAction("executing")),
        "outcome_unknown"
    )
    assert.equal(
        getRecoveredCareActionPhase(outboundAction("outcome_unknown")),
        "outcome_unknown"
    )
})

test("rebuilds the outbound dialog without exposing recipient contact data", () => {
    const draft = buildRecoveredLibrelaDraft(outboundAction("succeeded"))

    assert.deepEqual(draft, {
        type: "librela_appointment_request",
        status: "draft",
        workflow_run_id: "run-1",
        recipient_name: "SoMa Animal Hospital",
        recipient_basis: "verified_provider_contact",
        purpose: "Schedule Momo’s next Librela injection",
        message_body: "Please schedule Momo.",
        dates: {
            last_verified_injection_date: "2026-06-10",
            reminder_date: "2026-07-22",
            due_date: "2026-07-29",
        },
        evidence: {
            injection_event_id: "injection-1",
            reminder_event_id: "reminder-1",
        },
        delivery: {
            status: "sent",
            send_available: false,
        },
        native_handoff: null,
    })
    assert.equal(JSON.stringify(draft).includes("private-fingerprint"), false)
    assert.equal(JSON.stringify(draft).includes("provider_contact_id"), false)
})

test("recovers an approved native handoff without claiming a send", () => {
    const action = outboundAction("approved", {
        native_handoff: {
            id: "handoff-1",
            care_action_id: "action-1",
            state: "messages_handoff_requested",
            target_app: "apple_messages",
            contract_version: 1,
            requested_at: "2026-08-13T02:45:00.000Z",
        },
    })

    assert.equal(
        getRecoveredCareActionPhase(action),
        "messages_handoff_requested"
    )

    const draft = buildRecoveredLibrelaDraft(action)
    assert.equal(draft.delivery.status, "not_sent")
    assert.deepEqual(draft.native_handoff, {
        id: "handoff-1",
        state: "messages_handoff_requested",
        target_app: "apple_messages",
        contract_version: 1,
        requested_at: "2026-08-13T02:45:00.000Z",
        resolved_at: null,
    })
    assert.equal(JSON.stringify(draft).includes("care_action_id"), false)
})

test("distinguishes human-reported sent from delivery and confirmed not-sent", () => {
    const reportedSent = outboundAction("succeeded", {
        native_handoff: {
            id: "handoff-1",
            state: "user_reported_sent",
            target_app: "apple_messages",
            contract_version: 1,
            requested_at: "2026-08-13T02:45:00.000Z",
            resolved_at: "2026-08-13T03:30:00.000Z",
        },
    })
    const confirmedNotSent = outboundAction("cancelled", {
        native_handoff: {
            id: "handoff-2",
            state: "user_confirmed_not_sent",
            target_app: "apple_messages",
            contract_version: 1,
            requested_at: "2026-08-13T02:45:00.000Z",
            resolved_at: "2026-08-13T03:31:00.000Z",
        },
    })

    assert.equal(getRecoveredCareActionPhase(reportedSent), "user_reported_sent")
    assert.equal(
        buildRecoveredLibrelaDraft(reportedSent).delivery.status,
        "user_reported_sent"
    )
    assert.equal(
        getRecoveredCareActionPhase(confirmedNotSent),
        "user_confirmed_not_sent"
    )
    assert.equal(
        buildRecoveredLibrelaDraft(confirmedNotSent).delivery.status,
        "not_sent"
    )
})

test("preserves standard executing recovery behavior", () => {
    assert.equal(
        getRecoveredCareActionPhase({
            action_type: "mark_home_medication_given",
            status: "executing",
        }),
        "recovery_error"
    )
})

test("maps delivery errors without offering an unsafe automatic resend", () => {
    assert.equal(
        getOutboundExecutionErrorPhase({ outcomeUnknown: true }),
        "outcome_unknown"
    )
    assert.equal(
        getOutboundExecutionErrorPhase({ reason: "delivery_failed" }),
        "failed"
    )
    assert.equal(
        getOutboundExecutionErrorPhase({ recovery: "review_delivery" }),
        "outcome_unknown"
    )
    assert.equal(
        getOutboundExecutionErrorPhase({ reason: "network_error" }),
        "approved"
    )
})
