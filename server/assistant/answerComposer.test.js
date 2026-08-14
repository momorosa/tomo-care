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

test("answers the bounded Librela one-before follow-up from verified events", () => {
    const injections = [
        {
            id: "latest-injection",
            doc_id: null,
            event_type: "injection",
            event_date: "2026-06-10",
            status: "verified",
            details_json: { subtype: "Librela" },
        },
        {
            id: "previous-injection",
            doc_id: null,
            event_type: "injection",
            event_date: "2026-04-14",
            status: "verified",
            details_json: { subtype: "Librela" },
        },
    ]
    const response = composeGroundedAnswer({
        question: "What about the one before?",
        queryPlan: {
            intent: "last_librela",
            subject: "librela",
            date_range: { kind: "all_time" },
            event_offset: 1,
        },
        context: {
            librelaInjectionEvents: injections,
            verifiedEvents: injections,
            plannedReminders: [],
            scheduledAppointments: [],
            documents: [],
            directLibrelaCostItems: [],
            librelaVisitCostItems: [],
            verifiedWeightFacts: [],
        },
    })

    assert.match(response.answer, /before that was on April 14, 2026/)
    assert.equal(response.citations[0].id, "previous-injection")
})

test("varies thanks deterministically without inventing a care fact", () => {
    const questions = ["Thank you!", "Thanks, Tomo", "Much appreciated"]
    const responses = questions.map((question) =>
        composeGroundedAnswer({
            question,
            queryPlan: {
                intent: "social_response",
                subject: "thanks",
            },
            context: {},
        })
    )

    assert.ok(new Set(responses.map((response) => response.answer)).size > 1)
    for (const response of responses) {
        assert.equal(response.answer_type, "social_response")
        assert.deepEqual(response.citations, [])
    }

    const repeated = composeGroundedAnswer({
        question: "Thank you!",
        queryPlan: {
            intent: "social_response",
            subject: "thanks",
        },
        context: {},
    })
    assert.equal(repeated.answer, responses[0].answer)
})

test("matches bounded positive-feedback variations to Rosa's wording", () => {
    const questions = [
        "Hey, that’s fantastic, thank you!",
        "Oh, that’s perfect—that’s what I was looking for.",
        "That’s amazing!",
        "Great.",
    ]
    const responses = questions.map((question) =>
        composeGroundedAnswer({
            question,
            queryPlan: {
                intent: "social_response",
                subject: "positive_feedback",
            },
            context: {},
        })
    )

    assert.equal(
        responses[0].answer,
        "Of course, Rosa. I’m happy that landed just right."
    )
    assert.equal(responses[1].answer, "Glad we found exactly what you needed.")
    assert.equal(responses[2].answer, "Yes! I’m glad that worked so well.")
    assert.equal(responses[3].answer, "I’m glad that helped, Rosa.")
    assert.equal(new Set(responses.map((response) => response.answer)).size, 4)

    for (const response of responses) {
        assert.equal(response.answer_type, "social_response")
        assert.deepEqual(response.citations, [])
        assert.equal(response.proposed_action, null)
    }
})

test("keeps a safe correction response available when generation cannot be used", () => {
    const response = composeGroundedAnswer({
        question: "No, that’s not what I meant.",
        queryPlan: {
            intent: "social_response",
            subject: "negative_feedback",
        },
        context: {},
    })

    assert.equal(response.answer_type, "social_response")
    assert.match(response.answer, /wrong direction|correcting me/)
    assert.deepEqual(response.citations, [])
    assert.equal(response.proposed_action, null)
})

test("describes Tomo and its bounded capabilities without loading care facts", () => {
    const response = composeGroundedAnswer({
        question: "Can you tell me about you? What can you do for me?",
        queryPlan: {
            intent: "social_response",
            subject: "capabilities",
        },
        context: {},
    })

    assert.equal(response.answer_type, "social_response")
    assert.match(response.answer, /I’m Tomo—your sidekick for Momo’s care/)
    assert.match(response.answer, /verified TomoCare records/)
    assert.match(response.answer, /without your approval/)
    assert.deepEqual(response.citations, [])
})

test("describes Momo from the bounded relationship profile without describing Tomo", () => {
    const response = composeGroundedAnswer({
        question: "What do you know about Momo?",
        queryPlan: {
            intent: "social_response",
            subject: "momo_profile",
        },
        context: {},
    })

    assert.equal(response.answer_type, "social_response")
    assert.match(response.answer, /beloved senior American Eskimo/)
    assert.match(response.answer, /August 22, 2014/)
    assert.match(response.answer, /ball-catching family queen/)
    assert.doesNotMatch(response.answer, /I’m Tomo|what I can do/i)
    assert.deepEqual(response.citations, [])
})

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

test("keeps the August reminder list in August and separates an earlier active reminder", () => {
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
        question: "Is anything on my calendar for August?",
        queryPlan: {
            intent: "active_reminders",
            subject: "reminders",
            date_range: {
                type: "calendar_month",
                label: "August 2026",
                start: "2026-08-01",
                end: "2026-08-31",
            },
        },
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

    assert.match(response.answer, /2 active planned reminders in August 2026/)
    assert.match(response.answer, /Simparica Trio on August 16, 2026/)
    assert.match(response.answer, /Adequan on August 30, 2026/)
    assert.match(response.answer, /Separately, there is 1 earlier active reminder: Librela on July 22, 2026/)
    assert.doesNotMatch(response.answer, /Insurance claim/)
    assert.deepEqual(
        response.citations.map((citation) => citation.id),
        ["simparica-reminder", "adequan-reminder", "librela-reminder"]
    )
})

test("summarizes the weight pattern before supporting it with key comparisons", () => {
    const weights = [
        ["weight-1", "2025-02-17", 15.4],
        ["weight-2", "2025-04-16", 16],
        ["weight-3", "2025-06-04", 15.8],
        ["weight-4", "2025-07-18", 16],
        ["weight-5", "2025-10-20", 16],
        ["weight-6", "2025-12-22", 15.8],
        ["weight-7", "2026-02-09", 15.4],
        ["weight-8", "2026-04-14", 15.4],
        ["weight-9", "2026-06-10", 15.2],
    ].map(([id, factDate, valueKg]) => ({
        id,
        doc_id: null,
        fact_type: "weight",
        fact_date: factDate,
        status: "verified",
        value_json: { value_kg: valueKg },
    }))

    const response = composeGroundedAnswer({
        question: "Tell me about Momo’s weight trend.",
        queryPlan: {
            intent: "weight_trend",
            subject: "weight",
            date_range: { type: "all_time", start: null, end: null },
        },
        context: {
            verifiedWeightFacts: weights,
        },
    })

    assert.match(response.answer, /^Momo’s verified weight trend is slightly downward overall\./)
    assert.match(response.answer, /Across 9 verified records/)
    assert.match(response.answer, /ranged from 15\.2 kg .* to 16 kg/)
    assert.match(response.answer, /down 0\.2 kg \(0\.44 lb\) from the first record/)
    assert.match(response.answer, /down 0\.8 kg \(1\.76 lb\) from the highest/)
    assert.match(response.answer, /4 most recent readings show a gradual downward movement/)
    assert.doesNotMatch(response.answer, /→/)
    assert.equal(response.citations.length, 9)
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

test("reports a completed governed request without reopening its draft", () => {
    const reminder = {
        id: "reminder-1",
        event_type: "reminder",
        event_date: "2026-07-22",
        status: "planned",
        details_json: {
            subtype: "Librela",
            due_date: "2026-07-29",
        },
    }
    const injection = {
        id: "injection-1",
        event_type: "injection",
        event_date: "2026-06-10",
        status: "verified",
        details_json: { subtype: "Librela" },
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
            status: "action_succeeded",
            injection,
            reminder,
            workflow: {
                state: "complete",
                external_action_status: "mock_completed",
                external_action_taken: false,
            },
        },
    })

    assert.equal(response.answer_type, "governed_action_status")
    assert.equal(response.message_draft, null)
    assert.equal(response.proposed_action, null)
    assert.match(response.answer, /test is already complete/i)
    assert.match(response.answer, /did not prepare a duplicate/i)
})

test("returns the existing approved action as a reopenable review", () => {
    const response = composeGroundedAnswer({
        question: "Prepare Momo’s Librela appointment request.",
        queryPlan: { intent: "librela_appointment_message" },
        context: {
            plannedReminders: [],
            verifiedEvents: [],
            scheduledAppointments: [],
            documents: [],
            directLibrelaCostItems: [],
            librelaVisitCostItems: [],
            verifiedWeightFacts: [],
        },
        messageDraftPreparation: {
            status: "action_approved",
            workflow: {
                governed_action_id: "action-1",
                external_action_status: "not_sent",
            },
        },
    })

    assert.equal(response.answer_type, "governed_action_status")
    assert.equal(response.review_action_id, "action-1")
    assert.match(response.answer, /still pending/i)
    assert.match(response.answer, /reopen it/i)
})

test("labels a sent outcome only as the user’s report", () => {
    const response = composeGroundedAnswer({
        question: "What happened with the Librela request?",
        queryPlan: { intent: "librela_appointment_message" },
        context: {
            plannedReminders: [],
            verifiedEvents: [],
            scheduledAppointments: [],
            documents: [],
            directLibrelaCostItems: [],
            librelaVisitCostItems: [],
            verifiedWeightFacts: [],
        },
        messageDraftPreparation: {
            status: "action_succeeded",
            workflow: {
                external_action_status: "user_reported_sent",
            },
        },
    })

    assert.match(response.answer, /You marked.*as sent/i)
    assert.match(response.answer, /not verified delivery/i)
    assert.equal(response.review_action_id, null)
})

test("composes structured attention separately from verified citations", () => {
    const item = {
        id: "document_review:doc-1",
        kind: "document_review",
        state: "needs_review",
        title: "Lab report",
        reason: "This document needs verification.",
        governing_reference: {
            table: "documents",
            record_id: "doc-1",
            trust_state: "candidate",
        },
        navigation_targets: [
            {
                kind: "open_review_document",
                label: "Review document",
                target_id: "doc-1",
            },
        ],
    }
    const response = composeGroundedAnswer({
        question: "What needs my attention?",
        queryPlan: { intent: "attention_summary" },
        context: {},
        attentionSummary: {
            status: "available",
            items: [item],
            total_qualifying_count: 1,
            sources: [
                { source: "reminders", status: "available" },
                { source: "care_actions", status: "available" },
                { source: "document_reviews", status: "available" },
            ],
        },
    })

    assert.equal(response.answer_type, "attention_summary")
    assert.deepEqual(response.attention_items, [item])
    assert.deepEqual(response.citations, [])
    assert.match(response.answer, /Lab report/)
    assert.match(response.limitations.join(" "), /candidate truth/i)
    assert.equal(response.proposed_action, null)
})

test("does not report a false clear state when attention sources are unavailable", () => {
    const response = composeGroundedAnswer({
        question: "What needs my attention?",
        queryPlan: { intent: "attention_summary" },
        context: {},
        attentionSummary: {
            status: "unavailable",
            items: [],
            total_qualifying_count: 0,
            sources: [
                { source: "reminders", status: "unavailable" },
                { source: "care_actions", status: "unavailable" },
                { source: "document_reviews", status: "unavailable" },
            ],
        },
    })

    assert.equal(response.attention_status, "unavailable")
    assert.match(response.answer, /can’t safely say that nothing needs attention/)
    assert.deepEqual(response.citations, [])
})

test("treats a missing attention summary as unavailable rather than empty", () => {
    const response = composeGroundedAnswer({
        question: "What needs my attention?",
        queryPlan: { intent: "attention_summary" },
        context: {},
        attentionSummary: null,
    })

    assert.equal(response.attention_status, "unavailable")
    assert.match(response.answer, /can’t safely say that nothing needs attention/)
})

test("explains a tomorrow-only attention result without implying current work is scheduled", () => {
    const item = {
        id: "reminder:tomorrow",
        kind: "reminder",
        state: "scheduled",
        title: "Simparica Trio",
        reason: "Simparica Trio is scheduled for confirmation during this period.",
        navigation_targets: [],
    }
    const response = composeGroundedAnswer({
        question: "Do I need to do anything tomorrow?",
        queryPlan: {
            intent: "attention_summary",
            date_range: {
                type: "next_care_day",
                label: "tomorrow",
                start: "2026-08-15",
                end: "2026-08-15",
            },
        },
        context: {},
        attentionSummary: {
            status: "available",
            items: [item],
            total_qualifying_count: 1,
            sources: [],
            date_range: {
                type: "next_care_day",
                label: "tomorrow",
                start: "2026-08-15",
                end: "2026-08-15",
            },
            current_work_included: false,
        },
    })

    assert.match(response.answer, /Tomorrow, 1 reminder is scheduled/)
    assert.match(response.limitations.join(" "), /tomorrow-only check/)
    assert.deepEqual(response.attention_items, [item])
})

test("asks a bounded follow-up for a broad care overview", () => {
    const response = composeGroundedAnswer({
        question: "What's new?",
        queryPlan: {
            intent: "semantic_clarification",
            subject: "care_overview",
        },
        context: {},
    })

    assert.equal(response.answer_type, "clarification_needed")
    assert.match(response.answer, /what needs your attention/)
    assert.match(response.answer, /recently verified/)
    assert.equal(response.proposed_action, null)
})

test("turns an unsupported question into a bounded next-choice prompt", () => {
    const response = composeGroundedAnswer({
        question: "Can you tell me something else?",
        queryPlan: { intent: "unknown" },
        context: {},
    })

    assert.equal(response.answer_type, "unsupported_question")
    assert.match(response.answer, /Would you like me to check/)
    assert.match(response.answer, /what needs your attention/)
    assert.deepEqual(response.citations, [])
})
