import test from "node:test"
import assert from "node:assert/strict"
import {
    getNextConversationContext,
    sanitizeConversationContext,
} from "./conversationContext.js"

test("accepts only one bounded supported care context", () => {
    assert.deepEqual(
        sanitizeConversationContext({
            intent: "last_librela",
            subject: "librela",
            answer: "private answer must not be carried",
            citations: [{ id: "record-1" }],
        }),
        {
            intent: "last_librela",
            subject: "librela",
        }
    )
})

test("allows only a bounded missing-detail context for a governed action", () => {
    assert.deepEqual(
        sanitizeConversationContext({
            intent: "home_medication_given_action",
            subject: "simparica_trio",
            pending_detail: "administration_date",
            administered_date: "must-not-be-carried",
            action: { id: "must-not-be-carried" },
        }),
        {
            intent: "home_medication_given_action",
            subject: "simparica_trio",
            pending_detail: "administration_date",
        }
    )
    assert.equal(
        sanitizeConversationContext({
            intent: "home_medication_given_action",
            subject: "simparica_trio",
        }),
        null
    )
    assert.equal(
        sanitizeConversationContext({
            intent: "last_librela",
            subject: "unknown_medication",
        }),
        null
    )
})

test("replaces a stale schedule context while an administration date is unresolved", () => {
    assert.deepEqual(
        getNextConversationContext({
            queryPlan: {
                intent: "home_medication_given_action",
                subject: "adequan",
                action: {
                    issue: "missing_date",
                },
            },
            previousContext: {
                intent: "home_medication_due",
                subject: "adequan",
            },
        }),
        {
            intent: "home_medication_given_action",
            subject: "adequan",
            pending_detail: "administration_date",
        }
    )
})

test("clears the clarification context once every action detail is explicit", () => {
    assert.equal(
        getNextConversationContext({
            queryPlan: {
                intent: "home_medication_given_action",
                subject: "adequan",
                action: {
                    issue: null,
                },
            },
            previousContext: {
                intent: "home_medication_given_action",
                subject: "adequan",
                pending_detail: "administration_date",
            },
        }),
        null
    )
})

test("preserves the prior care context through a social turn", () => {
    assert.deepEqual(
        getNextConversationContext({
            queryPlan: {
                intent: "social_response",
                subject: "thanks",
            },
            previousContext: {
                intent: "last_librela",
                subject: "librela",
            },
        }),
        {
            intent: "last_librela",
            subject: "librela",
        }
    )
})

test("carries only the bounded attention intent for a time-window follow-up", () => {
    assert.deepEqual(
        sanitizeConversationContext({
            intent: "attention_summary",
            subject: "attention",
            attention_items: [{ id: "must-not-be-carried" }],
        }),
        {
            intent: "attention_summary",
            subject: "attention",
        }
    )
})
