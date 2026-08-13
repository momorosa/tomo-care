import assert from "node:assert/strict"
import test from "node:test"

import { approveCareAction } from "../actions/approveCareAction.js"
import {
    ActionExecutionError,
    executeCareAction,
} from "../actions/executeCareAction.js"
import { answerAssistantQuestion } from "../assistant/assistantService.js"
import { buildTrustedContextFromRows } from "../assistant/trustedContext.js"
import {
    buildHomeMedicationCalendarDescription,
    getStableGoogleCalendarEventId,
} from "../calendar/reminderCalendar.js"
import {
    DEFAULT_APP_TIME_ZONE,
    getCareDate,
} from "../lib/careDates.js"
import { getCompactReminderPresentation } from "../../src/pages/Dashboard/reminderPresentation.js"
import {
    HOME_MEDICATION_PET_ID,
    HOME_MEDICATION_RULES,
    LIBRELA_SENTINEL,
    buildHomeMedicationReminder,
} from "./fixtures/homeMedicationRules.js"

function clone(value) {
    return structuredClone(value)
}

function createState(rule) {
    return {
        careDate: rule.initialCareDate,
        events: [
            buildHomeMedicationReminder(rule),
            clone(LIBRELA_SENTINEL),
        ],
        careActions: [],
        calendarEvents: new Map(),
        calendarCalls: { inserts: 0, updates: 0 },
        transactionCalls: 0,
    }
}

function createRepository(state, rule) {
    let actionRevision = 0

    function nextActionRevision() {
        actionRevision += 1
        return new Date(
            Date.parse(rule.overdueNow) + actionRevision * 1000
        ).toISOString()
    }

    return {
        async findReminder({ petId, reminderId }) {
            return (
                state.events.find(
                    (event) =>
                        event.id === reminderId && event.pet_id === petId
                ) || null
            )
        },

        async findActiveActionByIdempotencyKey(idempotencyKey) {
            return (
                state.careActions.find(
                    (action) =>
                        action.idempotency_key === idempotencyKey &&
                        action.status !== "cancelled"
                ) || null
            )
        },

        async insertProposedAction(proposal) {
            const action = {
                id: rule.actionId,
                proposed_at: rule.overdueNow,
                approved_at: null,
                approved_by: null,
                result_json: null,
                updated_at: nextActionRevision(),
                ...clone(proposal),
            }
            state.careActions.push(action)
            return action
        },

        async findActionById(actionId) {
            return (
                state.careActions.find(
                    (action) => action.id === actionId
                ) || null
            )
        },

        async approveProposedAction({
            actionId,
            approvedBy,
            approvedAt,
            expectedUpdatedAt,
        }) {
            const action = state.careActions.find(
                (candidate) => candidate.id === actionId
            )

            if (
                !action ||
                action.status !== "proposed" ||
                action.updated_at !== expectedUpdatedAt
            ) {
                return null
            }

            Object.assign(action, {
                status: "approved",
                approved_by: approvedBy,
                approved_at: approvedAt,
                updated_at: nextActionRevision(),
            })
            return action
        },

        async executeMarkHomeMedicationGiven({
            actionId,
            executedBy,
            careDate,
        }) {
            state.transactionCalls += 1

            const action = state.careActions.find(
                (candidate) => candidate.id === actionId
            )

            if (action?.status === "succeeded") {
                return {
                    disposition: "existing",
                    action_id: action.id,
                    status: action.status,
                    result: clone(action.result_json),
                }
            }

            assert.equal(action?.status, "approved")
            assert.equal(executedBy, "tomo-care-backend")
            assert.equal(careDate, rule.overdueCareDate)

            const payload = action.payload_json
            const sourceReminder = state.events.find(
                (event) => event.id === payload.source_reminder_id
            )

            assert.equal(sourceReminder?.status, "planned")
            assert.equal(
                sourceReminder.updated_at,
                payload.source_reminder_updated_at
            )
            assert.equal(
                sourceReminder.details_json?.care_item,
                payload.care_item
            )

            const administrationEvent = {
                id: rule.administrationEventId,
                pet_id: action.pet_id,
                doc_id: null,
                event_type: "medication_administration",
                event_date: payload.administered_date,
                status: "verified",
                details_json: {
                    care_item: payload.care_item,
                    care_category: payload.care_category,
                    cadence_days: payload.cadence_days,
                    requires_appointment: false,
                    route: payload.route,
                    administered_by: payload.administered_by,
                    source: "owner_confirmation",
                    preferred_admin_day: payload.preferred_admin_day,
                    reminder_days_before: payload.reminder_days_before,
                    care_action_id: action.id,
                    execution_actor: executedBy,
                },
                created_at: rule.overdueNow,
                updated_at: rule.overdueNow,
            }
            state.events.push(administrationEvent)

            sourceReminder.status = "completed"
            sourceReminder.details_json = {
                ...sourceReminder.details_json,
                completed_at: rule.overdueNow,
                completed_by: executedBy,
                completion_action_id: action.id,
                administration_event_id: administrationEvent.id,
            }
            sourceReminder.updated_at = rule.overdueNow

            const nextCandidates = state.events.filter(
                (event) =>
                    event.pet_id === action.pet_id &&
                    event.event_type === "reminder" &&
                    event.status === "planned" &&
                    event.details_json?.reminder_type ===
                        "home_medication" &&
                    event.details_json?.care_item?.toLowerCase() ===
                        payload.care_item.toLowerCase()
            )

            if (nextCandidates.length > 1) {
                throw new Error(
                    "ambiguous_next_reminder: multiple planned reminders already exist"
                )
            }

            const nextDetails = clone(sourceReminder.details_json)
            for (const field of [
                "external_refs",
                "completed_at",
                "completed_by",
                "completion_action_id",
                "administration_event_id",
            ]) {
                delete nextDetails[field]
            }
            Object.assign(nextDetails, {
                last_administered_date: payload.administered_date,
                due_date: payload.next_due_date,
                target_admin_date: payload.next_target_admin_date,
                source: "approved_action",
                source_action_id: action.id,
                created_from: "mark_home_medication_given",
                calendar_sync_status: "not_synced",
                timing_state:
                    payload.next_reminder_date <= careDate
                        ? "due_now"
                        : "upcoming",
            })

            let nextReminder = nextCandidates[0]
            if (nextReminder) {
                Object.assign(nextReminder, {
                    doc_id: null,
                    event_date: payload.next_reminder_date,
                    status: "planned",
                    details_json: nextDetails,
                    updated_at: rule.overdueNow,
                })
            } else {
                nextReminder = {
                    id: rule.nextReminderId,
                    pet_id: action.pet_id,
                    doc_id: null,
                    event_type: "reminder",
                    event_date: payload.next_reminder_date,
                    status: "planned",
                    details_json: nextDetails,
                    created_at: rule.overdueNow,
                    updated_at: rule.overdueNow,
                }
                state.events.push(nextReminder)
            }

            const result = {
                schema_version: 1,
                execution_actor: executedBy,
                administration_event_id: administrationEvent.id,
                administration_date: payload.administered_date,
                completed_reminder_id: sourceReminder.id,
                next_reminder_id: nextReminder.id,
                next_reminder_date: payload.next_reminder_date,
                next_target_admin_date: payload.next_target_admin_date,
                next_due_date: payload.next_due_date,
            }

            Object.assign(action, {
                status: "succeeded",
                executed_at: rule.overdueNow,
                result_json: result,
                updated_at: nextActionRevision(),
            })

            return {
                disposition: "executed",
                action_id: action.id,
                status: action.status,
                result: clone(result),
            }
        },
    }
}

function buildContext(state) {
    return buildTrustedContextFromRows({
        petId: HOME_MEDICATION_PET_ID,
        events: state.events,
    })
}

function askTomo(state, question, repository) {
    return answerAssistantQuestion({
        petId: HOME_MEDICATION_PET_ID,
        question,
        dependencies: {
            semanticProvider: null,
            currentCareDate: state.careDate,
            buildContext: async () => buildContext(state),
            actionRepository: repository,
            personalizeAnswer: ({ response }) => response,
        },
    })
}

function syncCalendar(state, reminder, rule) {
    const stableId = getStableGoogleCalendarEventId(reminder.id)
    const existingId =
        reminder.details_json?.external_refs?.google_calendar_event_id
    const calendarEventId = existingId || stableId
    const action = state.calendarEvents.has(calendarEventId)
        ? "updated"
        : "created"

    if (action === "created") state.calendarCalls.inserts += 1
    else state.calendarCalls.updates += 1

    const calendarEvent = {
        id: calendarEventId,
        event_date: reminder.event_date,
        description: buildHomeMedicationCalendarDescription(reminder),
        htmlLink: `https://calendar.example.invalid/event/${calendarEventId}`,
    }
    state.calendarEvents.set(calendarEventId, calendarEvent)

    const callCount = state.calendarCalls.inserts + state.calendarCalls.updates
    reminder.details_json = {
        ...reminder.details_json,
        calendar_sync_status: "synced",
        external_refs: {
            google_calendar_calendar_id: "fixture-calendar",
            google_calendar_event_id: calendarEventId,
            google_calendar_html_link: calendarEvent.htmlLink,
            google_calendar_last_synced_at: new Date(
                Date.parse(rule.initialNow) + callCount * 1000
            ).toISOString(),
        },
    }
    reminder.updated_at = new Date(
        Date.parse(rule.initialNow) + callCount * 1000
    ).toISOString()

    return { action, calendarEvent }
}

function getDashboardPresentation(reminder, timingState) {
    return getCompactReminderPresentation({
        ...reminder,
        timing_state: timingState,
        google_calendar_url:
            reminder.details_json?.external_refs
                ?.google_calendar_html_link || null,
    })
}

function getMedicationEvents(state, rule, { eventType, status }) {
    return state.events.filter(
        (event) =>
            event.event_type === eventType &&
            event.status === status &&
            event.details_json?.care_item === rule.careItem
    )
}

function trustedSnapshot(state) {
    return clone(
        state.events
            .map((event) => event)
            .sort((a, b) => a.id.localeCompare(b.id))
    )
}

for (const rule of HOME_MEDICATION_RULES) {
    test(`runs the shared ${rule.careItem} lifecycle twice without duplicate trusted writes`, async () => {
        const state = createState(rule)
        const repository = createRepository(state, rule)
        const reminder = state.events.find(
            (event) => event.id === rule.reminderId
        )
        const librelaBefore = clone(
            state.events.find((event) => event.id === LIBRELA_SENTINEL.id)
        )

        assert.equal(
            getCareDate(
                new Date(rule.initialNow),
                DEFAULT_APP_TIME_ZONE
            ),
            rule.initialCareDate
        )
        assert.equal(reminder.details_json.cadence_days, rule.cadenceDays)
        assert.equal(reminder.details_json.route, rule.route)
        assert.equal(
            reminder.details_json.preferred_admin_day,
            "Monday"
        )

        const firstCalendarSync = syncCalendar(state, reminder, rule)
        const secondCalendarSync = syncCalendar(state, reminder, rule)

        assert.equal(firstCalendarSync.action, "created")
        assert.equal(secondCalendarSync.action, "updated")
        assert.equal(
            firstCalendarSync.calendarEvent.id,
            secondCalendarSync.calendarEvent.id
        )
        assert.equal(state.calendarEvents.size, 1)
        assert.deepEqual(state.calendarCalls, { inserts: 1, updates: 1 })
        assert.match(
            secondCalendarSync.calendarEvent.description,
            new RegExp(rule.careItem)
        )
        assert.match(
            secondCalendarSync.calendarEvent.description,
            new RegExp(rule.route)
        )
        assert.match(
            secondCalendarSync.calendarEvent.description,
            /Preferred day: Monday/
        )

        const upcomingCard = getDashboardPresentation(reminder, "upcoming")
        assert.equal(upcomingCard.title, rule.careItem)
        assert.equal(upcomingCard.eyebrow, rule.expectedEyebrow)
        assert.equal(upcomingCard.statusLabel, "Upcoming")
        assert.equal(upcomingCard.calendarIsSpecificEvent, true)
        assert.equal(upcomingCard.note, "Preferred day: Monday · No appointment needed")

        const scheduleAnswer = await askTomo(
            state,
            `When is ${rule.careItem} due?`,
            repository
        )
        assert.equal(scheduleAnswer.answer_type, "grounded_answer")
        assert.match(scheduleAnswer.answer, new RegExp(rule.careItem))
        assert.match(scheduleAnswer.answer, /planned reminder/)
        assert.match(scheduleAnswer.answer, /Monday/)
        assert.equal(scheduleAnswer.citations[0].id, reminder.id)

        state.careDate = getCareDate(
            new Date(rule.overdueNow),
            DEFAULT_APP_TIME_ZONE
        )
        reminder.details_json = {
            ...reminder.details_json,
            timing_state: "overdue",
        }
        reminder.updated_at = rule.overdueNow

        assert.equal(state.careDate, rule.overdueCareDate)
        assert.ok(rule.targetAdminDate < state.careDate)

        const overdueCard = getDashboardPresentation(reminder, "overdue")
        assert.equal(overdueCard.statusLabel, "Overdue")
        assert.equal(reminder.status, "planned")

        const beforeConfirmation = trustedSnapshot(state)
        const preparedByTomo = await askTomo(
            state,
            `I gave ${rule.careItem} today.`,
            repository
        )

        assert.equal(preparedByTomo.answer_type, "action_prepared")
        assert.match(preparedByTomo.answer, /Review the details/)
        assert.match(preparedByTomo.answer, /before anything changes/)
        assert.equal(preparedByTomo.proposed_action.status, "proposed")
        assert.equal(
            preparedByTomo.proposed_action.request_source,
            "assistant"
        )
        assert.equal(
            preparedByTomo.proposed_action.payload_json.cadence_days,
            rule.cadenceDays
        )
        assert.equal(
            preparedByTomo.proposed_action.payload_json.route,
            rule.route
        )
        assert.deepEqual(trustedSnapshot(state), beforeConfirmation)
        assert.equal(state.careActions.length, 1)

        await assert.rejects(
            () =>
                executeCareAction({
                    repository,
                    actionId: rule.actionId,
                    currentCareDate: state.careDate,
                }),
            (error) => {
                assert.ok(error instanceof ActionExecutionError)
                assert.equal(error.reason, "action_not_approved")
                return true
            }
        )
        assert.equal(state.transactionCalls, 0)
        assert.deepEqual(trustedSnapshot(state), beforeConfirmation)

        const preparedAgain = await askTomo(
            state,
            `I gave ${rule.careItem} today.`,
            repository
        )
        assert.equal(preparedAgain.proposed_action.id, rule.actionId)
        assert.equal(state.careActions.length, 1)
        assert.deepEqual(trustedSnapshot(state), beforeConfirmation)

        const approval = await approveCareAction({
            repository,
            actionId: rule.actionId,
            approvedBy: "Rosa",
            currentCareDate: state.careDate,
            approvedAt: rule.overdueNow,
        })
        assert.equal(approval.disposition, "approved")
        assert.equal(approval.action.status, "approved")
        assert.equal(approval.action.approved_by, "Rosa")
        assert.deepEqual(trustedSnapshot(state), beforeConfirmation)
        assert.equal(reminder.status, "planned")

        const approvalAgain = await approveCareAction({
            repository,
            actionId: rule.actionId,
            approvedBy: "Rosa",
            currentCareDate: state.careDate,
            approvedAt: rule.overdueNow,
        })
        assert.equal(approvalAgain.disposition, "existing")
        assert.deepEqual(trustedSnapshot(state), beforeConfirmation)

        const execution = await executeCareAction({
            repository,
            actionId: rule.actionId,
            currentCareDate: state.careDate,
        })
        assert.equal(execution.disposition, "executed")
        assert.equal(execution.status, "succeeded")
        assert.equal(
            execution.result.administration_event_id,
            rule.administrationEventId
        )
        assert.equal(
            execution.result.next_reminder_id,
            rule.nextReminderId
        )
        assert.equal(execution.result.next_due_date, rule.nextDueDate)
        assert.equal(
            execution.result.next_target_admin_date,
            rule.nextTargetAdminDate
        )
        assert.equal(
            execution.result.next_reminder_date,
            rule.nextReminderDate
        )
        assert.equal(state.transactionCalls, 1)
        assert.equal(reminder.status, "completed")

        const administrations = getMedicationEvents(state, rule, {
            eventType: "medication_administration",
            status: "verified",
        })
        const nextReminders = getMedicationEvents(state, rule, {
            eventType: "reminder",
            status: "planned",
        })

        assert.equal(administrations.length, 1)
        assert.equal(administrations[0].details_json.source, "owner_confirmation")
        assert.equal(administrations[0].details_json.route, rule.route)
        assert.equal(nextReminders.length, 1)
        assert.equal(nextReminders[0].id, rule.nextReminderId)
        assert.equal(nextReminders[0].event_date, rule.nextReminderDate)
        assert.equal(
            nextReminders[0].details_json.target_admin_date,
            rule.nextTargetAdminDate
        )
        assert.equal(
            nextReminders[0].details_json.due_date,
            rule.nextDueDate
        )
        assert.equal(
            nextReminders[0].details_json.calendar_sync_status,
            "not_synced"
        )

        const nextCard = getDashboardPresentation(
            nextReminders[0],
            "upcoming"
        )
        assert.equal(nextCard.title, rule.careItem)
        assert.equal(nextCard.statusLabel, "Upcoming")
        assert.equal(nextCard.calendarIsSpecificEvent, false)

        const statusAnswer = await askTomo(
            state,
            `When did I last give ${rule.careItem}?`,
            repository
        )
        assert.equal(statusAnswer.answer_type, "grounded_answer")
        assert.match(statusAnswer.answer, /last verified/i)
        assert.match(statusAnswer.answer, /next target administration date/i)
        assert.equal(statusAnswer.citations[0].id, rule.administrationEventId)
        assert.equal(statusAnswer.citations[1].id, rule.nextReminderId)

        const afterFirstExecution = trustedSnapshot(state)
        const executionAgain = await executeCareAction({
            repository,
            actionId: rule.actionId,
            currentCareDate: state.careDate,
        })
        assert.equal(executionAgain.disposition, "existing")
        assert.deepEqual(executionAgain.result, execution.result)
        assert.equal(state.transactionCalls, 1)
        assert.deepEqual(trustedSnapshot(state), afterFirstExecution)
        assert.equal(
            getMedicationEvents(state, rule, {
                eventType: "medication_administration",
                status: "verified",
            }).length,
            1
        )
        assert.equal(
            getMedicationEvents(state, rule, {
                eventType: "reminder",
                status: "planned",
            }).length,
            1
        )
        assert.deepEqual(
            state.events.find(
                (event) => event.id === LIBRELA_SENTINEL.id
            ),
            librelaBefore
        )
    })
}
