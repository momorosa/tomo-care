import test from "node:test"
import assert from "node:assert/strict"
import {
    MARK_HOME_MEDICATION_GIVEN,
    buildMarkHomeMedicationGivenProposal,
    getPreferredDateOnOrBefore,
} from "./homeMedicationGiven.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

function buildReminder(overrides = {}) {
    return {
        id: "11111111-1111-4111-8111-111111111111",
        pet_id: PET_ID,
        event_type: "reminder",
        event_date: "2026-07-19",
        status: "planned",
        updated_at: "2026-07-06T12:00:00.000Z",
        details_json: {
            care_item: "Simparica Trio",
            care_category: "at_home_medication",
            reminder_type: "home_medication",
            cadence_days: 30,
            last_administered_date: "2026-06-22",
            due_date: "2026-07-22",
            target_admin_date: "2026-07-20",
            preferred_admin_day: "Monday",
            reminder_days_before: 1,
            requires_appointment: false,
            route: "oral chewable",
            administered_by: "Rosa",
        },
        ...overrides,
    }
}

function buildProposal(overrides = {}) {
    return buildMarkHomeMedicationGivenProposal({
        petId: PET_ID,
        reminder: buildReminder(),
        administeredDate: "2026-07-20",
        currentCareDate: "2026-07-20",
        requestSource: "dashboard",
        requestedBy: "Rosa",
        ...overrides,
    })
}

test("builds the complete Simparica action contract without mutating the reminder", () => {
    const reminder = buildReminder()
    const reminderBefore = structuredClone(reminder)
    const proposal = buildProposal({ reminder })

    assert.deepEqual(reminder, reminderBefore)
    assert.equal(proposal.action_type, MARK_HOME_MEDICATION_GIVEN)
    assert.equal(proposal.status, "proposed")
    assert.equal(proposal.source_event_id, reminder.id)
    assert.equal(proposal.payload_json.administered_date, "2026-07-20")
    assert.equal(proposal.payload_json.next_due_date, "2026-08-19")
    assert.equal(proposal.payload_json.next_target_admin_date, "2026-08-17")
    assert.equal(proposal.payload_json.next_reminder_date, "2026-08-16")
    assert.equal(proposal.preview_json.changes.length, 3)
    assert.equal(proposal.evidence_json[0].id, reminder.id)
})

test("calculates the next Adequan cycle when the due date is already Monday", () => {
    const reminder = buildReminder({
        id: "22222222-2222-4222-8222-222222222222",
        event_date: "2026-08-30",
        details_json: {
            care_item: "Adequan",
            care_category: "at_home_injection",
            reminder_type: "home_medication",
            cadence_days: 56,
            last_administered_date: "2026-07-06",
            due_date: "2026-08-31",
            target_admin_date: "2026-08-31",
            preferred_admin_day: "Monday",
            reminder_days_before: 1,
            requires_appointment: false,
            route: "injection",
            administered_by: "Rosa",
        },
    })

    const proposal = buildProposal({
        reminder,
        administeredDate: "2026-08-31",
        currentCareDate: "2026-08-31",
    })

    assert.equal(proposal.payload_json.next_due_date, "2026-10-26")
    assert.equal(proposal.payload_json.next_target_admin_date, "2026-10-26")
    assert.equal(proposal.payload_json.next_reminder_date, "2026-10-25")
})

test("uses the preferred weekday on or before the cadence due date", () => {
    assert.equal(
        getPreferredDateOnOrBefore({
            dueDate: "2026-08-19",
            preferredDay: "Monday",
        }),
        "2026-08-17"
    )
    assert.equal(
        getPreferredDateOnOrBefore({
            dueDate: "2026-10-26",
            preferredDay: "Monday",
        }),
        "2026-10-26"
    )
})

test("creates a stable semantic idempotency key", () => {
    const first = buildProposal()
    const second = buildProposal()

    assert.equal(first.idempotency_key, second.idempotency_key)
    assert.equal(
        first.idempotency_key,
        `mark_home_medication_given:${PET_ID}:11111111-1111-4111-8111-111111111111:2026-07-20`
    )
})

test("rejects reminders from a different pet", () => {
    assert.throws(
        () =>
            buildProposal({
                reminder: buildReminder({
                    pet_id: "33333333-3333-4333-8333-333333333333",
                }),
            }),
        /does not belong to this pet/
    )
})

test("rejects reminders that are not planned home-medication care", () => {
    assert.throws(
        () => buildProposal({ reminder: buildReminder({ status: "completed" }) }),
        /Only a planned reminder/
    )

    assert.throws(
        () =>
            buildProposal({
                reminder: buildReminder({
                    details_json: {
                        ...buildReminder().details_json,
                        reminder_type: "insurance_claim",
                    },
                }),
            }),
        /not a home-medication reminder/
    )
})

test("rejects future or duplicate administration dates", () => {
    assert.throws(
        () =>
            buildProposal({
                administeredDate: "2026-07-21",
                currentCareDate: "2026-07-20",
            }),
        /cannot be in the future/
    )

    assert.throws(
        () => buildProposal({ administeredDate: "2026-06-22" }),
        /must be after the last verified administration/
    )
})

test("rejects incomplete scheduling rules instead of inventing them", () => {
    assert.throws(
        () =>
            buildProposal({
                reminder: buildReminder({
                    details_json: {
                        ...buildReminder().details_json,
                        cadence_days: null,
                    },
                }),
            }),
        /cadence_days must be a positive integer/
    )
})