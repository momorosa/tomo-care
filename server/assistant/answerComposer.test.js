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