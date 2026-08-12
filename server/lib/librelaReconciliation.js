import { createHash } from "node:crypto"

import {
    LIBRELA_EVIDENCE_CLASSIFIER_VERSION,
    buildCanonicalLibrelaInjectionEvent,
    classifyLibrelaAdministrationEvidence,
    isVerifiedLibrelaInjectionEvent,
} from "./librelaEvidence.js"

export const LIBRELA_RECONCILIATION_VERSION = "librela_reconciliation_v1"
export const LIBRELA_RULE_VERSION = "librela_v1"
export const LIBRELA_DUE_INTERVAL_DAYS = 49
export const LIBRELA_REMIND_BEFORE_DAYS = 7

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseIsoDate(value) {
    if (!DATE_RE.test(value || "")) return null

    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        return null
    }

    return date
}

export function addLibrelaRuleDays(value, days) {
    const date = parseIsoDate(value)
    if (!date) return null

    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function isLibrelaReminder(event) {
    return (
        event?.event_type === "reminder" &&
        event?.details_json?.subtype === "Librela"
    )
}

function reminderMatchesAnchor(event, { documentId, injectionId, anchorDate }) {
    if (!isLibrelaReminder(event)) return false

    const details = event.details_json || {}

    return (
        (injectionId && details.anchor_event_id === injectionId) ||
        (details.source_document_id === documentId &&
            details.anchor_event_date === anchorDate)
    )
}

function buildPlanToken({
    document,
    assessment,
    injection,
    targetReminder,
    plannedReminders,
}) {
    const snapshot = {
        schema_version: 1,
        document_id: document?.id || null,
        document_status: document?.status || null,
        evidence_state: assessment?.state || null,
        evidence_date: assessment?.event_date || null,
        evidence_source: assessment?.evidence_source || null,
        evidence_path: assessment?.evidence_path || null,
        classifier_version:
            assessment?.classifier_version ||
            LIBRELA_EVIDENCE_CLASSIFIER_VERSION,
        injection_id: injection?.id || null,
        target_reminder_id: targetReminder?.id || null,
        planned_reminders: plannedReminders
            .map((event) => ({
                id: event.id,
                event_date: event.event_date,
                status: event.status,
                anchor_event_id: event.details_json?.anchor_event_id || null,
                anchor_event_date:
                    event.details_json?.anchor_event_date || null,
                due_date: event.details_json?.due_date || null,
            }))
            .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    }

    return createHash("sha256")
        .update(JSON.stringify(snapshot))
        .digest("hex")
}

function buildBlockedPlan(assessment) {
    return {
        state: assessment.state,
        actionable: false,
        reason: assessment.reason || assessment.state,
        message: assessment.message,
        assessment,
        preview_token: null,
    }
}

export function buildLibrelaReconciliationPlan({
    document,
    documentEvents = [],
    petEvents = [],
} = {}) {
    const assessment = classifyLibrelaAdministrationEvidence({ document })

    if (assessment.state !== "eligible") {
        return buildBlockedPlan(assessment)
    }

    const newerInjection = petEvents
        .filter(isVerifiedLibrelaInjectionEvent)
        .find((event) => event.event_date > assessment.event_date)

    if (newerInjection) {
        return {
            state: "review_required",
            actionable: false,
            reason: "newer_verified_injection_exists",
            message:
                "A newer verified Librela injection already exists. Review the care timeline instead of repairing this older cycle.",
            assessment,
            preview_token: null,
        }
    }

    const injection =
        documentEvents.find(
            (event) =>
                isVerifiedLibrelaInjectionEvent(event) &&
                event.event_date === assessment.event_date
        ) || null

    const canonicalEvent = buildCanonicalLibrelaInjectionEvent({
        document,
        assessment,
    })
    const dueDate = addLibrelaRuleDays(
        assessment.event_date,
        LIBRELA_DUE_INTERVAL_DAYS
    )
    const reminderDate = addLibrelaRuleDays(
        dueDate,
        -LIBRELA_REMIND_BEFORE_DAYS
    )

    const plannedReminders = petEvents.filter(
        (event) => event?.status === "planned" && isLibrelaReminder(event)
    )
    const targetReminder =
        plannedReminders.find((event) =>
            reminderMatchesAnchor(event, {
                documentId: document.id,
                injectionId: injection?.id || null,
                anchorDate: assessment.event_date,
            })
        ) || null
    const priorReminders = plannedReminders.filter(
        (event) => event.id !== targetReminder?.id
    )

    const previewToken = buildPlanToken({
        document,
        assessment,
        injection,
        targetReminder,
        plannedReminders,
    })

    const alreadyReconciled =
        Boolean(injection) && Boolean(targetReminder) && priorReminders.length === 0

    return {
        state: alreadyReconciled ? "already_reconciled" : "repair_required",
        actionable: true,
        assessment,
        injection,
        canonical_event: canonicalEvent,
        target_reminder: targetReminder,
        prior_reminders: priorReminders,
        preview_token: previewToken,
        expected: {
            anchor_date: assessment.event_date,
            due_date: dueDate,
            reminder_date: reminderDate,
            rule_version: LIBRELA_RULE_VERSION,
        },
        changes: {
            canonical_event: injection ? "preserve" : "create",
            prior_reminders_to_complete: priorReminders.length,
            next_reminder: targetReminder ? "preserve" : "create",
            appointments: "preserve",
            non_librela_reminders: "preserve",
        },
    }
}

export function toLibrelaReconciliationPreview(plan) {
    if (!plan?.actionable) return null

    return {
        state: plan.state,
        preview_token: plan.preview_token,
        anchor_date: plan.expected.anchor_date,
        due_date: plan.expected.due_date,
        reminder_date: plan.expected.reminder_date,
        canonical_event_action: plan.changes.canonical_event,
        prior_reminders_to_complete:
            plan.changes.prior_reminders_to_complete,
        next_reminder_action: plan.changes.next_reminder,
        preserves_appointments: true,
        preserves_non_librela_reminders: true,
    }
}
