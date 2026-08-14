import { getCareDate } from "../lib/careDates.js"
import {
    HOME_MEDICATION_REMINDER_TYPE,
    INSURANCE_CLAIM_REMINDER_SUBTYPE,
    LIBRELA_REMINDER_SUBTYPE,
    resolveReminderTimingState,
} from "../reminders/reminderTiming.js"

export const MAX_ATTENTION_ITEMS = 5
export const GOOGLE_CALENDAR_HOME_URL =
    "https://calendar.google.com/calendar/u/0/r"

const SOURCE_LOADERS = [
    ["reminders", "findPlannedRemindersByPetId"],
    ["care_actions", "findAttentionCareActionsByPetId"],
    ["document_reviews", "findReviewDocumentsByPetId"],
]

const ACTION_PRIORITY = Object.freeze({
    outcome_unknown: 1,
    executing: 2,
    approved: 4,
    proposed: 6,
})

const FORWARD_ATTENTION_WINDOW_TYPES = new Set([
    "care_day",
    "next_care_day",
    "current_week",
    "current_month",
])

export async function buildAttentionSummary({
    repository,
    petId,
    currentCareDate = getCareDate(),
    dateRange = null,
    limit = MAX_ATTENTION_ITEMS,
}) {
    assertRepository(repository)
    assertRequiredString(petId, "petId")

    const settled = await Promise.allSettled(
        SOURCE_LOADERS.map(([, method]) => repository[method](petId))
    )
    const sources = SOURCE_LOADERS.map(([source], index) => ({
        source,
        status: settled[index].status === "fulfilled" ? "available" : "unavailable",
    }))
    const availableSourceCount = sources.filter(
        (source) => source.status === "available"
    ).length
    const items = []
    const currentWorkIncluded = isDateInRange(currentCareDate, dateRange)

    if (settled[0].status === "fulfilled") {
        items.push(
            ...settled[0].value
                .map((reminder) =>
                    buildReminderAttentionItem(reminder, currentCareDate, {
                        dateRange,
                    })
                )
                .filter(Boolean)
        )
    }

    if (settled[1].status === "fulfilled" && currentWorkIncluded) {
        items.push(
            ...settled[1].value
                .map(buildCareActionAttentionItem)
                .filter(Boolean)
        )
    }

    if (settled[2].status === "fulfilled" && currentWorkIncluded) {
        items.push(
            ...settled[2].value
                .map(buildDocumentReviewAttentionItem)
                .filter(Boolean)
        )
    }

    const rankedItems = items
        .sort(compareAttentionItems)
        .slice(0, normalizeLimit(limit))
        .map(stripSortMetadata)

    return {
        status:
            availableSourceCount === 0
                ? "unavailable"
                : availableSourceCount === sources.length
                  ? "available"
                  : "partial",
        items: rankedItems,
        total_qualifying_count: items.length,
        sources,
        date_range: dateRange,
        current_work_included: currentWorkIncluded,
    }
}

export function buildReminderAttentionItem(
    reminder,
    currentCareDate,
    { dateRange = null } = {}
) {
    const details = reminder?.details_json || {}
    const timingState = resolveReminderTimingState(reminder, {
        currentCareDate,
    })
    const reminderKind = getReminderKind(details)
    let normalizedState = getReminderAttentionState({
        reminder,
        reminderKind,
        timingState,
        currentCareDate,
    })

    if (normalizedState && !isDateInRange(currentCareDate, dateRange)) {
        return null
    }

    if (
        !normalizedState &&
        isScheduledReminderInAttentionRange({
            reminder,
            details,
            reminderKind,
            currentCareDate,
            dateRange,
        })
    ) {
        normalizedState = "scheduled"
    }

    if (!normalizedState) return null

    const title = getReminderTitle(details, reminderKind)
    const effectiveDate = getReminderEffectiveDate({
        reminder,
        details,
        reminderKind,
        normalizedState,
    })
    const navigationTargets = [
        {
            kind: "open_reminder",
            label: "Open reminder",
            target_id: reminder.id,
        },
        getCalendarNavigationTarget(details),
    ]

    return {
        id: `reminder:${reminder.id}`,
        kind: "reminder",
        state: normalizedState,
        priority: ["overdue", "expired"].includes(normalizedState) ? 3 : 5,
        title,
        reason: getReminderReason({
            details,
            reminderKind,
            normalizedState,
            title,
            effectiveDate,
        }),
        effective_date: effectiveDate,
        governing_reference: {
            table: "events",
            record_id: reminder.id,
            source_document_id:
                details.source_document_id || reminder.doc_id || null,
        },
        navigation_targets: navigationTargets,
        _created_at: reminder.created_at || null,
    }
}

export function buildCareActionAttentionItem(action) {
    const priority = ACTION_PRIORITY[action?.status]
    if (!priority || !action?.id) return null

    const preview = action.preview_json || {}
    const title =
        preview.title ||
        preview.care_item ||
        getCareActionTitle(action.action_type)
    const effectiveDate =
        action.status === "outcome_unknown" || action.status === "executing"
            ? action.execution_started_at || action.approved_at || action.proposed_at
            : action.status === "approved"
              ? action.approved_at || action.proposed_at
              : action.proposed_at

    return {
        id: `care_action:${action.id}`,
        kind: "care_action",
        state: action.status,
        priority,
        title,
        reason: getCareActionReason(action.status, title),
        effective_date: effectiveDate || null,
        governing_reference: {
            table: "care_actions",
            record_id: action.id,
            source_event_id: action.source_event_id || null,
        },
        navigation_targets: [
            {
                kind: "open_care_action",
                label: "Review action",
                target_id: action.id,
            },
        ],
        _created_at: action.created_at || action.proposed_at || null,
    }
}

export function buildDocumentReviewAttentionItem(document) {
    if (document?.status !== "needs_review" || !document?.id) return null

    const title = document.title || "Document ready for review"

    return {
        id: `document_review:${document.id}`,
        kind: "document_review",
        state: "needs_review",
        priority: 7,
        title,
        reason: `${title} needs verification before its extracted contents can become trusted facts.`,
        effective_date: document.created_at || document.doc_date || null,
        governing_reference: {
            table: "documents",
            record_id: document.id,
            trust_state: "candidate",
        },
        navigation_targets: [
            {
                kind: "open_review_document",
                label: "Review document",
                target_id: document.id,
            },
        ],
        _created_at: document.created_at || null,
    }
}

function getReminderKind(details) {
    if (details.reminder_type === HOME_MEDICATION_REMINDER_TYPE) {
        return "home_medication"
    }
    if (details.subtype === LIBRELA_REMINDER_SUBTYPE) return "librela"
    if (details.subtype === INSURANCE_CLAIM_REMINDER_SUBTYPE) {
        return "insurance_claim"
    }
    return "unsupported"
}

function getReminderAttentionState({
    reminder,
    reminderKind,
    timingState,
    currentCareDate,
}) {
    if (reminderKind === "home_medication") {
        return ["due_now", "overdue"].includes(timingState)
            ? timingState
            : null
    }

    if (reminderKind === "librela") {
        if (timingState === "overdue") return "overdue"
        if (reminder.event_date && reminder.event_date <= currentCareDate) {
            return "due_now"
        }
        return null
    }

    if (reminderKind === "insurance_claim") {
        if (timingState === "claim_window_expired") return "expired"
        if (timingState === "due_now") return "due_now"
    }

    return null
}

function getReminderTitle(details, reminderKind) {
    if (reminderKind === "librela") return "Librela appointment"
    if (reminderKind === "insurance_claim") return "Insurance claim"
    return details.care_item || details.medication || "Home medication"
}

function getReminderEffectiveDate({
    reminder,
    details,
    reminderKind,
    normalizedState,
}) {
    if (normalizedState === "scheduled") {
        return getReminderActivationDate(reminder, details, reminderKind)
    }

    if (reminderKind === "home_medication") {
        return details.target_admin_date || details.due_date || reminder.event_date
    }
    if (reminderKind === "librela") {
        return normalizedState === "overdue"
            ? details.due_date
            : reminder.event_date
    }
    if (reminderKind === "insurance_claim") {
        return normalizedState === "expired"
            ? details.claim_deadline_date
            : details.target_submit_date
    }
    return reminder.event_date || null
}

function getReminderReason({
    details,
    reminderKind,
    normalizedState,
    title,
    effectiveDate,
}) {
    const dateLabel = formatCareDate(effectiveDate)

    if (normalizedState === "scheduled") {
        if (reminderKind === "librela") {
            const dueDateLabel = formatCareDate(details.due_date)
            return details.due_date && details.due_date !== effectiveDate
                ? `${title} reminder window opens on ${dateLabel}, ahead of its ${dueDateLabel} due date.`
                : `${title} reminder window opens on ${dateLabel}.`
        }
        if (reminderKind === "insurance_claim") {
            return `${title} target filing date is ${dateLabel}.`
        }
        const targetDate = details.target_admin_date || details.due_date
        const targetDateLabel = formatCareDate(targetDate || effectiveDate)
        return targetDate && targetDate !== effectiveDate
            ? `${title} is due by ${targetDateLabel}, and its reminder appears on ${dateLabel} so you can confirm it was given.`
            : `${title} is due on ${targetDateLabel}, so please confirm whether it was given.`
    }

    if (reminderKind === "librela") {
        return normalizedState === "overdue"
            ? `${title} was due on ${dateLabel}, so the appointment and treatment status need review.`
            : `${title} reminder window is open as of ${dateLabel}; review the appointment follow-through.`
    }
    if (reminderKind === "insurance_claim") {
        return normalizedState === "expired"
            ? `${title} final filing deadline was ${dateLabel}; review the filing status.`
            : `${title} target filing date is ${dateLabel}; review or record the claim status.`
    }
    return normalizedState === "overdue"
        ? `Please confirm whether ${title} was given; its target date was ${dateLabel}.`
        : `${title} is due by ${dateLabel}, so please confirm whether it was given.`
}

function isScheduledReminderInAttentionRange({
    reminder,
    details,
    reminderKind,
    currentCareDate,
    dateRange,
}) {
    if (!FORWARD_ATTENTION_WINDOW_TYPES.has(dateRange?.type)) return false
    if (reminderKind === "unsupported") return false

    const activationDate = getReminderActivationDate(
        reminder,
        details,
        reminderKind
    )

    return (
        Boolean(activationDate) &&
        activationDate > currentCareDate &&
        isDateInRange(activationDate, dateRange)
    )
}

function getReminderActivationDate(reminder, details, reminderKind) {
    if (reminderKind === "insurance_claim") {
        return details.target_submit_date || reminder.event_date || null
    }

    return reminder.event_date || null
}

function isDateInRange(value, dateRange) {
    if (!value || !dateRange) return true
    if (!dateRange.start && !dateRange.end) return true
    if (dateRange.start && value < dateRange.start) return false
    if (dateRange.end && value > dateRange.end) return false
    return true
}

function getCalendarNavigationTarget(details) {
    const storedUrl = details.external_refs?.google_calendar_html_link || null

    if (isAllowedGoogleCalendarUrl(storedUrl)) {
        return {
            kind: "open_calendar_event",
            label: "Open Calendar event",
            url: storedUrl,
        }
    }

    return {
        kind: "open_calendar_home",
        label: "Open Google Calendar",
        url: GOOGLE_CALENDAR_HOME_URL,
    }
}

function isAllowedGoogleCalendarUrl(value) {
    if (!value) return false

    try {
        const url = new URL(value)
        return (
            url.protocol === "https:" &&
            (url.hostname === "calendar.google.com" ||
                (url.hostname === "www.google.com" &&
                    url.pathname.startsWith("/calendar/")))
        )
    } catch {
        return false
    }
}

function getCareActionTitle(actionType) {
    return {
        mark_home_medication_given: "Home-medication confirmation",
        mark_insurance_claim_filed: "Insurance-claim confirmation",
        send_librela_appointment_request: "Librela appointment request",
    }[actionType] || "TomoCare action"
}

function getCareActionReason(status, title) {
    return {
        outcome_unknown:
            `The outcome of ${title} is unknown and needs review before any retry.`,
        executing:
            `${title} was interrupted and needs recovery review.`,
        approved:
            `${title} is approved and waiting to be completed.`,
        proposed: `${title} is waiting for your review and decision.`,
    }[status]
}

function formatCareDate(value) {
    if (!value) return "an unknown date"

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    }).format(date)
}

function compareAttentionItems(a, b) {
    return (
        a.priority - b.priority ||
        compareDates(a.effective_date, b.effective_date) ||
        compareDates(a._created_at, b._created_at) ||
        a.id.localeCompare(b.id)
    )
}

function compareDates(a, b) {
    const aTime = toTimestamp(a)
    const bTime = toTimestamp(b)
    return aTime - bTime
}

function toTimestamp(value) {
    if (!value) return Number.POSITIVE_INFINITY
    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

function stripSortMetadata(item) {
    const itemWithoutSortMetadata = { ...item }
    delete itemWithoutSortMetadata._created_at
    return itemWithoutSortMetadata
}

function normalizeLimit(limit) {
    if (!Number.isInteger(limit) || limit < 1) return MAX_ATTENTION_ITEMS
    return Math.min(limit, MAX_ATTENTION_ITEMS)
}

function assertRepository(repository) {
    for (const [, method] of SOURCE_LOADERS) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} is required.`)
    }
}
