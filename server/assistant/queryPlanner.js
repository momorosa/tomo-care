import {
    resolveAttentionDateRange,
    resolveDateRange,
} from "./dateRanges.js"
import { parseHomeMedicationActionRequest } from "./homeMedicationAction.js"
import { isLibrelaAppointmentMessageRequest } from "./librelaAppointmentMessage.js"

export function buildQueryPlan(question, options = {}) {
    const q = question.toLowerCase()
    const dateRange = resolveDateRange(
        question,
        options.currentCareDate || new Date()
    )
    const homeMedicationAction = parseHomeMedicationActionRequest(
        question,
        options
    )

    if (isAttentionSummaryQuestion(q)) {
        return basePlan({
            intent: "attention_summary",
            subject: "attention",
            scope: "governed_attention",
            dateRange: resolveAttentionDateRange(
                question,
                options.currentCareDate || new Date()
            ),
        })
    }

    if (isBroadCareOverviewQuestion(q)) {
        return basePlan({
            intent: "semantic_clarification",
            subject: "care_overview",
            scope: "clarification_needed",
            dateRange,
        })
    }

    if (isLibrelaAppointmentMessageRequest(question)) {
        return basePlan({
            intent: "librela_appointment_message",
            subject: "librela",
            scope: "trusted_librela_schedule",
            requires_action: true,
            dateRange,
        })
    }

    if (homeMedicationAction) {
        return basePlan({
            intent: "home_medication_given_action",
            subject: homeMedicationAction.medication_subject,
            scope: "planned_home_medication_reminders",
            requires_action: true,
            action: homeMedicationAction,
            dateRange,
        })
    }

    if (isProfileEditRequest(q)) {
        return basePlan({
            intent: "action_request",
            subject: "profile",
            scope: "profile_change_governance",
            requires_action: true,
            dateRange,
        })
    }

    if (isActionRequest(q)) {
        return basePlan({
            intent: "action_request",
            requires_action: true,
            dateRange,
        })
    }

    if (isAmbiguousHealthQuestion(q)) {
        return basePlan({
            intent: "ambiguous_health_question",
            subject: "health",
            scope: "clarification_needed",
            dateRange,
        })
    }


    const profileFocus = getProfileFocus(q)
    if (profileFocus) {
        return basePlan({
            intent: "profile_summary",
            subject: "profile",
            scope: "governed_pet_profile",
            profile_focus: profileFocus,
            dateRange,
        })
    }

    if (isDietRecommendationQuestion(q)) {
        return basePlan({
            intent: "care_recommendation_boundary",
            subject: "diet",
            scope: "medical_recommendation",
            dateRange,
        })
    }

    if (isMedicalJudgmentQuestion(q)) {
        return basePlan({
            intent: "medical_judgment_boundary",
            subject: getMedicalBoundarySubject(q),
            scope: "medical_interpretation",
            dateRange,
        })
    }

    if (isVaccineRecordQuestion(q)) {
        return basePlan({
            intent: "vaccine_record_lookup",
            subject: q.includes("rabies") ? "rabies_vaccine" : "vaccine",
            scope: "verified_vaccine_evidence",
            vaccine_focus: getVaccineFocus(q),
            dateRange,
        })
    }

    if (isCareTimelineQuestion(q)) {
        return basePlan({
            intent: "care_timeline_summary",
            subject: "care_timeline",
            scope: "verified_care_records",
            dateRange,
        })
    }

    if (isHomeMedicationAdministrationQuestion(q)) {
        return basePlan({
            intent: "home_medication_status",
            subject: getHomeMedicationSubject(q),
            scope: "verified_home_medication_administrations",
            dateRange,
        })
    }

    if (isHomeMedicationDueQuestion(q)) {
        return basePlan({
            intent: "home_medication_due",
            subject: getHomeMedicationSubject(q),
            scope: "planned_home_medication_reminders",
            dateRange,
        })
    }

    if (isWeightTrendQuestion(q)) {
        return basePlan({
            intent: "weight_trend",
            subject: "weight",
            scope: "verified_weight_facts",
            dateRange,
        })
    }

    if (isWeightChangeQuestion(q)) {
        return basePlan({
            intent: "weight_change",
            subject: "weight",
            scope: "verified_weight_facts",
            dateRange,
        })
    }

    if (isLastWeightQuestion(q)) {
        return basePlan({
            intent: "last_weight",
            subject: "weight",
            scope: "verified_weight_facts",
            dateRange,
        })
    }

    if (isLibrelaSpendQuestion(q)) {
        return basePlan({
            intent: "spend_summary",
            subject: "librela",
            scope: isLibrelaVisitTotalQuestion(q)
                ? "librela_visit_total"
                : "direct_librela_line_items",
            dateRange,
        })
    }

    if (isLibrelaShotCountQuestion(q)) {
        return basePlan({
            intent: "count_events",
            subject: "librela",
            scope: "verified_injections",
            dateRange,
        })
    }

    if (
        q.includes("last") &&
        (q.includes("librela") || q.includes("shot") || q.includes("injection"))
    ) {
        return basePlan({
            intent: "last_librela",
            subject: "librela",
            scope: "verified_injections",
            dateRange,
        })
    }

    if (isAppointmentStatusQuestion(q)) {
        return basePlan({
            intent: "appointment_status",
            subject: q.includes("librela") || q.includes("shot") || q.includes("injection")
                ? "librela"
                : "appointment",
            scope: "scheduled_appointments",
            dateRange,
        })
    }

    if (isNextLibrelaDueQuestion(q)) {
        return basePlan({
            intent: "next_librela_due",
            subject: "librela",
            scope: "care_schedule",
            dateRange,
        })
    }

    if (isNextLibrelaReminderQuestion(q)) {
        return basePlan({
            intent: "next_librela_reminder",
            subject: "librela",
            scope: "planned_reminders",
            dateRange,
        })
    }

    if (
        q.includes("reminder") ||
        q.includes("active") ||
        isCareCalendarQuestion(q)
    ) {
        return basePlan({
            intent: "active_reminders",
            subject: "reminders",
            scope: "planned_reminders",
            dateRange,
        })
    }

    if (
        q.includes("verified") ||
        q.includes("recent records") ||
        q.includes("recently")
    ) {
        return basePlan({
            intent: "recent_verified_records",
            subject: "documents",
            scope: "verified_documents",
            dateRange,
        })
    }

    return basePlan({
        intent: "unknown",
        subject: null,
        scope: null,
        dateRange,
    })
}

function basePlan({
    intent,
    subject = null,
    scope = null,
    dateRange,
    requires_action = false,
    action = null,
    profile_focus = null,
    vaccine_focus = null,
}) {
    return {
        intent,
        subject,
        scope,
        date_range: dateRange,
        trusted_only: true,
        requires_action,
        action,
        ...(profile_focus ? { profile_focus } : {}),
        ...(vaccine_focus ? { vaccine_focus } : {}),
    }
}

function isProfileEditRequest(q) {
    const normalized = normalizeOverviewQuestion(q)
    const mentionsProfile = /\b(profile|name|breed|species|birthday|birth date|sex|spayed|neutered|microchip|chip number)\b/.test(
        normalized
    )
    const asksChange = /\b(change|update|edit|correct|set|fix)\b/.test(normalized)

    return mentionsProfile && asksChange
}

function getProfileFocus(q) {
    const normalized = normalizeOverviewQuestion(q)
    const directFields = [
        ["microchip_id", /\b(microchip(?: id| number)?|chip number)\b/],
        ["age", /\b(how old|what(?: is|'s) .* age|age)\b/],
        ["birth_date", /\b(birthday|birth date|born)\b/],
        ["breed", /\bbreed\b/],
        ["species", /\bspecies\b|\bwhat kind of animal\b/],
        ["reproductive_status", /\b(spayed|neutered|fixed)\b/],
        ["sex", /\bsex\b|\bmale or female\b/],
        ["name", /\bwhat(?: is|'s) (?:momo(?:'s| s)? )?name\b/],
    ]

    for (const [focus, pattern] of directFields) {
        if (pattern.test(normalized) && /\b(momo|she|her|profile)\b/.test(normalized)) {
            return focus
        }
    }

    if (
        /^(?:tomo )?(?:what do you know about momo|tell me about momo|who is momo|describe momo|what(?: is|'s) in (?:momo(?:'s| s) )?profile|show me (?:momo(?:'s| s) )?profile)$/.test(
            normalized
        )
    ) {
        return "summary"
    }

    return null
}

function isActionRequest(q) {
    const directActionWords = [
        "send",
        "text",
        "sms",
        "email",
        "book",
        "call",
        "create",
        "add to calendar",
        "put on calendar",
        "make appointment",
        "approve",
        "execute",
        "complete",
        "mark",
    ]

    if (directActionWords.some((word) => q.startsWith(word))) {
        return true
    }

    return /(can you|could you|would you|please).*(schedule|create|book|send|text|email|call|add|put|approve|execute|complete|mark)/.test(
        q
    )
}

function isAttentionSummaryQuestion(q) {
    if (
        /\b(approve|execute|complete|mark|send|schedule|book|create|add|put)\b/.test(
            q
        )
    ) {
        return false
    }

    const normalized = normalizeOverviewQuestion(q)
    const time = "(?: (?:today|tomorrow|this week|this month))?"
    const patterns = [
        `what (?:currently )?needs (?:my )?attention${time}`,
        `show me what needs (?:my )?attention${time}`,
        `(?:is there )?anything (?:that )?needs (?:my )?attention${time}`,
        `do i need to do anything${time}`,
        `is there anything i need to (?:do|review|handle|take care of)${time}`,
        `anything i need to (?:do|review|handle|take care of)${time}`,
        `what do i need to (?:do|review|handle|take care of)${time}`,
        `what should i (?:do|review|handle|take care of)(?: next)?${time}`,
        `what do i have to (?:do|review|handle|take care of)${time}`,
        `(?:is there )?anything waiting for me${time}`,
        `what is waiting for me${time}`,
        `anything pending${time}`,
    ]

    return patterns.some((pattern) => new RegExp(`^${pattern}$`).test(normalized))
}

function isBroadCareOverviewQuestion(q) {
    const normalized = normalizeOverviewQuestion(q)

    return [
        /^(?:what is|what's) new$/,
        /^is there anything new$/,
        /^what do i need to know$/,
        /^(?:is there )?anything i need to know$/,
    ].some((pattern) => pattern.test(normalized))
}

function normalizeOverviewQuestion(question) {
    return question
        .toLowerCase()
        .replace(/[’]/g, "'")
        .replace(/[^a-z0-9'\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(?:(?:hey|hi|hello) )?tomo /, "")
}

function isLibrelaSpendQuestion(q) {
    return (
        q.includes("librela") &&
        (
            q.includes("how much") ||
            q.includes("spent") ||
            q.includes("spend") ||
            q.includes("cost") ||
            q.includes("paid") ||
            q.includes("total")
        )
    )
}

function isLibrelaVisitTotalQuestion(q) {
    return (
        q.includes("visit") ||
        q.includes("appointment") ||
        q.includes("whole visit") ||
        q.includes("full visit") ||
        q.includes("total visit") ||
        q.includes("entire visit")
    )
}

function isLibrelaShotCountQuestion(q) {
    return (
        (q.includes("how many") || q.includes("count") || q.includes("number of")) &&
        (q.includes("librela") || q.includes("shot") || q.includes("injection"))
    )
}

function isNextLibrelaDueQuestion(q) {
    const mentionsLibrela =
        q.includes("librela") ||
        q.includes("shot") ||
        q.includes("injection")

    const asksDueDate =
        q.includes("due") ||
        (
            q.includes("when") &&
            q.includes("next") &&
            (q.includes("shot") || q.includes("injection"))
        )

    return mentionsLibrela && asksDueDate && !q.includes("reminder")
}

function isNextLibrelaReminderQuestion(q) {
    return (
        q.includes("reminder") &&
        (q.includes("librela") || q.includes("shot") || q.includes("injection")) &&
        (q.includes("next") || q.includes("due") || q.includes("planned") || q.includes("when"))
    )
}

function isAppointmentStatusQuestion(q) {
    const mentionsAppointment =
        q.includes("appointment") ||
        q.includes("appt") ||
        q.includes("scheduled") ||
        q.includes("booked")

    const asksStatus =
        q.includes("have we") ||
        q.includes("do we") ||
        q.includes("is there") ||
        q.includes("made") ||
        q.includes("make") ||
        q.includes("booked") ||
        q.includes("scheduled")

    return mentionsAppointment && asksStatus
}

function mentionsWeight(q) {
    return (
        q.includes("weight") ||
        q.includes("weigh") ||
        q.includes("kg") ||
        q.includes("lb")
    )
}

function isWeightTrendQuestion(q) {
    return (
        mentionsWeight(q) &&
        (
            q.includes("trend") ||
            q.includes("history") ||
            q.includes("timeline") ||
            q.includes("over time") ||
            q.includes("progression")
        )
    )
}

function isWeightChangeQuestion(q) {
    return (
        mentionsWeight(q) &&
        (
            q.includes("changed") ||
            q.includes("change") ||
            q.includes("gain") ||
            q.includes("gained") ||
            q.includes("lost") ||
            q.includes("loss") ||
            q.includes("up") ||
            q.includes("down") ||
            q.includes("increase") ||
            q.includes("decrease")
        )
    )
}

function isLastWeightQuestion(q) {
    return (
        mentionsWeight(q) &&
        (
            q.includes("last") ||
            q.includes("latest") ||
            q.includes("current") ||
            q.includes("recent") ||
            q.includes("what") ||
            q.includes("how much")
        )
    )
}

function isAmbiguousHealthQuestion(q) {
    const normalized = q
        .replace(/[’]/g, "'")
        .replace(/[?!.]/g, "")
        .replace(/\s+/g, " ")
        .trim()

    return [
        "is momo okay",
        "is momo ok",
        "is she okay",
        "is she ok",
        "is everything okay",
        "is everything ok",
        "is momo alright",
        "is she alright",
        "how is momo",
        "how is she",
        "how's momo",
        "how's she",
        "hows momo",
        "hows she",
    ].includes(normalized)
}

function isDietRecommendationQuestion(q) {
    const mentionsDiet =
        q.includes("food") ||
        q.includes("diet") ||
        q.includes("kibble") ||
        q.includes("supplement") ||
        q.includes("nutrition")

    const asksRecommendation =
        q.includes("should") ||
        q.includes("recommend") ||
        q.includes("switch") ||
        q.includes("change") ||
        q.includes("what do i feed") ||
        q.includes("what should i feed")

    return mentionsDiet && asksRecommendation
}

function isMedicalJudgmentQuestion(q) {

    if (isCareTimelineQuestion(q)) return false

    const asksJudgment =
        q.includes("concerning") ||
        q.includes("concerned") ||
        q.includes("worried") ||
        q.includes("worry") ||
        q.includes("normal") ||
        q.includes("abnormal") ||
        q.includes("safe") ||
        q.includes("dangerous") ||
        q.includes("bad") ||
        q.includes("serious") ||
        q.includes("should i") ||
        q.includes("should we")

    const mentionsHealthAction =
        q.includes("dose") ||
        q.includes("dosage") ||
        q.includes("increase") ||
        q.includes("decrease") ||
        q.includes("give") ||
        q.includes("stop") ||
        q.includes("start") ||
        q.includes("treat") ||
        q.includes("treatment") ||
        q.includes("medication") ||
        q.includes("medicine") ||
        q.includes("librela") ||
        q.includes("pain") ||
        q.includes("symptom") ||
        q.includes("vet")

    return asksJudgment && (mentionsWeight(q) || mentionsHealthAction || q.includes("momo"))
}

function getMedicalBoundarySubject(q) {
    if (mentionsWeight(q)) return "weight"
    if (q.includes("librela") || q.includes("dose") || q.includes("dosage")) return "librela"
    if (q.includes("pain")) return "pain"
    return "health"
}

function isVaccineRecordQuestion(q) {
    return (
        q.includes("vaccine") ||
        q.includes("vaccination") ||
        q.includes("rabies") ||
        q.includes("vax")
    )
}

function getVaccineFocus(q) {
    if (/\b(open|view|certificate|document|pdf|proof|copy)\b/.test(q)) {
        return "certificate"
    }
    if (/\b(due|next|expires|expire|expiration|valid until)\b/.test(q)) {
        return "next_due"
    }
    if (/\b(status|current|up to date|up-to-date)\b/.test(q)) {
        return "clinic_reported_status"
    }
    return "administration"
}

function isCareTimelineQuestion(q) {
    const asksTimeline =
        q.includes("timeline") ||
        q.includes("history") ||
        q.includes("summary") ||
        q.includes("summarize") ||
        q.includes("over time") ||
        q.includes("changed over time") ||
        q.includes("what should i know") ||
        q.includes("before") && q.includes("vet")

    const mentionsCare =
        q.includes("care") ||
        q.includes("arthritis") ||
        q.includes("senior") ||
        q.includes("health") ||
        q.includes("momo") ||
        q.includes("librela") ||
        q.includes("weight") ||
        q.includes("vet")

    return asksTimeline && mentionsCare
}

function isHomeMedicationAdministrationQuestion(q) {
    const asksGiven =
        q.includes("did i give") ||
        q.includes("did we give") ||
        (q.includes("last") && q.includes("give")) ||
        q.includes("gave") ||
        q.includes("given") ||
        q.includes("administer") ||
        q.includes("administered")

    return asksGiven && mentionsHomeMedication(q)
}

function isHomeMedicationDueQuestion(q) {
    const asksDue =
        q.includes("due") ||
        q.includes("soon") ||
        q.includes("upcoming") ||
        q.includes("next") ||
        q.includes("when") ||
        q.includes("calendar")

    return asksDue && mentionsHomeMedication(q)
}

function isCareCalendarQuestion(q) {
    return q.includes("calendar") && !q.includes("google calendar")
}

function mentionsHomeMedication(q) {
    return (
        q.includes("simparica") ||
        q.includes("adequan") ||
        q.includes("home med") ||
        q.includes("home medication") ||
        q.includes("meds") ||
        q.includes("medications") ||
        q.includes("medicine") ||
        q.includes("home care") ||
        q.includes("care tasks")
    )
}

function getHomeMedicationSubject(q) {
    if (q.includes("simparica")) return "simparica_trio"
    if (q.includes("adequan")) return "adequan"

    return "home_medications"
}
