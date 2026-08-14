import test from "node:test"
import assert from "node:assert/strict"
import {
    buildAttentionSummary,
    buildDocumentReviewAttentionItem,
    buildReminderAttentionItem,
    GOOGLE_CALENDAR_HOME_URL,
    MAX_ATTENTION_ITEMS,
} from "./attentionService.js"

const PET_ID = "pet-1"
const CURRENT_CARE_DATE = "2026-08-14"

test("ranks mixed governed sources deterministically and returns at most five", async () => {
    const repository = buildRepository({
        reminders: [
            buildHomeMedicationReminder({
                id: "reminder-overdue",
                eventDate: "2026-08-01",
                targetDate: "2026-08-02",
            }),
            buildInsuranceReminder({ id: "reminder-due" }),
        ],
        actions: [
            buildAction("action-proposed", "proposed"),
            buildAction("action-approved", "approved"),
            buildAction("action-executing", "executing"),
            buildAction("action-unknown", "outcome_unknown"),
        ],
        documents: [buildReviewDocument("document-review")],
    })

    const result = await buildAttentionSummary({
        repository,
        petId: PET_ID,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "available")
    assert.equal(result.total_qualifying_count, 7)
    assert.equal(result.items.length, MAX_ATTENTION_ITEMS)
    assert.deepEqual(
        result.items.map((item) => item.id),
        [
            "care_action:action-unknown",
            "care_action:action-executing",
            "reminder:reminder-overdue",
            "care_action:action-approved",
            "reminder:reminder-due",
        ]
    )
})

test("qualifies the Librela reminder on the day its reminder window opens", () => {
    const item = buildReminderAttentionItem(
        {
            id: "librela-reminder",
            event_type: "reminder",
            event_date: CURRENT_CARE_DATE,
            status: "planned",
            details_json: {
                subtype: "Librela",
                due_date: "2026-08-21",
            },
        },
        CURRENT_CARE_DATE
    )

    assert.equal(item.state, "due_now")
    assert.match(item.reason, /reminder window is open/)
})

test("keeps upcoming and unsupported reminders out of attention", () => {
    const upcoming = buildHomeMedicationReminder({
        id: "upcoming",
        eventDate: "2026-08-20",
        targetDate: "2026-08-21",
    })
    const unsupported = {
        id: "unsupported",
        event_type: "reminder",
        event_date: "2026-08-01",
        status: "planned",
        details_json: { subtype: "Unknown" },
    }

    assert.equal(
        buildReminderAttentionItem(upcoming, CURRENT_CARE_DATE),
        null
    )
    assert.equal(
        buildReminderAttentionItem(unsupported, CURRENT_CARE_DATE),
        null
    )
})

test("uses stored Google Calendar events and falls back honestly to Calendar home", () => {
    const stored = buildReminderAttentionItem(
        buildHomeMedicationReminder({
            id: "stored-link",
            calendarUrl:
                "https://www.google.com/calendar/event?eid=trusted-event",
        }),
        CURRENT_CARE_DATE
    )
    const missing = buildReminderAttentionItem(
        buildHomeMedicationReminder({ id: "missing-link" }),
        CURRENT_CARE_DATE
    )
    const untrusted = buildReminderAttentionItem(
        buildHomeMedicationReminder({
            id: "untrusted-link",
            calendarUrl: "https://example.com/not-calendar",
        }),
        CURRENT_CARE_DATE
    )

    assert.equal(stored.navigation_targets[1].kind, "open_calendar_event")
    assert.equal(missing.navigation_targets[1].kind, "open_calendar_home")
    assert.equal(missing.navigation_targets[1].url, GOOGLE_CALENDAR_HOME_URL)
    assert.equal(untrusted.navigation_targets[1].kind, "open_calendar_home")
})

test("identifies expired insurance work without calling it a completed claim", () => {
    const item = buildReminderAttentionItem(
        buildInsuranceReminder({
            id: "expired-claim",
            deadlineDate: "2026-08-13",
        }),
        CURRENT_CARE_DATE
    )

    assert.equal(item.state, "expired")
    assert.match(item.reason, /final filing deadline was August 13, 2026/)
    assert.doesNotMatch(item.reason, /filed|completed/)
})

test("uses review-document metadata without exposing candidate extraction", () => {
    const document = {
        ...buildReviewDocument("document-1"),
        text_extracted: {
            unverified_diagnosis: "must never be returned",
        },
    }

    const item = buildDocumentReviewAttentionItem(document)
    const serialized = JSON.stringify(item)

    assert.equal(item.governing_reference.trust_state, "candidate")
    assert.match(item.reason, /needs verification/)
    assert.doesNotMatch(serialized, /diagnosis|must never be returned/)
})

test("discloses one unavailable source while returning available attention", async () => {
    const repository = buildRepository({
        reminders: [buildHomeMedicationReminder({ id: "reminder-1" })],
        actionsError: new Error("care actions unavailable"),
    })

    const result = await buildAttentionSummary({
        repository,
        petId: PET_ID,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "partial")
    assert.equal(result.items.length, 1)
    assert.deepEqual(result.sources, [
        { source: "reminders", status: "available" },
        { source: "care_actions", status: "unavailable" },
        { source: "document_reviews", status: "available" },
    ])
})

test("returns unavailable rather than a false clear state when every source fails", async () => {
    const repository = buildRepository({
        remindersError: new Error("reminders unavailable"),
        actionsError: new Error("actions unavailable"),
        documentsError: new Error("documents unavailable"),
    })

    const result = await buildAttentionSummary({
        repository,
        petId: PET_ID,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "unavailable")
    assert.deepEqual(result.items, [])
    assert.equal(
        result.sources.every((source) => source.status === "unavailable"),
        true
    )
})

test("uses stable record identity to break otherwise equal ties", async () => {
    const repository = buildRepository({
        documents: [
            buildReviewDocument("document-b"),
            buildReviewDocument("document-a"),
        ],
    })

    const result = await buildAttentionSummary({
        repository,
        petId: PET_ID,
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.deepEqual(
        result.items.map((item) => item.id),
        ["document_review:document-a", "document_review:document-b"]
    )
})

test("returns only scheduled reminders for a tomorrow-only attention window", async () => {
    const repository = buildRepository({
        reminders: [
            buildHomeMedicationReminder({
                id: "current-reminder",
                eventDate: "2026-08-13",
                targetDate: "2026-08-14",
            }),
            buildHomeMedicationReminder({
                id: "tomorrow-reminder",
                eventDate: "2026-08-15",
                targetDate: "2026-08-16",
            }),
        ],
        actions: [buildAction("current-action", "proposed")],
        documents: [buildReviewDocument("current-document")],
    })

    const result = await buildAttentionSummary({
        repository,
        petId: PET_ID,
        currentCareDate: CURRENT_CARE_DATE,
        dateRange: {
            type: "next_care_day",
            label: "tomorrow",
            start: "2026-08-15",
            end: "2026-08-15",
        },
    })

    assert.equal(result.current_work_included, false)
    assert.deepEqual(
        result.items.map((item) => item.id),
        ["reminder:tomorrow-reminder"]
    )
    assert.equal(result.items[0].state, "scheduled")
    assert.equal(
        result.items[0].reason,
        "Simparica Trio is due by August 16, 2026, and its reminder appears on August 15, 2026 so you can confirm it was given."
    )
})

test("combines current work with reminders becoming active this week", async () => {
    const repository = buildRepository({
        reminders: [
            buildHomeMedicationReminder({
                id: "current-reminder",
                eventDate: "2026-08-13",
                targetDate: "2026-08-14",
            }),
            buildInsuranceReminder({
                id: "weekend-claim",
                targetDate: "2026-08-16",
                deadlineDate: "2026-09-01",
            }),
        ],
        actions: [buildAction("current-action", "proposed")],
        documents: [buildReviewDocument("current-document")],
    })

    const result = await buildAttentionSummary({
        repository,
        petId: PET_ID,
        currentCareDate: CURRENT_CARE_DATE,
        dateRange: {
            type: "current_week",
            label: "this week",
            start: "2026-08-14",
            end: "2026-08-16",
        },
    })

    assert.equal(result.current_work_included, true)
    assert.deepEqual(
        result.items.map((item) => item.id),
        [
            "reminder:current-reminder",
            "reminder:weekend-claim",
            "care_action:current-action",
            "document_review:current-document",
        ]
    )
    assert.equal(result.items[1].state, "scheduled")
})

function buildRepository({
    reminders = [],
    actions = [],
    documents = [],
    remindersError = null,
    actionsError = null,
    documentsError = null,
} = {}) {
    return {
        async findPlannedRemindersByPetId() {
            if (remindersError) throw remindersError
            return reminders
        },
        async findAttentionCareActionsByPetId() {
            if (actionsError) throw actionsError
            return actions
        },
        async findReviewDocumentsByPetId() {
            if (documentsError) throw documentsError
            return documents
        },
    }
}

function buildHomeMedicationReminder({
    id,
    eventDate = "2026-08-13",
    targetDate = CURRENT_CARE_DATE,
    calendarUrl = null,
} = {}) {
    return {
        id,
        doc_id: "doc-source",
        event_type: "reminder",
        event_date: eventDate,
        status: "planned",
        created_at: "2026-08-01T12:00:00.000Z",
        details_json: {
            reminder_type: "home_medication",
            care_item: "Simparica Trio",
            target_admin_date: targetDate,
            external_refs: calendarUrl
                ? { google_calendar_html_link: calendarUrl }
                : {},
        },
    }
}

function buildInsuranceReminder({
    id,
    targetDate = "2026-08-01",
    deadlineDate = "2026-08-30",
} = {}) {
    return {
        id,
        event_type: "reminder",
        event_date: targetDate,
        status: "planned",
        created_at: "2026-08-01T12:00:00.000Z",
        details_json: {
            subtype: "Insurance claim",
            target_submit_date: targetDate,
            claim_deadline_date: deadlineDate,
        },
    }
}

function buildAction(id, status) {
    return {
        id,
        action_type: "mark_home_medication_given",
        status,
        preview_json: { care_item: "Adequan" },
        proposed_at: "2026-08-10T12:00:00.000Z",
        approved_at: "2026-08-11T12:00:00.000Z",
        execution_started_at: "2026-08-12T12:00:00.000Z",
        created_at: "2026-08-10T12:00:00.000Z",
    }
}

function buildReviewDocument(id) {
    return {
        id,
        title: "Momo visit receipt",
        doc_type: "receipt",
        doc_date: "2026-08-10",
        status: "needs_review",
        created_at: "2026-08-10T12:00:00.000Z",
    }
}
