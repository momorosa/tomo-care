import test from "node:test"
import assert from "node:assert/strict"
import {
    buildCarePlanningHandoff,
    buildCommunicationHandoff,
    buildRecordsHandoff,
    coordinateLibrelaAppointmentRequest,
} from "./librelaAppointmentCoordinator.js"

const CURRENT_CARE_DATE = "2026-07-26"

test("coordinates the three specialist handoffs without taking an external action", () => {
    const result = coordinateLibrelaAppointmentRequest({
        context: buildContext(),
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "prepared")
    assert.equal(result.draft.recipient_name, "SoMa Animal Hospital")
    assert.equal(result.draft.recipient_contact, null)
    assert.equal(result.draft.delivery.status, "not_sent")
    assert.equal(result.draft.delivery.send_available, false)
    assert.deepEqual(result.workflow, {
        type: "librela_appointment_request",
        version: 1,
        state: "awaiting_human_review",
        current_owner: "human",
        completed_roles: [
            "records",
            "care_planning",
            "communication",
        ],
        pending_decision: "review_or_edit_message",
        blocked_reason: null,
        external_action_taken: false,
    })
})

test("passes only selected trusted records into the records handoff", () => {
    const context = buildContext()
    context.unrelatedPrivateContext = {
        notes: "must not cross the records boundary",
    }
    context.librelaInjectionEvents.push({
        ...context.librelaInjectionEvents[0],
        id: "unverified-injection",
        event_date: "2026-07-20",
        status: "proposed",
    })

    const handoff = buildRecordsHandoff({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(handoff.contract, "trusted_librela_records")
    assert.equal(handoff.version, 1)
    assert.equal(handoff.role, "records")
    assert.equal(handoff.status, "ready")
    assert.equal(handoff.injection.id, "injection-1")
    assert.equal("unrelatedPrivateContext" in handoff, false)
})

test("care planning receives a versioned records contract and returns only the plan", () => {
    const recordsHandoff = buildRecordsHandoff({
        context: buildContext(),
        currentCareDate: CURRENT_CARE_DATE,
    })
    const handoff = buildCarePlanningHandoff({
        recordsHandoff,
        petName: "Momo",
    })

    assert.deepEqual(handoff, {
        contract: "librela_appointment_plan",
        version: 1,
        role: "care_planning",
        status: "ready",
        plan: {
            purpose: "Schedule Momo’s next Librela injection",
            petName: "Momo",
            recipientName: "SoMa Animal Hospital",
            dates: {
                lastVerifiedInjectionDate: "2026-06-10",
                reminderDate: "2026-07-22",
                dueDate: "2026-07-29",
            },
            evidence: {
                injectionEventId: "injection-1",
                reminderEventId: "reminder-1",
                sourceDocumentId: "document-1",
            },
        },
    })
    assert.equal("reminder" in handoff, false)
    assert.equal("injection" in handoff, false)
    assert.equal("sourceDocument" in handoff, false)
})

test("communication accepts only a ready planning contract and prepares an unsent draft", () => {
    const recordsHandoff = buildRecordsHandoff({
        context: buildContext(),
        currentCareDate: CURRENT_CARE_DATE,
    })
    const carePlanningHandoff = buildCarePlanningHandoff({
        recordsHandoff,
    })
    const handoff = buildCommunicationHandoff({
        carePlanningHandoff,
        senderName: "Rosa",
    })

    assert.equal(handoff.contract, "appointment_message_draft")
    assert.equal(handoff.version, 1)
    assert.equal(handoff.role, "communication")
    assert.equal(handoff.status, "ready")
    assert.match(handoff.draft.message_body, /June 10, 2026/)
    assert.match(handoff.draft.message_body, /July 29, 2026/)
    assert.equal(handoff.draft.recipient_contact, null)
    assert.equal(handoff.draft.delivery.send_available, false)

    assert.throws(
        () =>
            buildCommunicationHandoff({
                carePlanningHandoff: {
                    ...carePlanningHandoff,
                    status: "blocked",
                },
            }),
        /must be a ready librela_appointment_plan v1 handoff/
    )
})

test("stops after records when a future appointment already exists", () => {
    const context = buildContext()
    context.scheduledAppointments = [
        {
            id: "appointment-1",
            event_type: "appointment",
            event_date: "2026-07-28",
            status: "confirmed",
            details_json: { subtype: "Librela" },
        },
    ]

    const result = coordinateLibrelaAppointmentRequest({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "appointment_exists")
    assert.equal(result.draft, undefined)
    assert.deepEqual(result.workflow.completed_roles, ["records"])
    assert.equal(result.workflow.state, "complete_no_action")
    assert.equal(result.workflow.external_action_taken, false)
})

test("blocks when trusted records are missing or unverified", () => {
    const missingReminder = coordinateLibrelaAppointmentRequest({
        context: buildContext({ reminders: [] }),
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(missingReminder.status, "reminder_not_found")
    assert.equal(missingReminder.workflow.state, "blocked")
    assert.deepEqual(missingReminder.workflow.completed_roles, [])
    assert.equal(missingReminder.workflow.external_action_taken, false)

    const context = buildContext()
    context.librelaInjectionEvents[0].status = "proposed"
    const unverifiedInjection = coordinateLibrelaAppointmentRequest({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(unverifiedInjection.status, "injection_not_found")
    assert.equal(
        unverifiedInjection.workflow.blocked_reason,
        "injection_not_found"
    )
})

test("does not use an unverified source document to identify the clinic", () => {
    const context = buildContext()
    delete context.plannedReminders[0].details_json.source_org
    context.documents[0].status = "needs_review"

    const result = coordinateLibrelaAppointmentRequest({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "recipient_not_found")
    assert.equal(result.workflow.state, "blocked")
    assert.deepEqual(result.workflow.completed_roles, ["records"])
    assert.equal(result.workflow.external_action_taken, false)
})

function buildContext({
    reminders,
    injections,
} = {}) {
    const reminder = {
        id: "reminder-1",
        doc_id: "document-1",
        event_type: "reminder",
        event_date: "2026-07-22",
        status: "planned",
        details_json: {
            subtype: "Librela",
            due_date: "2026-07-29",
            source_document_id: "document-1",
            source_org: "SoMa Animal Hospital",
        },
    }

    const injection = {
        id: "injection-1",
        doc_id: "document-1",
        event_type: "injection",
        event_date: "2026-06-10",
        status: "verified",
        details_json: { subtype: "Librela" },
    }

    return {
        plannedReminders: reminders ?? [reminder],
        librelaInjectionEvents: injections ?? [injection],
        scheduledAppointments: [],
        documents: [
            {
                id: "document-1",
                source_org: "SoMa Animal Hospital",
                status: "verified",
            },
        ],
    }
}
