import { getCareDate } from "../lib/careDates.js"

const WORKFLOW_TYPE = "librela_appointment_request"
const HANDOFF_VERSION = 1

export function coordinateLibrelaAppointmentRequest({
    context,
    currentCareDate = getCareDate(),
    senderName = "Rosa",
    petName = "Momo",
}) {
    const recordsHandoff = buildRecordsHandoff({
        context,
        currentCareDate,
    })

    if (recordsHandoff.status === "appointment_exists") {
        return {
            status: "appointment_exists",
            appointment: recordsHandoff.appointment,
            workflow: buildWorkflowSummary({
                state: "complete_no_action",
                currentOwner: "coordinator",
                completedRoles: ["records"],
                blockedReason: "appointment_exists",
            }),
        }
    }

    if (recordsHandoff.status !== "ready") {
        return blockedResult({
            status: recordsHandoff.status,
            recordsHandoff,
            blockedAt: "records",
        })
    }

    const carePlanningHandoff = buildCarePlanningHandoff({
        recordsHandoff,
        petName,
    })

    if (carePlanningHandoff.status !== "ready") {
        return blockedResult({
            status: carePlanningHandoff.status,
            recordsHandoff,
            carePlanningHandoff,
            blockedAt: "care_planning",
        })
    }

    const communicationHandoff = buildCommunicationHandoff({
        carePlanningHandoff,
        senderName,
    })

    return {
        status: "prepared",
        reminder: recordsHandoff.reminder,
        injection: recordsHandoff.injection,
        sourceDocument: recordsHandoff.sourceDocument,
        draft: communicationHandoff.draft,
        workflow: buildWorkflowSummary({
            state: "awaiting_human_review",
            currentOwner: "human",
            completedRoles: [
                "records",
                "care_planning",
                "communication",
            ],
            pendingDecision: "review_or_edit_message",
        }),
    }
}

export function buildRecordsHandoff({
    context,
    currentCareDate = getCareDate(),
}) {
    const appointment = findUpcomingLibrelaAppointment(
        context?.scheduledAppointments,
        currentCareDate
    )

    if (appointment) {
        return {
            contract: "trusted_librela_records",
            version: HANDOFF_VERSION,
            role: "records",
            status: "appointment_exists",
            appointment,
        }
    }

    const reminder = findCurrentLibrelaReminder(
        context?.plannedReminders,
        currentCareDate
    )

    if (!reminder) {
        return recordsBlocked("reminder_not_found")
    }

    const injection = findLatestVerifiedLibrelaInjection(
        context?.librelaInjectionEvents
    )

    if (!injection) {
        return {
            ...recordsBlocked("injection_not_found"),
            reminder,
        }
    }

    const sourceDocument = findVerifiedSourceDocument({
        context,
        reminder,
        injection,
    })

    return {
        contract: "trusted_librela_records",
        version: HANDOFF_VERSION,
        role: "records",
        status: "ready",
        reminder,
        injection,
        sourceDocument,
    }
}

export function buildCarePlanningHandoff({
    recordsHandoff,
    petName = "Momo",
}) {
    assertReadyHandoff(
        recordsHandoff,
        "trusted_librela_records",
        "recordsHandoff"
    )

    const { reminder, injection, sourceDocument } = recordsHandoff
    const dueDate = getReminderDueDate(reminder)

    if (!dueDate) {
        return carePlanningBlocked("due_date_not_found")
    }

    const recipientName =
        trustedOrganizationName(reminder?.details_json?.source_org) ||
        trustedOrganizationName(sourceDocument?.source_org)

    if (!recipientName) {
        return carePlanningBlocked("recipient_not_found")
    }

    return {
        contract: "librela_appointment_plan",
        version: HANDOFF_VERSION,
        role: "care_planning",
        status: "ready",
        plan: {
            purpose: `Schedule ${petName}’s next Librela injection`,
            petName,
            recipientName,
            dates: {
                lastVerifiedInjectionDate: injection.event_date,
                reminderDate: reminder.event_date,
                dueDate,
            },
            evidence: {
                injectionEventId: injection.id,
                reminderEventId: reminder.id,
                sourceDocumentId:
                    sourceDocument?.id || reminder.doc_id || null,
            },
        },
    }
}

export function buildCommunicationHandoff({
    carePlanningHandoff,
    senderName = "Rosa",
}) {
    assertReadyHandoff(
        carePlanningHandoff,
        "librela_appointment_plan",
        "carePlanningHandoff"
    )

    const { plan } = carePlanningHandoff
    const messageBody = [
        `Hi ${plan.recipientName},`,
        "",
        `I’d like to schedule ${plan.petName}’s next Librela injection. Her last Librela injection was on ${formatDate(plan.dates.lastVerifiedInjectionDate)}, and her next one is due around ${formatDate(plan.dates.dueDate)}. Do you have any appointments available around that date?`,
        "",
        "Thank you,",
        senderName,
    ].join("\n")

    return {
        contract: "appointment_message_draft",
        version: HANDOFF_VERSION,
        role: "communication",
        status: "ready",
        draft: {
            type: WORKFLOW_TYPE,
            status: "draft",
            recipient_name: plan.recipientName,
            recipient_basis: "trusted_record",
            recipient_contact: null,
            purpose: plan.purpose,
            message_body: messageBody,
            dates: {
                last_verified_injection_date:
                    plan.dates.lastVerifiedInjectionDate,
                reminder_date: plan.dates.reminderDate,
                due_date: plan.dates.dueDate,
            },
            evidence: {
                injection_event_id: plan.evidence.injectionEventId,
                reminder_event_id: plan.evidence.reminderEventId,
                source_document_id: plan.evidence.sourceDocumentId,
            },
            delivery: {
                status: "not_sent",
                send_available: false,
            },
        },
    }
}

function blockedResult({
    status,
    recordsHandoff,
    carePlanningHandoff = null,
    blockedAt,
}) {
    return {
        status,
        ...(recordsHandoff?.reminder
            ? { reminder: recordsHandoff.reminder }
            : {}),
        ...(recordsHandoff?.injection
            ? { injection: recordsHandoff.injection }
            : {}),
        ...(recordsHandoff?.sourceDocument
            ? { sourceDocument: recordsHandoff.sourceDocument }
            : {}),
        workflow: buildWorkflowSummary({
            state: "blocked",
            currentOwner: "coordinator",
            completedRoles:
                blockedAt === "care_planning" ? ["records"] : [],
            blockedReason:
                carePlanningHandoff?.status ||
                recordsHandoff?.status ||
                status,
        }),
    }
}

function buildWorkflowSummary({
    state,
    currentOwner,
    completedRoles,
    pendingDecision = null,
    blockedReason = null,
}) {
    return {
        type: WORKFLOW_TYPE,
        version: HANDOFF_VERSION,
        state,
        current_owner: currentOwner,
        completed_roles: completedRoles,
        pending_decision: pendingDecision,
        blocked_reason: blockedReason,
        external_action_taken: false,
    }
}

function recordsBlocked(status) {
    return {
        contract: "trusted_librela_records",
        version: HANDOFF_VERSION,
        role: "records",
        status,
    }
}

function carePlanningBlocked(status) {
    return {
        contract: "librela_appointment_plan",
        version: HANDOFF_VERSION,
        role: "care_planning",
        status,
    }
}

function assertReadyHandoff(handoff, expectedContract, label) {
    if (
        handoff?.contract !== expectedContract ||
        handoff?.version !== HANDOFF_VERSION ||
        handoff?.status !== "ready"
    ) {
        throw new Error(
            `${label} must be a ready ${expectedContract} v${HANDOFF_VERSION} handoff.`
        )
    }
}

function findCurrentLibrelaReminder(reminders = [], currentCareDate) {
    const librelaReminders = reminders
        .filter(isTrustedPlannedLibrelaReminder)
        .sort((a, b) => {
            const aDate = getReminderDueDate(a) || a.event_date
            const bDate = getReminderDueDate(b) || b.event_date
            return new Date(aDate) - new Date(bDate)
        })

    return (
        librelaReminders.find(
            (reminder) =>
                (getReminderDueDate(reminder) || reminder.event_date) >=
                currentCareDate
        ) ||
        librelaReminders.at(-1) ||
        null
    )
}

function findLatestVerifiedLibrelaInjection(injections = []) {
    return (
        [...injections]
            .filter(
                (event) =>
                    event?.status === "verified" &&
                    event?.event_type === "injection" &&
                    event?.event_date &&
                    isLibrelaRelated(event)
            )
            .sort(
                (a, b) =>
                    new Date(b.event_date) - new Date(a.event_date)
            )[0] || null
    )
}

function findUpcomingLibrelaAppointment(
    appointments = [],
    currentCareDate
) {
    return (
        [...appointments]
            .filter(isTrustedScheduledLibrelaAppointment)
            .filter((event) => getEventDate(event) >= currentCareDate)
            .sort(
                (a, b) =>
                    new Date(getEventDate(a)) -
                    new Date(getEventDate(b))
            )[0] || null
    )
}

function findVerifiedSourceDocument({ context, reminder, injection }) {
    const documents = context?.documents || []
    const sourceDocumentId =
        reminder.details_json?.source_document_id ||
        reminder.doc_id ||
        injection.doc_id

    return (
        documents.find(
            (document) =>
                document.id === sourceDocumentId &&
                document.status === "verified"
        ) || null
    )
}

function getReminderDueDate(reminder) {
    const details = reminder?.details_json || {}

    return (
        details.due_date ||
        details.dueDate ||
        details.target_date ||
        details.targetDate ||
        null
    )
}

function getEventDate(event) {
    return event?.event_date || String(event?.event_start || "").slice(0, 10)
}

function isTrustedPlannedLibrelaReminder(event) {
    return (
        event?.event_type === "reminder" &&
        event?.status === "planned" &&
        event?.event_date &&
        isLibrelaRelated(event)
    )
}

function isTrustedScheduledLibrelaAppointment(event) {
    return (
        ["planned", "scheduled", "confirmed", "booked"].includes(
            event?.status
        ) &&
        getEventDate(event) &&
        isLibrelaRelated(event)
    )
}

function isLibrelaRelated(row) {
    const details = row?.details_json || {}
    const haystack = [
        row?.event_type,
        row?.status,
        details.subtype,
        details.target_subtype,
        details.medication,
        details.medication_name,
        details.title,
        details.description,
        details.reason,
        details.visit_type,
        details.appointment_type,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

function trustedOrganizationName(value) {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : null
}

function formatDate(value) {
    const date = new Date(`${value}T00:00:00`)

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date)
}
