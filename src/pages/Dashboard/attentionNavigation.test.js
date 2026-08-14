import test from "node:test"
import assert from "node:assert/strict"
import {
    getAttentionNavigationEffect,
    GOOGLE_CALENDAR_HOME_URL,
} from "./attentionNavigation.js"

test("maps governed record targets to navigation-only effects", () => {
    assert.deepEqual(
        getAttentionNavigationEffect({
            kind: "open_reminder",
            target_id: "reminder-1",
        }),
        { type: "reminder", recordId: "reminder-1" }
    )
    assert.deepEqual(
        getAttentionNavigationEffect({
            kind: "open_care_action",
            target_id: "action-1",
        }),
        { type: "care_action", recordId: "action-1" }
    )
    assert.deepEqual(
        getAttentionNavigationEffect({
            kind: "open_review_document",
            target_id: "document-1",
        }),
        { type: "review_document", recordId: "document-1" }
    )
})

test("allows only governed Google Calendar navigation", () => {
    assert.deepEqual(
        getAttentionNavigationEffect({
            kind: "open_calendar_event",
            url: "https://calendar.google.com/calendar/event?eid=trusted",
        }),
        {
            type: "external_url",
            url: "https://calendar.google.com/calendar/event?eid=trusted",
        }
    )
    assert.deepEqual(
        getAttentionNavigationEffect({
            kind: "open_calendar_home",
            url: GOOGLE_CALENDAR_HOME_URL,
        }),
        { type: "external_url", url: GOOGLE_CALENDAR_HOME_URL }
    )
})

test("rejects unknown, mutation-like, incomplete, and untrusted targets", () => {
    const rejected = [
        null,
        { kind: "approve_care_action", target_id: "action-1" },
        { kind: "complete_reminder", target_id: "reminder-1" },
        { kind: "open_reminder", target_id: "" },
        { kind: "open_calendar_event", url: "https://example.com/calendar" },
        { kind: "open_calendar_event", url: "javascript:alert(1)" },
        {
            kind: "open_calendar_home",
            url: "https://calendar.google.com/calendar/u/0/r/week",
        },
    ]

    for (const target of rejected) {
        assert.equal(getAttentionNavigationEffect(target), null)
    }
})
