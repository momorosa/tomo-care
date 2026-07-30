import test from "node:test"
import assert from "node:assert/strict"
import { composeGroundedAnswer } from "./answerComposer.js"

function plannedReminder({
    id,
    eventDate,
    detailsJson,
}) {
    return {
        id,
        doc_id: null,
        event_type: "reminder",
        event_date: eventDate,
        status: "planned",
        details_json: detailsJson,
    }
}

test("names active reminders by care item in the answer and evidence cards", () => {
    const reminders = [
        plannedReminder({
            id: "librela-reminder",
            eventDate: "2026-07-22",
            detailsJson: { subtype: "Librela" },
        }),
        plannedReminder({
            id: "simparica-reminder",
            eventDate: "2026-08-16",
            detailsJson: { care_item: "Simparica Trio" },
        }),
        plannedReminder({
            id: "adequan-reminder",
            eventDate: "2026-08-30",
            detailsJson: { care_item: "Adequan" },
        }),
        plannedReminder({
            id: "insurance-reminder",
            eventDate: "2026-09-10",
            detailsJson: { subtype: "Insurance claim" },
        }),
    ]

    const response = composeGroundedAnswer({
        question: "What reminders are active?",
        queryPlan: { intent: "active_reminders" },
        context: {
            plannedReminders: reminders,
            verifiedEvents: [],
            scheduledAppointments: [],
            documents: [],
            directLibrelaCostItems: [],
            librelaVisitCostItems: [],
            verifiedWeightFacts: [],
        },
    })

    assert.match(response.answer, /Librela on July 22, 2026/)
    assert.match(response.answer, /Simparica Trio on August 16, 2026/)
    assert.match(response.answer, /Adequan on August 30, 2026/)
    assert.match(response.answer, /Insurance claim on September 10, 2026/)
    assert.deepEqual(
        response.citations.map((citation) => citation.display_title),
        [
            "Librela reminder",
            "Simparica Trio reminder",
            "Adequan reminder",
            "Insurance claim reminder",
        ]
    )
})

test("returns an editable, unsent Librela appointment-message draft", () => {
    const injection = {
        id: "librela-injection",
        doc_id: "librela-document",
        event_type: "injection",
        event_date: "2026-06-10",
        status: "verified",
        details_json: { subtype: "Librela" },
    }
    const reminder = plannedReminder({
        id: "librela-reminder",
        eventDate: "2026-07-22",
        detailsJson: {
            subtype: "Librela",
            due_date: "2026-07-29",
        },
    })
    const draft = {
        type: "librela_appointment_request",
        status: "draft",
        recipient_name: "SoMa Animal Hospital",
        message_body: "Draft message",
        dates: {
            last_verified_injection_date: "2026-06-10",
            reminder_date: "2026-07-22",
            due_date: "2026-07-29",
        },
        delivery: {
            status: "not_sent",
            send_available: false,
        },
    }
    const workflow = {
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
    }

    const response = composeGroundedAnswer({
        question: "Draft a Librela appointment request.",
        queryPlan: { intent: "librela_appointment_message" },
        context: {
            plannedReminders: [reminder],
            verifiedEvents: [injection],
            scheduledAppointments: [],
            documents: [],
            directLibrelaCostItems: [],
            librelaVisitCostItems: [],
            verifiedWeightFacts: [],
        },
        messageDraftPreparation: {
            status: "prepared",
            injection,
            reminder,
            draft,
            workflow,
        },
    })

    assert.equal(response.answer_type, "message_draft_prepared")
    assert.equal(response.proposed_action, null)
    assert.equal(response.message_draft, draft)
    assert.equal(response.workflow, workflow)
    assert.match(response.answer, /SoMa Animal Hospital/)
    assert.match(response.answer, /June 10, 2026/)
    assert.match(response.answer, /July 29, 2026/)
    assert.deepEqual(
        response.citations.map((citation) => citation.display_title),
        [
            "Last verified Librela injection",
            "Current Librela reminder",
        ]
    )
})

test("does not draft a duplicate Librela request when an appointment exists", () => {
    const appointment = {
        id: "librela-appointment",
        doc_id: null,
        event_type: "appointment",
        event_date: "2026-07-28",
        status: "confirmed",
        details_json: { subtype: "Librela" },
    }

    const response = composeGroundedAnswer({
        question: "Draft a Librela appointment request.",
        queryPlan: { intent: "librela_appointment_message" },
        context: {
            plannedReminders: [],
            verifiedEvents: [],
            scheduledAppointments: [appointment],
            documents: [],
            directLibrelaCostItems: [],
            librelaVisitCostItems: [],
            verifiedWeightFacts: [],
        },
        messageDraftPreparation: {
            status: "appointment_exists",
            appointment,
        },
    })

    assert.equal(response.answer_type, "grounded_answer")
    assert.equal(response.message_draft, null)
    assert.match(response.answer, /did not prepare another request/)
    assert.match(response.answer, /July 28, 2026/)
})
