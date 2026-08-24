import { createHash } from "node:crypto"

import {
    getHomeMedicationDisplayName,
    prepareAssistantHomeMedicationAction,
} from "../assistant/homeMedicationAction.js"
import { createSpecialistRegistry } from "./specialistRegistry.js"
import { coordinateTomoSpecialist } from "./tomoManager.js"
import {
    CARE_OPERATIONS_INPUT_VERSION,
    careOperationsSpecialist,
} from "./careOperationsSpecialist.js"

const CARE_OPERATIONS_INTENTS = new Set([
    "home_medication_status",
    "home_medication_due",
    "home_medication_given_action",
])

export async function coordinateCareOperationsHandoff({
    petId,
    queryPlan,
    context,
    currentCareDate,
    requestedBy = "Rosa",
    actionRepository,
    orchestrationRepository,
    registry = createSpecialistRegistry([careOperationsSpecialist]),
    now,
}) {
    assertRequiredString(petId, "petId")
    assertRequiredString(currentCareDate, "currentCareDate")

    if (!CARE_OPERATIONS_INTENTS.has(queryPlan?.intent)) {
        return {
            status: "not_applicable",
            actionPreparation: null,
            orchestrationTrace: null,
        }
    }

    assertActionRepository(actionRepository)

    const medicationSubject = normalizeSubject(queryPlan.subject)
    const pendingActions =
        await actionRepository.findPendingActionsByPetId(petId)
    const state = buildBoundedHomeMedicationState({
        context,
        pendingActions,
        medicationSubject,
    })
    const contextFingerprint =
        buildCareOperationsContextFingerprint({
            petId,
            intent: queryPlan.intent,
            medicationSubject,
            currentCareDate,
            request: queryPlan.action || null,
            state,
        })
    const specialistState = {
        ...state,
        context_fingerprint: contextFingerprint,
    }
    const specialistInput = {
        schema_version: CARE_OPERATIONS_INPUT_VERSION,
        intent: queryPlan.intent,
        pet_id: petId,
        medication_subject: medicationSubject,
        display_name: getHomeMedicationDisplayName(
            medicationSubject
        ),
        current_care_date: currentCareDate,
        context_fingerprint: contextFingerprint,
        request:
            queryPlan.intent === "home_medication_given_action"
                ? normalizeActionRequest(queryPlan.action)
                : null,
    }
    const tools = {
        async load_home_medication_state() {
            return specialistState
        },
        async prepare_home_medication_action() {
            return prepareAssistantHomeMedicationAction({
                repository: actionRepository,
                petId,
                queryPlan,
                context,
                requestedBy,
                currentCareDate,
            })
        },
    }

    const coordinated = await coordinateTomoSpecialist({
        intent: queryPlan.intent,
        petId,
        workflowType: buildCareOperationsWorkflowType({
            intent: queryPlan.intent,
            medicationSubject,
        }),
        contextFingerprint,
        specialistInput,
        initialEvidenceIds: collectEvidenceIds(state),
        repository: orchestrationRepository,
        registry,
        tools,
        now,
    })

    if (coordinated.status === "recovered") {
        const recovered = await recoverCareOperationsResult({
            coordinated,
            actionRepository,
            state,
            displayName: specialistInput.display_name,
            administeredDate:
                specialistInput.request?.administered_date || null,
        })

        if (recovered.cancelledAction) {
            const superseded = await orchestrationRepository.updateRun({
                runId: coordinated.run.id,
                expectedUpdatedAt: coordinated.run.updated_at,
                patch: {
                    status: "superseded",
                    current_step: "complete",
                    pending_decision: null,
                    blocked_reason: "governed_action_cancelled",
                    completed_at: now
                        ? now()
                        : new Date().toISOString(),
                },
            })

            if (superseded) {
                return coordinateCareOperationsHandoff({
                    petId,
                    queryPlan,
                    context,
                    currentCareDate,
                    requestedBy,
                    actionRepository,
                    orchestrationRepository,
                    registry,
                    now,
                })
            }
        }

        return recovered
    }

    if (coordinated.status === "completed") {
        return {
            status: "completed",
            actionPreparation: await hydrateActionPreparation({
                preparation:
                    coordinated.handoff.result.action_preparation,
                actionRepository,
            }),
            orchestrationTrace: coordinated.trace,
        }
    }

    return {
        status: coordinated.status,
        actionPreparation: failurePreparation({
            intent: queryPlan.intent,
            displayName: specialistInput.display_name,
            coordinated,
        }),
        orchestrationTrace: coordinated.trace,
    }
}

export function buildCareOperationsContextFingerprint({
    petId,
    intent,
    medicationSubject,
    currentCareDate,
    request,
    state,
}) {
    const value = {
        pet_id: petId,
        intent,
        medication_subject: medicationSubject,
        current_care_date: currentCareDate,
        request: normalizeActionRequest(request),
        reminders: stableRecords(state?.reminders),
        administrations: stableRecords(state?.administrations),
        pending_actions:
            intent === "home_medication_given_action"
                ? []
                : stableRecords(state?.pending_actions),
    }

    return createHash("sha256")
        .update(stableStringify(value), "utf8")
        .digest("hex")
}

export function buildBoundedHomeMedicationState({
    context,
    pendingActions = [],
    medicationSubject,
}) {
    const reminders = (context?.homeMedicationReminders || [])
        .map(normalizeReminder)
        .filter(Boolean)
        .filter((record) => subjectMatches(record, medicationSubject))
        .slice(0, 4)
    const administrations = (
        context?.homeMedicationAdministrationEvents || []
    )
        .map(normalizeAdministration)
        .filter(Boolean)
        .filter((record) => subjectMatches(record, medicationSubject))
        .sort((a, b) =>
            String(b.event_date).localeCompare(String(a.event_date))
        )
        .slice(0, 10)
    const pending = pendingActions
        .filter(
            (action) =>
                action?.action_type ===
                "mark_home_medication_given"
        )
        .map(normalizePendingAction)
        .filter(Boolean)
        .filter((record) => subjectMatches(record, medicationSubject))
        .slice(0, 4)

    return {
        reminders,
        administrations,
        pending_actions: pending,
    }
}

export function buildCareOperationsWorkflowType({
    intent,
    medicationSubject,
}) {
    return [
        "care_operations_home_medication",
        intent,
        medicationSubject || "unspecified",
    ].join(":")
}

async function recoverCareOperationsResult({
    coordinated,
    actionRepository,
    state,
    displayName,
    administeredDate,
}) {
    const governedAction =
        coordinated.run?.result_json?.governed_action

    if (!governedAction?.id) {
        return {
            status: "recovered",
            actionPreparation: null,
            orchestrationTrace: coordinated.trace,
        }
    }

    const action = await actionRepository.findActionById(
        governedAction.id
    )

    if (!action || action.status !== "proposed") {
        return {
            status: "recovered",
            cancelledAction: action?.status === "cancelled",
            actionPreparation: {
                status: "not_eligible",
                displayName,
                message:
                    "The earlier proposal is no longer awaiting review. Refresh trusted care state before preparing another.",
            },
            orchestrationTrace: coordinated.trace,
        }
    }

    return {
        status: "recovered",
        cancelledAction: false,
        actionPreparation: {
            status: "prepared",
            displayName,
            administeredDate,
            disposition: "existing",
            action,
            reminder:
                state.reminders.find(
                    (reminder) =>
                        reminder.id === action.source_event_id
                ) || null,
        },
        orchestrationTrace: coordinated.trace,
    }
}

function failurePreparation({ intent, displayName, coordinated }) {
    if (intent !== "home_medication_given_action") return null

    const failure = coordinated.handoff?.failure
    const reason =
        failure?.message ||
        "Care Operations is still reconciling this request. Please retry before approving any change."

    return {
        status: "not_eligible",
        displayName,
        message: reason,
    }
}

function normalizeReminder(reminder) {
    if (!reminder?.id) return null

    const details = reminder.details_json || {}

    return {
        id: reminder.id,
        doc_id: reminder.doc_id || null,
        event_date: reminder.event_date || null,
        status: reminder.status || null,
        updated_at: reminder.updated_at || null,
        medication_subject: getSubject(details.care_item),
        care_item: details.care_item || null,
        target_admin_date: details.target_admin_date || null,
        due_date: details.due_date || null,
        last_administered_date:
            details.last_administered_date || null,
        cadence_days: details.cadence_days || null,
    }
}

function normalizeAdministration(event) {
    if (!event?.id) return null

    const details = event.details_json || {}

    return {
        id: event.id,
        doc_id: event.doc_id || null,
        event_date: event.event_date || null,
        status: event.status || null,
        updated_at: event.updated_at || null,
        medication_subject: getSubject(details.care_item),
        care_item: details.care_item || null,
    }
}

function normalizePendingAction(action) {
    if (!action?.id) return null

    return {
        id: action.id,
        status: action.status || null,
        action_type: action.action_type,
        source_event_id: action.source_event_id || null,
        medication_subject: getSubject(
            action.preview_json?.care_item
        ),
        administered_date:
            action.preview_json?.administered_date || null,
        proposed_at: action.proposed_at || null,
        approved_at: action.approved_at || null,
    }
}

async function hydrateActionPreparation({
    preparation,
    actionRepository,
}) {
    if (
        preparation?.status !== "prepared" ||
        !preparation.action?.id
    ) {
        return preparation
    }

    const action = await actionRepository.findActionById(
        preparation.action.id
    )

    return action
        ? {
              ...preparation,
              action,
          }
        : preparation
}

function collectEvidenceIds(state) {
    return [
        ...state.reminders.map((record) => record.id),
        ...state.administrations.map((record) => record.id),
    ].filter(Boolean)
}

function normalizeActionRequest(request) {
    if (!request) return null

    return {
        medication_subject:
            normalizeSubject(request.medication_subject),
        administered_date: request.administered_date || null,
        issue: request.issue || null,
    }
}

function normalizeSubject(subject) {
    if (
        subject === "simparica_trio" ||
        subject === "adequan" ||
        subject === "home_medications"
    ) {
        return subject
    }

    return null
}

function subjectMatches(record, subject) {
    return (
        subject === null ||
        subject === "home_medications" ||
        record.medication_subject === subject
    )
}

function getSubject(careItem) {
    const normalized = String(careItem || "").toLowerCase()

    if (normalized.includes("simparica")) return "simparica_trio"
    if (normalized.includes("adequan")) return "adequan"
    return null
}

function stableRecords(records = []) {
    return records
        .map((record) => ({ ...record }))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`
    }

    if (value && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${stableStringify(value[key])}`
            )
            .join(",")}}`
    }

    return JSON.stringify(value)
}

function assertActionRepository(repository) {
    const methods = [
        "findPendingActionsByPetId",
        "findActionById",
        "findReminder",
        "findActiveActionByIdempotencyKey",
        "insertProposedAction",
    ]

    for (const method of methods) {
        if (typeof repository?.[method] !== "function") {
            throw new TypeError(
                `actionRepository.${method} is required.`
            )
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${label} is required.`)
    }
}
