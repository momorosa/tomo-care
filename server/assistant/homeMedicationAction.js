import {
    ActionPreparationError,
    prepareMarkHomeMedicationGiven,
} from "../actions/prepareHomeMedicationGiven.js"
import { addDaysToIsoDate, getCareDate } from "../lib/careDates.js"

const SUPPORTED_MEDICATIONS = {
    simparica_trio: {
        displayName: "Simparica Trio",
        patterns: [/\bsimparica(?:\s+trio)?\b/i],
    },
    adequan: {
        displayName: "Adequan",
        patterns: [/\badequan\b/i],
    },
}

const UNSUPPORTED_MEDICATION_PATTERN = /\b(librela|metacam)\b/i
const UNCERTAINTY_PATTERN =
    /\b(maybe|might|may have|not sure|possibly|probably|i think|think i)\b/i

const MONTH_INDEX = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
}

export function parseHomeMedicationActionRequest(
    question,
    {
        currentCareDate = getCareDate(),
        conversationContext = null,
    } = {}
) {
    const text = String(question || "").trim()

    if (looksLikeAdministrationQuestion(text)) {
        return null
    }

    if (looksLikeAdministrationStatement(text)) {
        if (UNCERTAINTY_PATTERN.test(text)) {
            const parsedDetails = buildActionRequest({
                text,
                currentCareDate,
            })

            return {
                ...parsedDetails,
                issue: "uncertain_statement",
            }
        }

        return buildActionRequest({ text, currentCareDate })
    }

    return parseActionClarificationFollowUp({
        text,
        currentCareDate,
        conversationContext,
    })
}

function buildActionRequest({
    text,
    currentCareDate,
    fallbackMedicationSubject = null,
}) {
    const medicationResult = resolveMedication(text)
    const resolvedMedication =
        medicationResult.issue === "missing_medication" &&
        fallbackMedicationSubject
            ? {
                  subject: fallbackMedicationSubject,
                  issue: null,
              }
            : medicationResult
    const dateResult = resolveAdministrationDate(
        text,
        currentCareDate
    )

    return {
        kind: "record_home_medication_given",
        medication_subject: resolvedMedication.subject,
        administered_date: dateResult.date,
        issue: resolvedMedication.issue || dateResult.issue || null,
    }
}

function parseActionClarificationFollowUp({
    text,
    currentCareDate,
    conversationContext,
}) {
    if (
        conversationContext?.intent !==
            "home_medication_given_action" ||
        ![
            "medication_and_date",
            "administration_date",
        ].includes(conversationContext.pending_detail)
    ) {
        return null
    }

    const dateResult = resolveAdministrationDate(
        text,
        currentCareDate
    )
    const medicationResult = resolveMedication(text)
    const hasDateDetail = dateResult.issue !== "missing_date"
    const hasMedicationDetail =
        medicationResult.issue !== "missing_medication"

    if (!hasDateDetail && !hasMedicationDetail) return null

    return buildActionRequest({
        text,
        currentCareDate,
        fallbackMedicationSubject:
            conversationContext.subject || null,
    })
}

export async function prepareAssistantHomeMedicationAction({
    repository,
    petId,
    queryPlan,
    context,
    requestedBy,
    currentCareDate = getCareDate(),
}) {
    const request = queryPlan?.action

    if (!request || request.kind !== "record_home_medication_given") {
        return {
            status: "not_applicable",
        }
    }

    const displayName = getHomeMedicationDisplayName(
        request.medication_subject
    )

    if (request.issue) {
        return {
            status: request.issue,
            displayName,
        }
    }

    const matchingReminders = (context?.homeMedicationReminders || []).filter(
        (reminder) =>
            getMedicationSubjectFromReminder(reminder) ===
            request.medication_subject
    )

    if (matchingReminders.length === 0) {
        return {
            status: "reminder_not_found",
            displayName,
        }
    }

    if (matchingReminders.length > 1) {
        return {
            status: "multiple_reminders",
            displayName,
        }
    }

    const reminder = matchingReminders[0]

    try {
        const result = await prepareMarkHomeMedicationGiven({
            repository,
            petId,
            reminderId: reminder.id,
            administeredDate: request.administered_date,
            requestSource: "assistant",
            requestedBy,
            currentCareDate,
        })

        return {
            status: "prepared",
            displayName,
            administeredDate: request.administered_date,
            disposition: result.disposition,
            action: result.action,
            reminder,
        }
    } catch (error) {
        if (error instanceof ActionPreparationError) {
            return {
                status: "not_eligible",
                displayName,
                message: error.message,
            }
        }

        throw error
    }
}

export function getHomeMedicationDisplayName(subject) {
    return SUPPORTED_MEDICATIONS[subject]?.displayName || "home medication"
}

function looksLikeAdministrationStatement(text) {
    return (
        /\b(?:i|we)\s+(?:just\s+)?(?:gave|administered)\b/i.test(text) ||
        /\b(?:i|we)\s+(?:may|might|possibly|probably)\s+have\s+(?:given|administered)\b/i.test(
            text
        ) ||
        /\b(?:momo|she)\s+(?:just\s+)?(?:got|received)\b/i.test(text) ||
        /\b(?:record|mark)\b.*\b(?:gave|given|administered)\b/i.test(text)
    )
}

function looksLikeAdministrationQuestion(text) {
    return (
        /\?\s*$/.test(text) ||
        /^\s*(?:when|what date|did|have|do you know|can you tell me|could you tell me)\b/i.test(
            text
        ) ||
        /\bwhen\b.*\b(?:gave|give|administered|administer)\b/i.test(text) ||
        /\b(?:did|have)\s+(?:i|we)\b.*\b(?:give|given|administer)\b/i.test(
            text
        )
    )
}

function resolveMedication(text) {
    const matches = Object.entries(SUPPORTED_MEDICATIONS)
        .filter(([, medication]) =>
            medication.patterns.some((pattern) => pattern.test(text))
        )
        .map(([subject]) => subject)

    if (matches.length > 1) {
        return {
            subject: null,
            issue: "multiple_medications",
        }
    }

    if (matches.length === 1) {
        return {
            subject: matches[0],
            issue: null,
        }
    }

    if (UNSUPPORTED_MEDICATION_PATTERN.test(text)) {
        return {
            subject: null,
            issue: "unsupported_medication",
        }
    }

    return {
        subject: null,
        issue: "missing_medication",
    }
}

function resolveAdministrationDate(text, currentCareDate) {
    const candidates = []
    const normalized = text.toLowerCase()

    if (
        /\btoday\b/.test(normalized) ||
        /\bjust now\b/.test(normalized) ||
        /\bthis (?:morning|afternoon|evening)\b/.test(normalized) ||
        /\btonight\b/.test(normalized) ||
        /\bi just (?:gave|administered)\b/.test(normalized)
    ) {
        candidates.push(currentCareDate)
    }

    if (/\byesterday\b/.test(normalized)) {
        candidates.push(addDaysToIsoDate(currentCareDate, -1))
    }

    for (const match of text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
        const date = normalizeIsoDate(match[1])
        if (date) candidates.push(date)
    }

    for (const match of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
        const date = buildIsoDate({
            year: Number(match[3]),
            month: Number(match[1]),
            day: Number(match[2]),
        })
        if (date) candidates.push(date)
    }

    const monthPattern =
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(\d{4})\b/gi

    for (const match of text.matchAll(monthPattern)) {
        const date = buildIsoDate({
            year: Number(match[3]),
            month: MONTH_INDEX[match[1].toLowerCase()],
            day: Number(match[2]),
        })
        if (date) candidates.push(date)
    }

    const uniqueDates = [...new Set(candidates)]

    if (uniqueDates.length > 1) {
        return {
            date: null,
            issue: "ambiguous_date",
        }
    }

    if (uniqueDates.length === 0) {
        return {
            date: null,
            issue: "missing_date",
        }
    }

    return {
        date: uniqueDates[0],
        issue: null,
    }
}

function normalizeIsoDate(value) {
    try {
        return addDaysToIsoDate(value, 0)
    } catch {
        return null
    }
}

function buildIsoDate({ year, month, day }) {
    const candidate = [
        String(year).padStart(4, "0"),
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0"),
    ].join("-")

    return normalizeIsoDate(candidate)
}

function getMedicationSubjectFromReminder(reminder) {
    const careItem = String(
        reminder?.details_json?.care_item || ""
    ).toLowerCase()

    if (careItem.includes("simparica")) return "simparica_trio"
    if (careItem.includes("adequan")) return "adequan"

    return null
}
