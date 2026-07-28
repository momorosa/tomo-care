import test from "node:test"
import assert from "node:assert/strict"
import {
    comparePendingActionSnapshots,
    evaluateAssistantResponse,
    isReadOnlyEvaluationBlocked,
    normalizePendingActions,
} from "./evalAssertions.js"

test("checks stable response contracts and grounded citation values", () => {
    const response = {
        answer:
            "Momo’s last verified weight was 15.2 kg on June 10, 2026.",
        answer_type: "grounded_answer",
        query_plan: { intent: "last_weight" },
        proposed_action: null,
        message_draft: null,
        citations: [
            {
                table: "facts",
                display_title: "Verified weight",
                display_value: "15.2 kg",
                display_date: "2026-06-10",
                source_title: "Verified receipt",
            },
        ],
    }

    const issues = evaluateAssistantResponse(response, {
        intent: "last_weight",
        answer_type: "grounded_answer",
        required_phrases: ["last verified weight"],
        forbidden_phrases: ["I guessed"],
        min_citations: 1,
        required_citation_display_titles: ["Verified weight"],
        required_citation_tables: ["facts"],
        min_answer_citation_values: 1,
        min_answer_citation_dates: 1,
        proposed_action: "null",
        message_draft: "null",
    })

    assert.deepEqual(issues, [])
})

test("reports response contract and grounding failures together", () => {
    const issues = evaluateAssistantResponse(
        {
            answer: "I do not know.",
            answer_type: "clarification_needed",
            query_plan: { intent: "unknown" },
            proposed_action: {},
            citations: [],
        },
        {
            intent: "last_weight",
            answer_type: "grounded_answer",
            required_phrases: ["verified weight"],
            min_citations: 1,
            min_answer_citation_dates: 1,
            proposed_action: "null",
            message_draft: "present",
        }
    )

    assert.ok(issues.length >= 7)
    assert.ok(issues.some((issue) => issue.includes("Expected intent")))
    assert.ok(issues.some((issue) => issue.includes("citation date")))
})

test("checks nested draft delivery fields without executing anything", () => {
    const issues = evaluateAssistantResponse(
        {
            answer: "I prepared an editable draft. Nothing was sent.",
            answer_type: "message_draft_prepared",
            query_plan: { intent: "librela_appointment_message" },
            proposed_action: null,
            message_draft: {
                delivery: {
                    status: "not_sent",
                    send_available: false,
                },
            },
            citations: [],
        },
        {
            proposed_action: "null",
            message_draft: "present",
            required_path_values: {
                "message_draft.delivery.status": "not_sent",
                "message_draft.delivery.send_available": false,
            },
        }
    )

    assert.deepEqual(issues, [])
})

test("supports state-aware alternatives while preserving draft safety", () => {
    const issues = evaluateAssistantResponse(
        {
            answer:
                "I did not prepare another request because an appointment exists.",
            answer_type: "grounded_answer",
            proposed_action: null,
            message_draft: null,
            citations: [],
        },
        {
            answer_type_any_of: [
                "message_draft_prepared",
                "grounded_answer",
            ],
            required_any_phrases: [
                "prepared a Librela appointment request",
                "did not prepare another request",
            ],
            if_present_path_values: {
                "message_draft.delivery.status": "not_sent",
                "message_draft.delivery.send_available": false,
            },
        }
    )

    assert.deepEqual(issues, [])
})

test("normalizes pending actions before comparing snapshots", () => {
    const actions = [
        { id: "b", status: "approved", ignored: true },
        { id: "a", status: "proposed" },
    ]

    assert.deepEqual(normalizePendingActions(actions), [
        { id: "a", status: "proposed" },
        { id: "b", status: "approved" },
    ])
    assert.deepEqual(
        comparePendingActionSnapshots(actions, [...actions].reverse()),
        []
    )
})

test("detects any pending care-action ledger change", () => {
    const issues = comparePendingActionSnapshots(
        [{ id: "a", status: "proposed" }],
        [
            { id: "a", status: "proposed" },
            { id: "b", status: "proposed" },
        ]
    )

    assert.equal(issues.length, 3)
    assert.match(issues[0], /ledger changed/)
})

test("blocks definitive care actions in read-only eval mode", () => {
    assert.equal(
        isReadOnlyEvaluationBlocked({
            evaluationMode: "read_only",
            queryPlan: {
                intent: "home_medication_given_action",
                action: {
                    medication_subject: "simparica_trio",
                    administered_date: "2026-07-26",
                    issue: null,
                },
            },
        }),
        true
    )

    assert.equal(
        isReadOnlyEvaluationBlocked({
            evaluationMode: "read_only",
            queryPlan: {
                intent: "home_medication_given_action",
                action: {
                    medication_subject: "simparica_trio",
                    administered_date: null,
                    issue: "missing_date",
                },
            },
        }),
        false
    )

    assert.equal(
        isReadOnlyEvaluationBlocked({
            evaluationMode: undefined,
            queryPlan: {
                intent: "home_medication_given_action",
                action: { issue: null },
            },
        }),
        false
    )
})