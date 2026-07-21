import { resolveDateRange } from "./dateRanges.js"

export function buildQueryPlan(question) {
    const q = question.toLowerCase()
    const dateRange = resolveDateRange(question)

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
            scope: "verified_events",
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

    if (q.includes("reminder") || q.includes("active")) {
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
}) {
    return {
        intent,
        subject,
        scope,
        date_range: dateRange,
        trusted_only: true,
        requires_action,
    }
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
        "make appointment",
    ]

    if (directActionWords.some((word) => q.startsWith(word))) {
        return true
    }

    return /(can you|could you|would you|please).*(schedule|create|book|send|text|email|call|add)/.test(q)
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
        q.includes("when")

    return asksDue && mentionsHomeMedication(q)
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
