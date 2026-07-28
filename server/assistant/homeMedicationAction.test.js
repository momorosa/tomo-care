import test from "node:test"
import assert from "node:assert/strict"
import {
    parseHomeMedicationActionRequest,
    prepareAssistantHomeMedicationAction,
} from "./homeMedicationAction.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const CURRENT_CARE_DATE = "2026-07-26"

function buildReminder({
    id = "11111111-1111-4111-8111-111111111111",
    careItem = "Simparica Trio",
    careCategory = "at_home_medication",
    eventDate = "2026-08-16",
    lastAdministeredDate = "2026-07-20",
    cadenceDays = 30,
} = {}) {
    return {
        id,
        pet_id: PET_ID,
        event_type: "reminder",
        event_date: eventDate,
        status: "planned",
        updated_at: "2026-07-20T19:00:00.000Z",
        details_json: {
            care_item: careItem,
            care_category: careCategory,
            reminder_type: "home_medication",
            cadence_days: cadenceDays,
            last_administered_date: lastAdministeredDate,
            preferred_admin_day: "Monday",
            reminder_days_before: 1,
            requires_appointment: false,
            route:
                careCategory === "at_home_injection"
                    ? "subcutaneous injection"
                    : "oral chewable",
            administered_by: "Rosa",
        },
    }
}

function buildRepository({ reminder = buildReminder() } = {}) {
    const calls = {
        findReminder: [],
        findActiveActionByIdempotencyKey: [],
        insertProposedAction: [],
    }

    return {
        calls,
        async findReminder(args) {
            calls.findReminder.push(args)
            return reminder
        },
        async findActiveActionByIdempotencyKey(key) {
            calls.findActiveActionByIdempotencyKey.push(key)
            return null
        },
        async insertProposedAction(proposal) {
            calls.insertProposedAction.push(proposal)
            return {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                ...proposal,
            }
        },
    }
}

function buildPlan(question) {
    return {
        action: parseHomeMedicationActionRequest(question, {
            currentCareDate: CURRENT_CARE_DATE,
        }),
    }
}

test("parses Simparica today as a medication action request", () => {
    const action = parseHomeMedicationActionRequest(
        "I gave Simparica today.",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action.medication_subject, "simparica_trio")
    assert.equal(action.administered_date, "2026-07-26")
    assert.equal(action.issue, null)
})

test("parses Adequan yesterday using the app care date", () => {
    const action = parseHomeMedicationActionRequest(
        "I administered Adequan yesterday.",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action.medication_subject, "adequan")
    assert.equal(action.administered_date, "2026-07-25")
    assert.equal(action.issue, null)
})

test("keeps a factual question out of the action path", () => {
    const action = parseHomeMedicationActionRequest(
        "Did I give Adequan yesterday?",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action, null)
})

test("requires clarification for uncertain wording", () => {
    const action = parseHomeMedicationActionRequest(
        "I think I gave Simparica today.",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action.issue, "uncertain_statement")
})

test("requires a date before preparing", () => {
    const action = parseHomeMedicationActionRequest(
        "I gave Simparica.",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action.medication_subject, "simparica_trio")
    assert.equal(action.administered_date, null)
    assert.equal(action.issue, "missing_date")
})

test("requires clarification when the statement contains two dates", () => {
    const action = parseHomeMedicationActionRequest(
        "I gave Simparica today, not yesterday.",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action.administered_date, null)
    assert.equal(action.issue, "ambiguous_date")
})

test("accepts an explicit calendar date", () => {
    const action = parseHomeMedicationActionRequest(
        "Record that I gave Adequan on July 25, 2026.",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action.medication_subject, "adequan")
    assert.equal(action.administered_date, "2026-07-25")
    assert.equal(action.issue, null)
})

test("does not route unsupported medication into the governed action", () => {
    const action = parseHomeMedicationActionRequest(
        "I gave Metacam today.",
        { currentCareDate: CURRENT_CARE_DATE }
    )

    assert.equal(action.issue, "unsupported_medication")
})

test("prepares a proposal from the matching trusted reminder only", async () => {
    const reminder = buildReminder()
    const repository = buildRepository({ reminder })
    const result = await prepareAssistantHomeMedicationAction({
        repository,
        petId: PET_ID,
        queryPlan: buildPlan("I gave Simparica today."),
        context: {
            homeMedicationReminders: [reminder],
        },
        requestedBy: "Rosa",
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "prepared")
    assert.equal(result.action.status, "proposed")
    assert.equal(result.action.request_source, "assistant")
    assert.equal(result.action.preview_json.administered_date, "2026-07-26")
    assert.equal(repository.calls.insertProposedAction.length, 1)
})

test("prepares Adequan through the same reusable action contract", async () => {
    const reminder = buildReminder({
        id: "22222222-2222-4222-8222-222222222222",
        careItem: "Adequan",
        careCategory: "at_home_injection",
        eventDate: "2026-08-30",
        lastAdministeredDate: "2026-07-06",
        cadenceDays: 56,
    })
    const repository = buildRepository({ reminder })
    const result = await prepareAssistantHomeMedicationAction({
        repository,
        petId: PET_ID,
        queryPlan: buildPlan("I gave Adequan yesterday."),
        context: {
            homeMedicationReminders: [reminder],
        },
        requestedBy: "Rosa",
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "prepared")
    assert.equal(result.action.payload_json.care_item, "Adequan")
    assert.equal(result.action.payload_json.administered_date, "2026-07-25")
    assert.equal(repository.calls.insertProposedAction.length, 1)
})

test("clarification paths never read or write the action repository", async () => {
    const repository = buildRepository()
    const result = await prepareAssistantHomeMedicationAction({
        repository,
        petId: PET_ID,
        queryPlan: buildPlan("I gave Simparica."),
        context: {
            homeMedicationReminders: [buildReminder()],
        },
        requestedBy: "Rosa",
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "missing_date")
    assert.equal(repository.calls.findReminder.length, 0)
    assert.equal(repository.calls.insertProposedAction.length, 0)
})

test("does not prepare when no matching planned reminder exists", async () => {
    const repository = buildRepository()
    const result = await prepareAssistantHomeMedicationAction({
        repository,
        petId: PET_ID,
        queryPlan: buildPlan("I gave Simparica today."),
        context: {
            homeMedicationReminders: [
                buildReminder({
                    careItem: "Adequan",
                    careCategory: "at_home_injection",
                }),
            ],
        },
        requestedBy: "Rosa",
        currentCareDate: CURRENT_CARE_DATE,
    })

    assert.equal(result.status, "reminder_not_found")
    assert.equal(repository.calls.findReminder.length, 0)
    assert.equal(repository.calls.insertProposedAction.length, 0)
})