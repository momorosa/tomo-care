import test from "node:test"
import assert from "node:assert/strict"
import {
    isLibrelaAppointmentMessageRequest,
    prepareLibrelaAppointmentMessage,
} from "./librelaAppointmentMessage.js"

const CURRENT_CARE_DATE = "2026-07-26"

test("recognizes an explicit request to draft a Librela appointment message", () => {
    assert.equal(
        isLibrelaAppointmentMessageRequest(
            "Draft an appointment request for Momo’s next Librela shot."
        ),
        true
    )
    assert.equal(
        isLibrelaAppointmentMessageRequest(
            "Write a message to schedule Momo's Librela injection."
        ),
        true
    )
})

test("does not treat appointment status or booking as a draft request", () => {
    assert.equal(
        isLibrelaAppointmentMessageRequest(
            "Have we made a Librela appointment?"
        ),
        false
    )
    assert.equal(
        isLibrelaAppointmentMessageRequest(
            "Can you book Momo's Librela appointment?"
        ),
        false
    )
})

test("prepares an unsent message from trusted Librela records", () => {
    const context = buildContext()
    const result = prepareLibrelaAppointmentMessage({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "prepared")
    assert.equal(result.draft.recipient_name, "SoMa Animal Hospital")
    assert.equal(result.draft.dates.last_verified_injection_date, "2026-06-10")
    assert.equal(result.draft.dates.reminder_date, "2026-07-22")
    assert.equal(result.draft.dates.due_date, "2026-07-29")
    assert.equal(result.draft.delivery.status, "not_sent")
    assert.equal(result.draft.delivery.send_available, false)
    assert.match(result.draft.message_body, /June 10, 2026/)
    assert.match(result.draft.message_body, /July 29, 2026/)
    assert.match(result.draft.message_body, /Do you have any appointments/)
})

test("uses the trusted source document when the reminder lacks a clinic name", () => {
    const context = buildContext()
    delete context.plannedReminders[0].details_json.source_org

    const result = prepareLibrelaAppointmentMessage({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "prepared")
    assert.equal(result.draft.recipient_name, "SoMa Animal Hospital")
})

test("does not prepare a duplicate request when an appointment exists", () => {
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

    const result = prepareLibrelaAppointmentMessage({
        context,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "appointment_exists")
    assert.equal(result.draft, undefined)
})

test("requires a trusted reminder, due date, injection, and clinic name", () => {
    assert.equal(
        prepareLibrelaAppointmentMessage({
            context: buildContext({ reminders: [] }),
            currentCareDate: CURRENT_CARE_DATE,
        }).status,
        "reminder_not_found"
    )

    const missingDueDate = buildContext()
    delete missingDueDate.plannedReminders[0].details_json.due_date
    assert.equal(
        prepareLibrelaAppointmentMessage({
            context: missingDueDate,
            currentCareDate: CURRENT_CARE_DATE,
        }).status,
        "due_date_not_found"
    )

    assert.equal(
        prepareLibrelaAppointmentMessage({
            context: buildContext({ injections: [] }),
            currentCareDate: CURRENT_CARE_DATE,
        }).status,
        "injection_not_found"
    )

    const missingRecipient = buildContext()
    delete missingRecipient.plannedReminders[0].details_json.source_org
    missingRecipient.documents = []
    assert.equal(
        prepareLibrelaAppointmentMessage({
            context: missingRecipient,
            currentCareDate: CURRENT_CARE_DATE,
        }).status,
        "recipient_not_found"
    )
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
