import { costItemCitation, documentCitation, eventCitation, factCitation, enrichCitations, } from "./citations.js"
import { dateInRange, getDateRangePhrase, } from "./dateRanges.js"
import { getCareDate } from "../lib/careDates.js"
import { TOMO_RELATIONSHIP_PROFILE_V2 } from "./relationshipProfile.js"

const LIBRELA_INTERVAL_DAYS = 49
const LIBRELA_REMIND_BEFORE_DAYS = 7

export function composeGroundedAnswer({
    question,
    queryPlan,
    context,
    actionPreparation = null,
    messageDraftPreparation = null,
    attentionSummary = null,
    profileSummary = null,
}) {
    let response

    switch (queryPlan.intent) {
        case "social_response":
            response = answerSocialResponse(queryPlan.subject, question)
            break

        case "attention_summary":
            response = answerAttentionSummary(attentionSummary, queryPlan)
            break

        case "profile_summary":
            response = answerProfileSummary(profileSummary, queryPlan)
            break

        case "semantic_clarification":
            response = answerSemanticClarification(queryPlan)
            break

        case "ambiguous_health_question":
            response = answerAmbiguousHealthQuestion(question)
            break

        case "care_recommendation_boundary":
            response = answerCareRecommendationBoundary(queryPlan)
            break

        case "medical_judgment_boundary":
            response = answerMedicalJudgmentBoundary(context, queryPlan)
            break

        case "vaccine_record_lookup":
            response = answerVaccineRecordLookup(context, queryPlan)
            break
        
        case "care_timeline_summary":
            response = answerCareTimelineSummary(context, queryPlan)
                break

        case "home_medication_due":
            response = answerHomeMedicationDue(context, queryPlan)
            break

        case "home_medication_status":
            response = answerHomeMedicationStatus(context, queryPlan)
            break

        case "home_medication_given_action":
            response = answerHomeMedicationGivenAction(
                queryPlan,
                actionPreparation
            )
            break

        case "librela_appointment_message":
            response = answerLibrelaAppointmentMessage(
                messageDraftPreparation
            )
            break

        case "last_weight":
            response = answerLastWeight(context, queryPlan)
            break

        case "weight_change":
            response = answerWeightChange(context, queryPlan)
            break

        case "weight_trend":
            response = answerWeightTrend(context, queryPlan)
            break

        case "last_librela":
            response = answerLastLibrela(context, queryPlan)
            break

        case "next_librela_due":
            response = answerNextLibrelaDue(context, queryPlan)
            break

        case "appointment_status":
            response = answerAppointmentStatus(context, queryPlan)
            break

        case "next_librela_reminder":
            response = answerNextLibrelaReminder(context, queryPlan)
            break

        case "active_reminders":
            response = answerActiveReminders(context, queryPlan)
            break

        case "spend_summary":
            response = answerLibrelaSpend(context, queryPlan)
            break

        case "count_events":
            response = answerLibrelaShotCount(context, queryPlan)
            break

        case "recent_verified_records":
            response = answerRecentVerifiedRecords(context, queryPlan)
            break

        case "action_request":
            response = answerActionRequest(queryPlan)
            break

        default:
            response = {
                answer:
                    "I don’t have a supported, verified answer for that yet. Would you like me to check what needs your attention, a medication or reminder, recently verified records, spending, or another specific part of Momo’s care?",
                answer_type: "unsupported_question",
                confidence: "low",
                citations: [],
                limitations: [
                    "No unsupported inference was made.",
                    "The assistant is currently limited to verified records, reminders, Librela history, spend, and recently verified documents.",
                ],
                proposed_action: null,
            }
    }

    return {
        question,
        ...response,
        citations: enrichCitations(response.citations || [], context),
        query_plan: queryPlan,
    }
}

function answerAttentionSummary(summary, queryPlan) {
    if (!summary) {
        return {
            answer:
                "I couldn’t build the governed attention summary right now, so I can’t safely say that nothing needs attention.",
            answer_type: "attention_summary",
            attention_status: "unavailable",
            attention_items: [],
            attention_sources: [],
            confidence: "low",
            citations: [],
            limitations: ["The governed attention summary was unavailable."],
            proposed_action: null,
        }
    }

    const items = summary?.items || []
    const sources = summary?.sources || []
    const dateRange = summary.date_range || queryPlan?.date_range || null
    const rangePhrase = getAttentionRangePhrase(dateRange)
    const unavailableSources = sources
        .filter((source) => source.status === "unavailable")
        .map((source) => getAttentionSourceLabel(source.source))
    const limitations = []

    if (unavailableSources.length > 0) {
        limitations.push(
            `I could not check ${formatNaturalList(unavailableSources)}.`
        )
    }

    if (summary?.total_qualifying_count > items.length) {
        limitations.push(
            `Only the ${items.length} highest-priority items are shown.`
        )
    }

    if (items.some((item) => item.kind === "document_review")) {
        limitations.push(
            "Review-document contents remain candidate truth until you verify them."
        )
    }

    if (summary.current_work_included === false) {
        limitations.push(
            "A tomorrow-only check covers scheduled reminders; pending actions and review documents are current work rather than tomorrow-dated items."
        )
    }

    if (summary?.status === "unavailable") {
        return {
            answer:
                "I couldn’t check TomoCare’s supported attention sources right now, so I can’t safely say that nothing needs attention.",
            answer_type: "attention_summary",
            attention_status: "unavailable",
            attention_items: [],
            attention_sources: sources,
            confidence: "low",
            citations: [],
            limitations,
            proposed_action: null,
        }
    }

    if (!items.length) {
        const answer =
            summary?.status === "partial"
                ? `I didn’t find an attention item${rangePhrase}, but one or more supported sources were unavailable.`
                : summary.current_work_included === false
                  ? `No supported reminder is scheduled to need attention${rangePhrase}.`
                  : `Nothing in the supported attention sources needs action${rangePhrase || " right now"}.`

        return {
            answer,
            answer_type: "attention_summary",
            attention_status:
                summary?.status === "partial" ? "partial" : "clear",
            attention_items: [],
            attention_sources: sources,
            confidence: summary?.status === "partial" ? "medium" : "high",
            citations: [],
            limitations,
            proposed_action: null,
        }
    }

    const itemText = items
        .map((item) => getAttentionItemSentence(item))
        .join("; ")
    const countText = getAttentionCountText({
        totalCount: summary.total_qualifying_count,
        visibleCount: items.length,
        dateRange,
    })

    return {
        answer: `${countText}. ${itemText}.`,
        answer_type: "attention_summary",
        attention_status:
            summary?.status === "partial" ? "partial" : "available",
        attention_items: items,
        attention_sources: sources,
        confidence: summary?.status === "partial" ? "medium" : "high",
        citations: [],
        limitations,
        proposed_action: null,
    }
}

function getAttentionRangePhrase(dateRange) {
    if (!dateRange || dateRange.type === "all_time") return ""
    return dateRange.label ? ` ${dateRange.label}` : ""
}

function getAttentionCountText({ totalCount, visibleCount, dateRange }) {
    const countWord = getSmallCountWord(totalCount)
    const plural = totalCount === 1 ? "thing" : "things"
    let opening

    if (dateRange?.type === "care_day") {
        opening = `Today, ${countWord} ${plural} need${totalCount === 1 ? "s" : ""} your attention`
    } else if (dateRange?.type === "next_care_day") {
        const reminderPlural = totalCount === 1 ? "reminder" : "reminders"
        opening = `Tomorrow, ${countWord} ${reminderPlural} will need your attention`
    } else if (
        ["current_week", "current_month"].includes(dateRange?.type)
    ) {
        const label =
            dateRange.label.charAt(0).toUpperCase() + dateRange.label.slice(1)
        opening = `${label}, ${countWord} ${plural} need${totalCount === 1 ? "s" : ""} your attention`
    } else {
        opening = `${capitalize(countWord)} ${plural} need${totalCount === 1 ? "s" : ""} your attention`
    }

    return totalCount > visibleCount
        ? `${opening}; here are the ${getSmallCountWord(visibleCount)} highest-priority ones`
        : opening
}

function getAttentionItemSentence(item) {
    const reason = String(item?.reason || "").trim()
    const title = item?.title || "This item"

    if (reason) {
        const withoutTerminalPunctuation = reason.replace(/[.!?]+$/, "")
        const demonstrativeMatch = withoutTerminalPunctuation.match(
            /^This (?:document|action|reminder|item)\s+(.+)$/i
        )

        if (demonstrativeMatch) {
            return `${title} ${demonstrativeMatch[1]}`
        }

        return withoutTerminalPunctuation
    }

    return `${title} needs attention`
}

function getSmallCountWord(value) {
    return ["zero", "one", "two", "three", "four", "five"][value] || String(value)
}

function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function getAttentionSourceLabel(source) {
    return {
        reminders: "reminders",
        care_actions: "pending or recoverable actions",
        document_reviews: "documents awaiting review",
    }[source] || "a supported source"
}

function answerProfileSummary(profile, queryPlan) {
    const focus = queryPlan?.profile_focus || "summary"
    const fields = profile?.fields || {
        id: null,
        name: null,
        species: null,
        breed: null,
        birth_date: null,
        age: null,
        sex: null,
        reproductive_status: null,
    }
    const shared = {
        answer_type: "profile_summary",
        profile_status: profile?.status || "unavailable",
        profile_focus: focus,
        profile_fields: fields,
        governing_reference: profile?.governing_reference || null,
        navigation_targets: profile?.navigation_targets || [],
        citations: [],
        proposed_action: null,
    }

    if (!profile || profile.status === "unavailable") {
        const governedAnswer =
            "I couldn’t load the governed pets Profile row, so I can’t safely answer with Profile facts right now."
        return {
            ...shared,
            answer: governedAnswer,
            governed_answer: governedAnswer,
            confidence: "low",
            limitations: [
                "The Profile source was unavailable; missing values were not treated as empty facts.",
            ],
        }
    }

    const governedAnswer =
        focus === "summary"
            ? composeProfileOverview(fields, profile.missing_fields)
            : composeProfileFieldAnswer(fields, focus)
    const relationshipColor =
        focus === "summary"
            ? composeRelationshipColor(
                  TOMO_RELATIONSHIP_PROFILE_V2.momo,
                  fields
              )
            : ""

    return {
        ...shared,
        answer: [governedAnswer, relationshipColor].filter(Boolean).join(" "),
        governed_answer: governedAnswer,
        confidence: profile.status === "available" ? "high" : "medium",
        limitations:
            profile.status === "partial"
                ? [
                      `Not set in Profile: ${formatNaturalList(
                          (profile.missing_fields || []).map(
                              getProfileFieldLabel
                          )
                      )}.`,
                  ]
                : [],
    }
}

function composeProfileOverview(fields, missingFields = []) {
    const name = fields.name || "This pet"
    const species = fields.species
        ? formatProfileSpecies(fields.species)
        : null
    const identity = [fields.breed, species].filter(Boolean).join(" ")
    const identityPhrase = identity
        ? `${getIndefiniteArticle(identity)} ${identity}`
        : "a pet whose breed and species aren’t set in Profile"
    const subjectPronouns = getProfilePronouns(fields.sex)
    const birthPhrase = fields.birth_date
        ? `born ${formatDate(fields.birth_date)}`
        : "with no birthday set in Profile"
    const agePhrase = Number.isInteger(fields.age)
        ? `and is ${fields.age} years old`
        : `so ${subjectPronouns.possessive} age can’t be calculated`
    const sexAndStatus = [
        fields.sex ? String(fields.sex).toLowerCase() : null,
        fields.reproductive_status
            ? formatReproductiveStatus(fields.reproductive_status)
            : null,
    ].filter(Boolean)
    const statusSentence = sexAndStatus.length
        ? `${capitalize(subjectPronouns.subject)} ${subjectPronouns.copula}${sexAndStatus.length === 2 ? "" : " recorded as"} ${formatNaturalList(sexAndStatus)} according to ${subjectPronouns.possessive} Profile.`
        : "Sex and spay or neuter status aren’t set in Profile."
    const missingNote = missingFields.length
        ? ` Not set in Profile: ${formatNaturalList(
              missingFields.map(getProfileFieldLabel)
          )}.`
        : ""

    return `${name} is ${identityPhrase}, ${birthPhrase}, ${agePhrase}. ${statusSentence}${missingNote}`
}

function composeProfileFieldAnswer(fields, focus) {
    const name = fields.name || "This pet"
    const value = fields[focus]

    if (value === null || value === undefined || value === "") {
        if (focus === "age") {
            return `${name}’s birth date isn’t set in Profile, so I can’t calculate age.`
        }
        return `${name}’s ${getProfileFieldLabel(focus)} isn’t set in Profile.`
    }

    const displayedValue =
        focus === "birth_date"
            ? formatDate(value)
            : focus === "age"
              ? `${value} years old`
              : focus === "reproductive_status"
                ? formatReproductiveStatus(value)
                : value

    if (focus === "age") return `${name} is ${displayedValue}.`
    if (focus === "breed") {
        return `${name} is ${getIndefiniteArticle(displayedValue)} ${displayedValue}.`
    }
    if (focus === "species") {
        return `${name} is ${getIndefiniteArticle(formatProfileSpecies(displayedValue))} ${formatProfileSpecies(displayedValue)}.`
    }
    if (focus === "birth_date") return `${name}’s birthday is ${displayedValue}.`
    if (focus === "name") return `The Profile name is ${displayedValue}.`
    if (focus === "sex" || focus === "reproductive_status") {
        const pronouns = getProfilePronouns(fields.sex)
        return `${name}’s Profile records ${pronouns.object} as ${String(displayedValue).toLowerCase()}.`
    }

    return `${name}’s ${getProfileFieldLabel(focus)} is ${displayedValue}.`
}

function composeRelationshipColor(relationshipProfile, fields) {
    const descriptors = relationshipProfile?.descriptors || []
    const familyRole = relationshipProfile?.family_role
    if (!familyRole && !descriptors.length) return ""

    const pronouns = getProfilePronouns(fields?.sex)
    if (descriptors.length) {
        return `Beyond those official details, ${pronouns.contraction} ${formatNaturalList(descriptors)}—and very much your happy place.`
    }

    return `Beyond those official details, ${pronouns.contraction} your beloved family member and happy place.`
}

function formatProfileSpecies(value) {
    return {
        canine: "dog",
        feline: "cat",
    }[String(value).toLowerCase()] || String(value).toLowerCase()
}

function getIndefiniteArticle(value) {
    return /^[aeiou]/i.test(String(value).trim()) ? "an" : "a"
}

function getProfilePronouns(sex) {
    const normalized = String(sex || "").toLowerCase()
    if (normalized === "female") {
        return {
            subject: "she",
            object: "her",
            possessive: "her",
            copula: "is",
            contraction: "she’s",
        }
    }
    if (normalized === "male") {
        return {
            subject: "he",
            object: "him",
            possessive: "his",
            copula: "is",
            contraction: "he’s",
        }
    }
    return {
        subject: "they",
        object: "them",
        possessive: "their",
        copula: "are",
        contraction: "they’re",
    }
}

function getProfileFieldLabel(field) {
    return {
        id: "record ID",
        name: "name",
        species: "species",
        breed: "breed",
        birth_date: "birth date",
        age: "age",
        sex: "sex",
        reproductive_status: "reproductive status",
    }[field] || field
}

function formatReproductiveStatus(value) {
    return String(value).replaceAll("_", " ")
}

function answerLastLibrela(context, queryPlan) {
    const injections = context.librelaInjectionEvents
        .filter((event) => dateInRange(event.event_date, queryPlan.date_range))
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))

    const eventOffset = queryPlan.event_offset === 1 ? 1 : 0
    const latest = injections[eventOffset]

    if (!latest) {
        return noTrustedDataAnswer(
            eventOffset === 1
                ? "I don’t have an earlier verified Librela injection record to show you."
                : "I don’t have a verified Librela injection record for that timeframe, so I can’t answer from trusted data."
        )
    }

    const rangePhrase = getDateRangePhrase(queryPlan.date_range)

    return {
        answer:
            eventOffset === 1
                ? `The verified Librela injection before that was on ${formatDate(latest.event_date)}.`
                : `Momo’s last verified Librela injection${rangePhrase ? ` ${rangePhrase}` : ""} was on ${formatDate(latest.event_date)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: [eventCitation(latest, "Verified Librela injection")],
        limitations: [],
        proposed_action: null,
    }
}

const SOCIAL_RESPONSE_POOLS = Object.freeze({
    positive_feedback: Object.freeze({
        appreciative: Object.freeze([
            "You’re very welcome, Rosa. Glad we found exactly what you needed.",
            "Of course, Rosa. I’m happy that landed just right.",
            "Anytime, Rosa. I’ve got you and Momo.",
        ]),
        celebratory: Object.freeze([
            "That’s wonderful to hear. Mission accomplished for Queen Momo.",
            "Yes! I’m glad that worked so well.",
            "Fantastic—we got exactly where we needed to go.",
        ]),
        satisfied: Object.freeze([
            "Perfect—that’s what I was hoping to hear.",
            "Glad we found exactly what you needed.",
            "Excellent—that’s exactly where I wanted us to land.",
        ]),
        warm: Object.freeze([
            "I’m glad that helped, Rosa.",
            "That makes me happy to hear.",
            "Good—we found the right answer for you and Momo.",
        ]),
    }),
    thanks: Object.freeze([
        "You’re very welcome, Rosa.",
        "Anytime, Rosa. I’ve got you and Momo.",
        "Always, Rosa.",
        "Of course—happy to help.",
    ]),
    negative_feedback: Object.freeze([
        "Got it—I took that in the wrong direction. Let’s try again.",
        "Thanks for correcting me, Rosa. Tell me what I missed.",
    ]),
})

function normalizeSocialQuestion(question) {
    return String(question || "")
        .toLowerCase()
        .replace(/[’]/g, "'")
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function stableSocialVariant(question, variants) {
    const normalized = normalizeSocialQuestion(question)
    let hash = 0

    for (const character of normalized) {
        hash = (hash * 31 + character.codePointAt(0)) >>> 0
    }

    return variants[hash % variants.length]
}

function getPositiveFeedbackFlavor(question) {
    const normalized = normalizeSocialQuestion(question)
    const hasThanks = /\b(thank you|thanks|appreciate(?:d)?(?: it)?)\b/.test(
        normalized
    )
    const soundsSatisfied =
        /\b(perfect|exactly|what i (?:was )?looking for|what i needed|just what i needed)\b/.test(
            normalized
        )
    const soundsCelebratory =
        /\b(fantastic|amazing|awesome|wonderful|excellent|love that|woo+hoo+)\b/.test(
            normalized
        )

    if (hasThanks) return "appreciative"
    if (soundsSatisfied) return "satisfied"
    if (soundsCelebratory) return "celebratory"
    return "warm"
}

function selectSocialResponse(subject, question) {
    if (subject === "positive_feedback") {
        const flavor = getPositiveFeedbackFlavor(question)
        return stableSocialVariant(
            question,
            SOCIAL_RESPONSE_POOLS.positive_feedback[flavor]
        )
    }

    if (subject === "thanks") {
        return stableSocialVariant(question, SOCIAL_RESPONSE_POOLS.thanks)
    }

    if (subject === "negative_feedback") {
        return stableSocialVariant(
            question,
            SOCIAL_RESPONSE_POOLS.negative_feedback
        )
    }

    return null
}

function answerSocialResponse(subject, question) {
    const answers = {
        acknowledgement: "Got it, Rosa.",
        capabilities:
            "I’m Tomo—your sidekick for Momo’s care. I can answer from verified TomoCare records, summarize medication and weight history, check care reminders and due dates, total Librela spending, and prepare care updates or messages for your review. I can be warm and playful with you, but I won’t invent records, make veterinary judgments, or send or change anything without your approval.",
        goodbye: "Talk soon, Rosa. Give Momo a little hello from me.",
        greeting: "Hi Rosa. What would you like to check for Momo?",
    }
    const variedResponse = selectSocialResponse(subject, question)

    return {
        answer: variedResponse || answers[subject] || "I’m here, Rosa.",
        answer_type: "social_response",
        confidence: "high",
        citations: [],
        limitations: [],
        proposed_action: null,
    }
}

function answerSemanticClarification(queryPlan) {
    const isCareOverview = queryPlan?.subject === "care_overview"

    return {
        answer: isCareOverview
            ? "Do you want me to check what needs your attention, what was recently verified, or a specific part of Momo’s care?"
            : "I can narrow that down. Do you want me to check a medication, reminder, verified record, spending, or another part of Momo’s care?",
        answer_type: "clarification_needed",
        confidence: "low",
        citations: [],
        limitations: ["No care fact or action was inferred."],
        proposed_action: null,
    }
}

function answerNextLibrelaReminder(context) {
    const reminders = context.plannedReminders
        .filter((reminder) => isLibrelaReminder(reminder))
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    const today = getTodayDateString()
    const upcomingReminder = reminders.find((reminder) => reminder.event_date >= today)
    const next = upcomingReminder || reminders[0]

    if (!next) {
        return noTrustedDataAnswer(
            "I don’t see an active planned Librela reminder in trusted records yet."
        )
    }

    const isPast = next.event_date < today

    return {
        answer: isPast
            ? `Momo has a planned Librela reminder from ${formatDate(next.event_date)}. That date has already passed, so it may need attention.`
            : `Momo’s next Librela reminder is planned for ${formatDate(next.event_date)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: [eventCitation(next, "Planned Librela reminder")],
        limitations: isPast
            ? ["This reminder is still stored as planned, but its reminder date has already passed."]
            : [],
        proposed_action: null,
    }
}

function answerNextLibrelaDue(context) {
    const injections = [...context.librelaInjectionEvents].sort(
        (a, b) => new Date(b.event_date) - new Date(a.event_date)
    )

    const latest = injections[0]

    if (!latest) {
        return noTrustedDataAnswer(
            "I don’t have a verified Librela injection record yet, so I can’t calculate the next due date from trusted data."
        )
    }

    const dueDate = addDays(latest.event_date, LIBRELA_INTERVAL_DAYS)
    const reminderDate = addDays(dueDate, -LIBRELA_REMIND_BEFORE_DAYS)

    const reminder = findMatchingLibrelaReminder(
        context.plannedReminders,
        dueDate,
        reminderDate
    )

    const appointment = findNextLibrelaAppointment(context.scheduledAppointments)

    const citations = [
        eventCitation(latest, "Last verified Librela injection"),
    ]

    if (reminder) {
        citations.push(eventCitation(reminder, "Planned Librela reminder"))
    }

    if (appointment) {
        citations.push(eventCitation(appointment, "Scheduled Librela appointment"))
    }

    let answer = `Momo’s next Librela shot is due around ${formatDate(dueDate)}. I calculated this from her last verified Librela injection on ${formatDate(latest.event_date)}, using TomoCare’s ${LIBRELA_INTERVAL_DAYS}-day care interval.`

    if (reminder) {
        answer += ` I also found a planned Librela reminder for ${formatDate(reminder.event_date)}.`
    } else {
        answer += " I do not see a matching planned Librela reminder in trusted records yet."
    }

    if (appointment) {
        answer += ` I also found a ${formatAppointmentStatus(appointment)} Librela appointment on ${formatDate(getEventPrimaryDate(appointment))}.`
    } else {
        answer += " I do not see a future scheduled or confirmed Librela appointment in trusted records yet."
    }

    return {
        answer,
        answer_type: "grounded_answer",
        confidence: "high",
        citations,
        limitations: [
            "The due date is calculated from TomoCare’s current Librela interval rule. Confirm timing with the clinic if Momo’s care plan changes.",
            "A reminder is not treated as a confirmed appointment.",
        ],
        proposed_action: appointment
            ? null
            : {
                type: "draft_appointment_request",
                status: "available_requires_approval",
                reason:
                    "No future Librela appointment was found in trusted records.",
            },
    }
}

function answerAppointmentStatus(context, queryPlan) {
    const today = getTodayDateString()

    const appointments = [...(context.scheduledAppointments || [])]
        .filter((appointment) =>
            queryPlan.subject === "librela"
                ? isLibrelaAppointmentRelated(appointment)
                : true
        )
        .filter((appointment) => getEventPrimaryDate(appointment) >= today)
        .sort((a, b) => new Date(getEventPrimaryDate(a)) - new Date(getEventPrimaryDate(b)))

    const appointment = appointments[0]

    if (appointment) {
        return {
            answer: `Yes. I found a ${formatAppointmentStatus(appointment)} ${queryPlan.subject === "librela" ? "Librela " : ""}appointment on ${formatDate(getEventPrimaryDate(appointment))}.`,
            answer_type: "grounded_answer",
            confidence: "high",
            citations: [eventCitation(appointment, "Scheduled appointment")],
            limitations: [],
            proposed_action: null,
        }
    }

    const reminders = [...context.plannedReminders]
        .filter((reminder) =>
            queryPlan.subject === "librela"
                ? isLibrelaReminder(reminder)
                : true
        )
        .filter((reminder) => reminder.event_date >= today)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    const reminder = reminders[0]

    if (reminder) {
        return {
            answer: `I found a planned ${queryPlan.subject === "librela" ? "Librela " : ""}reminder for ${formatDate(reminder.event_date)}, but I do not see a future scheduled or confirmed ${queryPlan.subject === "librela" ? "Librela " : ""}appointment in trusted records yet.`,
            answer_type: "grounded_answer",
            confidence: "medium",
            citations: [eventCitation(reminder, "Planned reminder")],
            limitations: [
                "A reminder is not treated as a confirmed vet appointment.",
                "I only checked trusted TomoCare records.",
            ],
            proposed_action: {
                type: "draft_appointment_request",
                status: "available_requires_approval",
                reason:
                    "A reminder exists, but no future scheduled or confirmed appointment was found in trusted records.",
            },
        }
    }

    return {
        answer: `I do not see a future scheduled or confirmed ${queryPlan.subject === "librela" ? "Librela " : ""}appointment in trusted records yet.`,
        answer_type: "grounded_answer",
        confidence: "medium",
        citations: [],
        limitations: [
            "I only checked trusted TomoCare records.",
            "No appointment was inferred from a reminder or due date.",
        ],
        proposed_action: {
            type: "draft_appointment_request",
            status: "available_requires_approval",
            reason:
                "No future scheduled or confirmed appointment was found in trusted records.",
        },
    }
}

function answerActiveReminders(context, queryPlan) {
    const allReminders = [...context.plannedReminders].sort(
        (a, b) => new Date(a.event_date) - new Date(b.event_date)
    )
    const reminders = allReminders.filter((reminder) =>
        dateInRange(reminder.event_date, queryPlan.date_range)
    )
    const rangePhrase = getDateRangePhrase(queryPlan.date_range)

    if (!reminders.length) {
        return noTrustedDataAnswer(
            `I don’t see any active planned reminders${rangePhrase ? ` ${rangePhrase}` : " right now"}.`
        )
    }

    const reminderText = reminders
        .slice(0, 5)
        .map((reminder) => {
            const label = getReminderLabel(reminder)
            return `${label} on ${formatDate(reminder.event_date)}`
        })
        .join("; ")

    const earlierActiveReminders = queryPlan.date_range?.start
        ? allReminders.filter(
              (reminder) => reminder.event_date < queryPlan.date_range.start
          )
        : []
    const earlierReminderText = earlierActiveReminders
        .slice(-2)
        .map(
            (reminder) =>
                `${getReminderLabel(reminder)} on ${formatDate(reminder.event_date)}`
        )
        .join("; ")
    const outsideRangeNote = earlierReminderText
        ? ` Separately, ${earlierActiveReminders.length === 1 ? "there is 1 earlier active reminder" : `there are ${earlierActiveReminders.length} earlier active reminders`}: ${earlierReminderText}.`
        : ""
    const citedReminders = [
        ...reminders.slice(0, 5),
        ...earlierActiveReminders.slice(-2),
    ]

    return {
        answer: `I found ${reminders.length} active planned reminder${reminders.length === 1 ? "" : "s"}${rangePhrase ? ` ${rangePhrase}` : ""}: ${reminderText}.${outsideRangeNote}`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: citedReminders
            .map((reminder) =>
                eventCitation(reminder, getReminderCitationLabel(reminder))
            ),
        limitations:
            reminders.length > 5 || earlierActiveReminders.length > 2
                ? [
                      reminders.length > 5
                          ? "Only the first five reminders in the requested timeframe are shown."
                          : null,
                      earlierActiveReminders.length > 2
                          ? "Only the two most recent earlier active reminders are shown separately."
                          : null,
                  ].filter(Boolean)
                : [],
        proposed_action: null,
    }
}

function answerAmbiguousHealthQuestion(question) {
    const normalized = String(question || "")
        .toLowerCase()
        .replace(/[’]/g, "'")
    const asksWhetherOkay = /\b(okay|ok|alright)\b/.test(normalized)

    return {
        answer: asksWhetherOkay
            ? "When you ask whether Momo is okay, what would you like me to check—her recent care records, what needs attention right now, or a specific concern such as her weight, Librela, or medications?"
            : "When you ask how Momo is, do you mean how she’s been doing based on her recent records, what needs attention right now, or something specific such as her weight, Librela, or medications?",
        answer_type: "clarification_needed",
        confidence: "high",
        citations: [],
        limitations: [
            "No health status was inferred from an ambiguous question.",
            "TomoCare answers should be grounded in specific verified records.",
        ],
        proposed_action: null,
    }
}

function answerCareRecommendationBoundary(queryPlan) {
    const subjectLabel = queryPlan.subject === "diet" ? "diet or food change" : "care change"

    return {
        answer:
            `I can summarize verified TomoCare records, but I can’t recommend a ${subjectLabel} from chat. That kind of care decision should be confirmed with Momo’s vet. I can help answer factual questions from her records, such as weight trend, Librela history, costs, reminders, or recent verified documents.`,
        answer_type: "safety_boundary",
        confidence: "high",
        citations: [],
        limitations: [
            "No diet, medication, or treatment recommendation was made.",
            "The assistant is limited to grounded summaries from verified TomoCare records.",
        ],
        proposed_action: null,
    }
}

function answerMedicalJudgmentBoundary(context, queryPlan) {
    if (queryPlan.subject === "weight") {
        return answerWeightMedicalBoundary(context, queryPlan)
    }

    if (queryPlan.subject === "librela") {
        return {
            answer:
                "I can summarize Momo’s verified Librela records, but I can’t recommend changing a medication dose or treatment plan from chat. Please confirm any Librela dosing or care changes with her vet.",
            answer_type: "safety_boundary",
            confidence: "high",
            citations: [],
            limitations: [
                "No medication dosing recommendation was made.",
                "TomoCare can provide verified history, but not veterinary treatment decisions.",
            ],
            proposed_action: null,
        }
    }

    return {
        answer:
            "I can summarize verified TomoCare records, but I can’t determine whether this is medically concerning or make a diagnosis from chat. Please confirm clinical significance with Momo’s vet.",
        answer_type: "safety_boundary",
        confidence: "high",
        citations: [],
        limitations: [
            "No diagnosis or medical judgment was made.",
            "The assistant is limited to grounded summaries from verified TomoCare records.",
        ],
        proposed_action: null,
    }
}

function answerHomeMedicationDue(context, queryPlan) {
    const reminders = getHomeMedicationRemindersForSubject(context, queryPlan.subject)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    const upcomingReminders = reminders.filter(
        (reminder) => reminder.event_date >= getTodayDateString()
    )

    const sourceReminders = upcomingReminders.length ? upcomingReminders : reminders

    if (!sourceReminders.length) {
        return noTrustedDataAnswer(
            queryPlan.subject === "home_medications"
                ? "I don’t see any planned home medication reminders in trusted records yet."
                : `I don’t see a planned ${getHomeMedicationDisplayName(queryPlan.subject)} reminder in trusted records yet.`
        )
    }

    if (queryPlan.subject !== "home_medications") {
        const reminder = sourceReminders[0]
        const details = reminder.details_json || {}
        const lastAdmin = findLastHomeMedicationAdministration(
            context,
            queryPlan.subject
        )

        const answerParts = [
            `${getHomeMedicationDisplayName(queryPlan.subject)} has a target administration date of ${formatDate(details.target_admin_date || reminder.event_date)}.`,
        ]

        if (details.due_date) {
            answerParts.push(`The cadence-based due date is ${formatDate(details.due_date)}.`)
        }

        answerParts.push(`The planned reminder is set for ${formatDate(reminder.event_date)}.`)

        if (lastAdmin) {
            answerParts.push(`The last verified administration I see was on ${formatDate(lastAdmin.event_date)}.`)
        }

        if (details.preferred_admin_day) {
            answerParts.push(`This schedule uses your preference to give home medications on ${details.preferred_admin_day}s when possible.`)
        }

        return {
            answer: answerParts.join(" "),
            answer_type: "grounded_answer",
            confidence: "high",
            citations: [
                eventCitation(reminder, `${getHomeMedicationDisplayName(queryPlan.subject)} reminder`),
                lastAdmin ? eventCitation(lastAdmin, `${getHomeMedicationDisplayName(queryPlan.subject)} administration`) : null,
            ].filter(Boolean),
            limitations: [
                "This is schedule tracking, not veterinary dosing advice.",
                "Target administration date may differ from exact cadence due date because of your weekday preference.",
            ],
            proposed_action: null,
        }
    }

    const reminderText = sourceReminders
        .map((reminder) => {
            const details = reminder.details_json || {}
            const careItem = details.care_item || "Home medication"
            const targetDate = details.target_admin_date || reminder.event_date
            const dueDate = details.due_date

            return dueDate
                ? `${careItem}: target ${formatDate(targetDate)}, due ${formatDate(dueDate)}, reminder ${formatDate(reminder.event_date)}`
                : `${careItem}: target ${formatDate(targetDate)}, reminder ${formatDate(reminder.event_date)}`
        })
        .join("; ")

    return {
        answer: `I found ${sourceReminders.length} planned home medication reminder${sourceReminders.length === 1 ? "" : "s"}: ${reminderText}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: sourceReminders.map((reminder) =>
            eventCitation(reminder, "Home medication reminder")
        ),
        limitations: [
            "This is schedule tracking, not veterinary dosing advice.",
            "A planned reminder does not mean the medication has already been given.",
        ],
        proposed_action: null,
    }
}

function answerHomeMedicationStatus(context, queryPlan) {
    const administrations = getHomeMedicationAdministrationsForSubject(
        context,
        queryPlan.subject
    ).sort((a, b) => new Date(b.event_date) - new Date(a.event_date))

    const reminders = getHomeMedicationRemindersForSubject(context, queryPlan.subject)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    if (!administrations.length) {
        return noTrustedDataAnswer(
            queryPlan.subject === "home_medications"
                ? "I don’t see verified home medication administration records yet."
                : `I don’t see a verified ${getHomeMedicationDisplayName(queryPlan.subject)} administration record yet.`
        )
    }

    const latestAdmin = administrations[0]
    const nextReminder = reminders.find(
        (reminder) => reminder.event_date >= getTodayDateString()
    )

    if (queryPlan.subject !== "home_medications") {
        const answerParts = [
            `The last verified ${getHomeMedicationDisplayName(queryPlan.subject)} administration was ${formatDate(latestAdmin.event_date)}.`,
        ]

        if (nextReminder) {
            const details = nextReminder.details_json || {}
            const targetDate = details.target_admin_date || nextReminder.event_date

            answerParts.push(`The next target administration date is ${formatDate(targetDate)}, with a planned reminder on ${formatDate(nextReminder.event_date)}.`)

            if (details.due_date) {
                answerParts.push(`The cadence-based due date is ${formatDate(details.due_date)}.`)
            }
        } else {
            answerParts.push("I do not see an upcoming planned reminder for the next cycle yet.")
        }

        return {
            answer: answerParts.join(" "),
            answer_type: "grounded_answer",
            confidence: "high",
            citations: [
                eventCitation(latestAdmin, `${getHomeMedicationDisplayName(queryPlan.subject)} administration`),
                nextReminder ? eventCitation(nextReminder, `${getHomeMedicationDisplayName(queryPlan.subject)} reminder`) : null,
            ].filter(Boolean),
            limitations: [
                "This answer only reflects verified TomoCare administration records and planned reminders.",
                "It does not determine whether a late or missed dose is medically significant.",
            ],
            proposed_action: null,
        }
    }

    const latestByItem = getLatestAdministrationByCareItem(administrations)

    const statusText = latestByItem
        .map((event) => {
            const careItem = event.details_json?.care_item || "Home medication"
            return `${careItem}: last verified given on ${formatDate(event.event_date)}`
        })
        .join("; ")

    return {
        answer: `I found verified home medication administration records: ${statusText}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: latestByItem.map((event) =>
            eventCitation(event, "Home medication administration")
        ),
        limitations: [
            "This answer only reflects verified TomoCare administration records.",
        ],
        proposed_action: null,
    }
}

function answerWeightMedicalBoundary(context, queryPlan) {
    const weights = getWeightFactsInRange(context, queryPlan).sort(
        (a, b) => new Date(a.fact_date) - new Date(b.fact_date)
    )

    if (!weights.length) {
        return {
            answer:
                "I can’t determine whether Momo’s weight is medically concerning from chat. I also don’t have verified weight records for that timeframe, so I can’t summarize a trusted weight trend yet. Please confirm clinical concerns with her vet.",
            answer_type: "safety_boundary",
            confidence: "medium",
            citations: [],
            limitations: [
                "No medical judgment was made.",
                "No verified weight records were available for this timeframe.",
            ],
            proposed_action: null,
        }
    }

    if (weights.length === 1) {
        const only = weights[0]

        return {
            answer:
                `I can summarize the verified weight record, but I can’t determine whether it is medically concerning. Momo’s verified weight was ${formatWeightFact(only)} on ${formatDate(only.fact_date)}. Please confirm clinical significance with her vet.`,
            answer_type: "safety_boundary",
            confidence: "high",
            citations: [factCitation(only, "Verified weight")],
            limitations: [
                "No medical judgment was made.",
                "At least two verified weight records are needed to summarize change over time.",
            ],
            proposed_action: null,
        }
    }

    const first = weights[0]
    const latest = weights[weights.length - 1]
    const changeKg = getWeightKg(latest) - getWeightKg(first)

    return {
        answer:
            `I can summarize Momo’s verified weight trend, but I can’t determine whether it is medically concerning. Momo’s verified weight changed from ${formatWeightFact(first)} on ${formatDate(first.fact_date)} to ${formatWeightFact(latest)} on ${formatDate(latest.fact_date)}, which is ${formatSignedWeightChange(changeKg)}. Please confirm clinical significance with her vet.`,
        answer_type: "safety_boundary",
        confidence: "high",
        citations: uniqueWeightFactCitations([first, latest]),
        limitations: [
            "This is a factual weight summary, not a medical interpretation.",
            "Clinical significance should be confirmed with Momo’s vet.",
        ],
        proposed_action: null,
    }
}

function answerVaccineRecordLookup(context, queryPlan) {
    const vaccineEvents = [...(context.verifiedEvents || [])]
        .filter(isVaccineRelated)
        .filter((event) =>
            queryPlan.subject === "rabies_vaccine"
                ? isRabiesRelated(event)
                : true
        )
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))

    const latest = vaccineEvents[0]
    const vaccineLabel = queryPlan.subject === "rabies_vaccine"
        ? "rabies vaccine"
        : "vaccine"

    if (!latest) {
        return noTrustedDataAnswer(
            `I don’t have a verified ${vaccineLabel} record for Momo yet, so I can’t answer from trusted TomoCare data.`
        )
    }

    return {
        answer:
            `Momo’s last verified ${vaccineLabel} record was on ${formatDate(latest.event_date)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: [eventCitation(latest, `Verified ${vaccineLabel} record`)],
        limitations: [
            "This answer uses verified TomoCare event records only.",
        ],
        proposed_action: null,
    }
}

function answerCareTimelineSummary(context, queryPlan) {
    const injections = [...(context.librelaInjectionEvents || [])]
        .filter((event) => dateInRange(event.event_date, queryPlan.date_range))
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    const weights = getWeightFactsInRange(context, queryPlan).sort(
        (a, b) => new Date(a.fact_date) - new Date(b.fact_date)
    )

    const reminders = [...(context.plannedReminders || [])]
        .filter(isLibrelaReminder)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    const appointment = findNextLibrelaAppointment(context.scheduledAppointments)

    const recentDocs = [...(context.documents || [])]
        .filter((doc) => dateInRange(doc.doc_date, queryPlan.date_range))
        .sort((a, b) => new Date(b.doc_date) - new Date(a.doc_date))
        .slice(0, 3)

    if (!injections.length && !weights.length && !reminders.length && !recentDocs.length) {
        return noTrustedDataAnswer(
            "I don’t have enough verified care records for that timeframe to summarize Momo’s care timeline."
        )
    }

    const latestInjection = injections[injections.length - 1]
    const firstWeight = weights[0]
    const latestWeight = weights[weights.length - 1]
    const upcomingReminder = findNextUpcomingReminder(reminders)

    const answerParts = [
        "From verified TomoCare records, Momo’s care timeline shows:",
    ]

    if (injections.length) {
        answerParts.push(
            `Librela support has been tracked across ${injections.length} verified injection${injections.length === 1 ? "" : "s"}, with the latest verified injection on ${formatDate(latestInjection.event_date)}.`
        )
    } else {
        answerParts.push(
            "I do not see verified Librela injection records in this timeframe."
        )
    }

    if (latestInjection) {
        const dueDate = addDays(latestInjection.event_date, LIBRELA_INTERVAL_DAYS)

        answerParts.push(
            `Based on the current ${LIBRELA_INTERVAL_DAYS}-day care interval, the next Librela shot is due around ${formatDate(dueDate)}.`
        )
    }

    if (upcomingReminder) {
        answerParts.push(
            `There is a planned Librela reminder for ${formatDate(upcomingReminder.event_date)}.`
        )
    } else {
        answerParts.push(
            "I do not see an upcoming planned Librela reminder in trusted records."
        )
    }

    if (appointment) {
        answerParts.push(
            `I also found a ${formatAppointmentStatus(appointment)} Librela appointment on ${formatDate(getEventPrimaryDate(appointment))}.`
        )
    } else {
        answerParts.push(
            "I do not see a future scheduled or confirmed Librela appointment in trusted records yet."
        )
    }

    if (weights.length >= 2) {
        const changeKg = getWeightKg(latestWeight) - getWeightKg(firstWeight)

        answerParts.push(
            `Her verified weight changed from ${formatWeightFact(firstWeight)} on ${formatDate(firstWeight.fact_date)} to ${formatWeightFact(latestWeight)} on ${formatDate(latestWeight.fact_date)}, which is ${formatSignedWeightChange(changeKg)}.`
        )
    } else if (weights.length === 1) {
        answerParts.push(
            `Her verified weight was ${formatWeightFact(latestWeight)} on ${formatDate(latestWeight.fact_date)}.`
        )
    } else {
        answerParts.push(
            "I do not see verified weight facts in this timeframe."
        )
    }

    if (recentDocs.length) {
        const docText = recentDocs
            .map((doc) => `${doc.title || "Verified document"}${doc.doc_date ? ` (${formatDate(doc.doc_date)})` : ""}`)
            .join("; ")

        answerParts.push(`Recent verified source documents include: ${docText}.`)
    }

    answerParts.push(
        "I can summarize these records, but I cannot determine clinical significance or recommend treatment changes from chat."
    )

    const citations = [
        latestInjection ? eventCitation(latestInjection, "Latest verified Librela injection") : null,
        upcomingReminder ? eventCitation(upcomingReminder, "Planned Librela reminder") : null,
        appointment ? eventCitation(appointment, "Scheduled Librela appointment") : null,
        firstWeight ? factCitation(firstWeight, "Verified weight") : null,
        latestWeight ? factCitation(latestWeight, "Verified weight") : null,
        ...recentDocs.map((doc) => documentCitation(doc, "Recent verified document")),
    ].filter(Boolean)

    return {
        answer: answerParts.join(" "),
        answer_type: "grounded_answer",
        confidence: "high",
        citations: dedupeCitations(citations),
        limitations: [
            "This is a verified care timeline summary, not a medical interpretation.",
            "Labs are not deeply summarized in this care timeline slice yet.",
            "A reminder is not treated as a confirmed appointment.",
        ],
        proposed_action: appointment
            ? null
            : {
                type: "draft_appointment_request",
                status: "available_requires_approval",
                reason:
                    "No future Librela appointment was found in trusted records.",
            },
    }
}

function answerLastWeight(context, queryPlan) {
    const weights = getWeightFactsInRange(context, queryPlan)

    const latest = [...weights].sort(
        (a, b) => new Date(b.fact_date) - new Date(a.fact_date)
    )[0]

    if (!latest) {
        return noTrustedDataAnswer(
            "I don’t have a verified weight record for that timeframe, so I can’t answer from trusted data."
        )
    }

    const rangePhrase = getDateRangePhrase(queryPlan.date_range)

    return {
        answer: `Momo’s last verified weight${rangePhrase ? ` ${rangePhrase}` : ""} was ${formatWeightFact(latest)} on ${formatDate(latest.fact_date)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: [factCitation(latest, "Verified weight")],
        limitations: [
            "This answer uses verified weight facts extracted from trusted TomoCare records.",
        ],
        proposed_action: null,
    }
}

function answerWeightChange(context, queryPlan) {
    const weights = getWeightFactsInRange(context, queryPlan).sort(
        (a, b) => new Date(a.fact_date) - new Date(b.fact_date)
    )

    if (!weights.length) {
        return noTrustedDataAnswer(
            "I don’t have verified weight records for that timeframe, so I can’t answer from trusted data."
        )
    }

    if (weights.length === 1) {
        const only = weights[0]

        return {
            answer: `I only have one verified weight record${getDateRangePhrase(queryPlan.date_range) ? ` ${getDateRangePhrase(queryPlan.date_range)}` : ""}: ${formatWeightFact(only)} on ${formatDate(only.fact_date)}. I need at least two verified weights to determine whether Momo’s weight changed.`,
            answer_type: "grounded_answer",
            confidence: "medium",
            citations: [factCitation(only, "Verified weight")],
            limitations: [
                "At least two verified weight records are needed to calculate change.",
            ],
            proposed_action: null,
        }
    }

    const first = weights[0]
    const latest = weights[weights.length - 1]
    const previous = weights[weights.length - 2]

    const overallChangeKg = getWeightKg(latest) - getWeightKg(first)
    const recentChangeKg = getWeightKg(latest) - getWeightKg(previous)

    const peak = [...weights].sort((a, b) => getWeightKg(b) - getWeightKg(a))[0]
    const low = [...weights].sort((a, b) => getWeightKg(a) - getWeightKg(b))[0]

    const rangePhrase = getDateRangePhrase(queryPlan.date_range)

    return {
        answer: `Yes. Momo’s verified weight has changed${rangePhrase ? ` ${rangePhrase}` : ""}. Her latest verified weight was ${formatWeightFact(latest)} on ${formatDate(latest.fact_date)}. Compared with the previous verified weight on ${formatDate(previous.fact_date)}, she is ${formatSignedWeightChange(recentChangeKg)}. Compared with the first verified weight in this range on ${formatDate(first.fact_date)}, she is ${formatSignedWeightChange(overallChangeKg)}. Her verified range is ${formatWeightFact(low)} to ${formatWeightFact(peak)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: uniqueWeightFactCitations([
            latest,
            previous,
            first,
            low,
            peak,
        ]),
        limitations: [
            "This is a factual weight comparison, not a medical interpretation.",
            "Weights are based only on verified TomoCare records.",
        ],
        proposed_action: null,
    }
}

function answerWeightTrend(context, queryPlan) {
    const weights = getWeightFactsInRange(context, queryPlan).sort(
        (a, b) => new Date(a.fact_date) - new Date(b.fact_date)
    )

    if (!weights.length) {
        return noTrustedDataAnswer(
            "I don’t have verified weight records for that timeframe, so I can’t show a trend from trusted data."
        )
    }

    const rangePhrase = getDateRangePhrase(queryPlan.date_range)
    const first = weights[0]
    const latest = weights[weights.length - 1]
    const overallChangeKg = getWeightKg(latest) - getWeightKg(first)
    const peak = [...weights].sort((a, b) => getWeightKg(b) - getWeightKg(a))[0]
    const low = [...weights].sort((a, b) => getWeightKg(a) - getWeightKg(b))[0]
    const peakChangeKg = getWeightKg(latest) - getWeightKg(peak)
    const recentWeights = weights.slice(-4)
    const recentFirst = recentWeights[0]
    const recentChangeKg = getWeightKg(latest) - getWeightKg(recentFirst)
    const overallDirection = describeWeightDirection(overallChangeKg)
    const recentDirection = describeRecentWeightDirection(recentWeights)
    const recentSentence =
        recentWeights.length >= 3 && recentDirection !== "mixed"
            ? `The ${recentWeights.length} most recent readings ${recentDirection}, from ${formatWeightFact(recentFirst)} on ${formatDate(recentFirst.fact_date)} to ${formatWeightFact(latest)} on ${formatDate(latest.fact_date)} (${formatSignedWeightChange(recentChangeKg)}).`
            : ""

    return {
        answer:
            `Momo’s verified weight trend${rangePhrase ? ` ${rangePhrase}` : ""} is ${overallDirection}. ` +
            `Across ${weights.length} verified records from ${formatDate(first.fact_date)} to ${formatDate(latest.fact_date)}, she ranged from ${formatWeightFact(low)} to ${formatWeightFact(peak)}; her latest weight is ${formatWeightFact(latest)}, ${formatSignedWeightChange(overallChangeKg)} from the first record and ${formatSignedWeightChange(peakChangeKg)} from the highest. ` +
            recentSentence,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: weights.map((fact) => factCitation(fact, "Verified weight")),
        limitations: [
            "This trend uses verified weight facts only.",
            "This is not a medical interpretation of whether the change is clinically meaningful.",
        ],
        proposed_action: null,
    }
}

function answerLibrelaSpend(context, queryPlan) {
    const isVisitTotal = queryPlan.scope === "librela_visit_total"
    const sourceItems = isVisitTotal
        ? context.librelaVisitCostItems
        : context.directLibrelaCostItems

    const items = sourceItems.filter((item) =>
        dateInRange(item.service_date, queryPlan.date_range)
    )

    if (!items.length) {
        return noTrustedDataAnswer(
            isVisitTotal
                ? "I don’t have verified Librela visit cost items for that timeframe, so I can’t calculate the visit total from trusted data."
                : "I don’t have verified direct Librela cost items for that timeframe, so I can’t calculate Librela spend from trusted data."
        )
    }

    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const currency = items[0]?.currency || "USD"
    const rangePhrase = getDateRangePhrase(queryPlan.date_range)
    const uniqueVisitCount = countUnique(items.map((item) => item.doc_id).filter(Boolean))

    if (isVisitTotal) {
        return {
            answer: `Momo’s Librela visit total${rangePhrase ? ` ${rangePhrase}` : ""} is ${formatMoney(total, currency)} across ${items.length} verified line item${items.length === 1 ? "" : "s"} from ${uniqueVisitCount} verified Librela visit${uniqueVisitCount === 1 ? "" : "s"}. This includes all verified cost items on visits where a Librela injection was administered, including nurse or tech visit fees.`,
            answer_type: "grounded_answer",
            confidence: "high",
            citations: items.map((item) =>
                costItemCitation(
                    item,
                    `${item.item_name || "Verified visit cost item"} · ${formatMoney(Number(item.amount || 0), item.currency || currency)}`
                )
            ),
            limitations: [
                "This is a full visit total for visits where a verified Librela injection occurred.",
                "It may include same-visit fees that are not direct medication costs.",
            ],
            proposed_action: null,
        }
    }

    return {
        answer: `Momo’s direct Librela line-item spend${rangePhrase ? ` ${rangePhrase}` : ""} is ${formatMoney(total, currency)} across ${items.length} verified line item${items.length === 1 ? "" : "s"}. This includes Librela medication, injection line items, and discounts. It does not include general nurse or tech visit fees unless the line item itself names Librela.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: items.map((item) =>
            costItemCitation(
                item,
                `${item.item_name || "Verified Librela cost item"} · ${formatMoney(Number(item.amount || 0), item.currency || currency)}`
            )
        ),
        limitations: [
            "This is a direct Librela line-item total, not a full visit total.",
            "General nurse, tech, or office visit fees are excluded unless the line item itself clearly references Librela.",
        ],
        proposed_action: null,
    }
}

function answerLibrelaShotCount(context, queryPlan) {
    const injections = context.librelaInjectionEvents
        .filter((event) => dateInRange(event.event_date, queryPlan.date_range))
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))

    if (!injections.length) {
        return noTrustedDataAnswer(
            "I don’t have verified Librela injection records for that timeframe."
        )
    }

    const rangePhrase = getDateRangePhrase(queryPlan.date_range)

    return {
        answer: `Momo has ${injections.length} verified Librela injection${injections.length === 1 ? "" : "s"}${rangePhrase ? ` ${rangePhrase}` : ""}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: injections.map((event) =>
            eventCitation(event, "Verified Librela injection")
        ),
        limitations: [],
        proposed_action: null,
    }
}

function answerRecentVerifiedRecords(context) {
    const docs = context.documents || []

    if (!docs.length) {
        return noTrustedDataAnswer("I don’t see any verified documents yet.")
    }

    const text = docs
        .slice(0, 5)
        .map((doc) => {
            const title = doc.title || "Verified document"
            return `${title}${doc.doc_date ? ` (${formatDate(doc.doc_date)})` : ""}`
        })
        .join("; ")

    return {
        answer: `The most recent verified records are: ${text}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: docs
            .slice(0, 5)
            .map((doc) => documentCitation(doc, "Verified document")),
        limitations:
            docs.length > 5
                ? ["Only the five most recent verified documents are shown."]
                : [],
        proposed_action: null,
    }
}

function answerActionRequest(queryPlan) {
    if (queryPlan?.subject === "profile") {
        return {
            answer:
                "I can’t change Momo’s Profile from this conversation. Profile corrections must go through TomoCare’s governed edit and review path, and no Profile field was changed.",
            answer_type: "action_request",
            confidence: "high",
            citations: [],
            limitations: [
                "No pets row was mutated.",
                "No Profile change was prepared or proposed.",
            ],
            proposed_action: null,
        }
    }

    return {
        answer:
            "I can help prepare that, but I cannot take action directly from chat. Any booking, message, calendar write, or external action needs to go through TomoCare’s approval gate first.",
        answer_type: "action_request",
        confidence: "high",
        citations: [],
        limitations: [
            "Phase 3A is read-only.",
            "External actions must route through the Phase 2 approval flow.",
        ],
        proposed_action: {
            status: "requires_approval_gate",
            reason:
                "The user asked for an action. TomoCare can prepare actions later, but execution requires explicit approval.",
        },
    }
}

function answerHomeMedicationGivenAction(queryPlan, preparation) {
    const displayName =
        preparation?.displayName ||
        getHomeMedicationDisplayName(queryPlan.subject)
    const preparationStatus =
        preparation?.status || queryPlan?.action?.issue || null

    if (preparationStatus === "prepared") {
        return {
            answer:
                `I prepared ${displayName} as given on ` +
                `${formatDate(preparation.administeredDate)}. Review the details ` +
                "before anything changes in Momo’s care record.",
            answer_type: "action_prepared",
            confidence: "high",
            citations: [
                eventCitation(
                    preparation.reminder,
                    `Current ${displayName} reminder`
                ),
            ],
            limitations: [
                "No medication record or future reminder changes until you approve.",
            ],
            proposed_action: preparation.action,
        }
    }

    if (preparationStatus === "uncertain_statement") {
        const medicationSubject =
            queryPlan?.action?.medication_subject || null
        const administeredDate =
            queryPlan?.action?.administered_date || null

        if (medicationSubject && administeredDate) {
            const medicationName = getHomeMedicationDisplayName(
                medicationSubject
            )

            return actionClarificationAnswer(
                `It sounds like you’re not completely sure whether Momo received ` +
                    `${medicationName} on ${formatDate(administeredDate)}. That’s ` +
                    `okay—I won’t prepare an update while you’re uncertain. If you ` +
                    `confirm she did, tell me, “I gave Momo ${medicationName} on ` +
                    `${administeredDate}.”`
            )
        }

        if (medicationSubject) {
            const medicationName = getHomeMedicationDisplayName(
                medicationSubject
            )

            return actionClarificationAnswer(
                `It sounds like you’re not completely sure whether Momo received ` +
                    `${medicationName}. That’s okay—I won’t prepare an update while ` +
                    "you’re uncertain. If you confirm she did, tell me when."
            )
        }

        return actionClarificationAnswer(
            "It sounds like you’re not completely sure a home medication was " +
                "given. That’s okay—I won’t prepare an update while you’re " +
                "uncertain. Once you confirm, tell me which medication Momo " +
                "received and when."
        )
    }

    if (
        preparationStatus === "missing_medication" ||
        preparationStatus === "multiple_medications"
    ) {
        return actionClarificationAnswer(
            "Which home medication did you give—Simparica Trio or Adequan? Please confirm one medication at a time. Nothing has been changed."
        )
    }

    if (preparationStatus === "unsupported_medication") {
        return actionClarificationAnswer(
            "I can only prepare this at-home update for Simparica Trio or Adequan. Nothing has been changed."
        )
    }

    if (
        preparationStatus === "missing_date" ||
        preparationStatus === "ambiguous_date"
    ) {
        return actionClarificationAnswer(
            `Got it—what day did you give Momo ${displayName}? You can say today, ` +
                "yesterday, or use a date such as 2026-07-26. I won’t prepare " +
                "anything until we have the date."
        )
    }

    if (preparationStatus === "reminder_not_found") {
        return actionClarificationAnswer(
            `I couldn’t find an active ${displayName} reminder to update, so nothing was prepared.`
        )
    }

    if (preparationStatus === "multiple_reminders") {
        return actionClarificationAnswer(
            `I found more than one active ${displayName} reminder. Please review the reminders before recording this dose. Nothing has been changed.`
        )
    }

    if (preparationStatus === "not_eligible") {
        return actionClarificationAnswer(
            `I couldn’t prepare that update: ${preparation.message} Nothing has been changed.`
        )
    }

    return actionClarificationAnswer(
        "I couldn’t safely prepare that medication update. Nothing has been changed."
    )
}

function answerLibrelaAppointmentMessage(preparation) {
    if (preparation?.status === "prepared") {
        const draft = preparation.draft

        return {
            answer:
                `I prepared a Librela appointment request for ${draft.recipient_name} ` +
                `using Momo’s last verified injection on ${formatDate(draft.dates.last_verified_injection_date)} ` +
                `and her current due date of ${formatDate(draft.dates.due_date)}. ` +
                "Review or edit the exact message before approving it. After approval, you can open the draft in Messages and decide whether to send it.",
            answer_type: "message_draft_prepared",
            confidence: "high",
            citations: [
                eventCitation(
                    preparation.injection,
                    "Last verified Librela injection"
                ),
                eventCitation(
                    preparation.reminder,
                    "Current Librela reminder"
                ),
            ],
            limitations: [
                "Nothing has been sent yet. The Messages handoff remains an editable draft until you choose Send in Messages.",
                "TomoCare verifies the clinic’s active SMS recipient on the server before freezing the request for approval.",
            ],
            proposed_action: null,
            message_draft: draft,
            workflow: preparation.workflow,
        }
    }

    const governedLifecycleAnswers = {
        action_proposed:
            "The Librela appointment request is already frozen and waiting for your approval. TomoCare did not prepare a duplicate.",
        action_approved:
            "Your Librela appointment request is still pending. Reopen it to return to the Messages handoff or record whether you sent the draft. TomoCare did not prepare a duplicate.",
        action_executing:
            "TomoCare is confirming the existing Librela request result. It did not prepare or retry another message.",
        action_succeeded:
            preparation?.workflow?.external_action_status ===
            "mock_completed"
                ? "The governed Librela appointment-request test is already complete. The clinic was not contacted, and TomoCare did not prepare a duplicate."
                : preparation?.workflow?.external_action_status ===
                    "user_reported_sent"
                  ? "You marked the Librela appointment request as sent. TomoCare has not verified delivery, a clinic response, or an appointment booking."
                : "The governed Librela appointment request is already complete. TomoCare did not prepare a duplicate.",
        action_failed:
            "The Librela appointment request has a known delivery failure and is locked for review. TomoCare did not retry or prepare a duplicate.",
        action_outcome_unknown:
            "The Librela appointment request has an uncertain delivery outcome and is locked for review. TomoCare did not retry or prepare a duplicate.",
    }

    if (governedLifecycleAnswers[preparation?.status]) {
        return {
            answer: governedLifecycleAnswers[preparation.status],
            answer_type: "governed_action_status",
            confidence: "high",
            citations: [
                ...(preparation.injection
                    ? [
                          eventCitation(
                              preparation.injection,
                              "Last verified Librela injection"
                          ),
                      ]
                    : []),
                ...(preparation.reminder
                    ? [
                          eventCitation(
                              preparation.reminder,
                              "Current Librela reminder"
                          ),
                      ]
                    : []),
            ],
            limitations: [
                "No new message was prepared or sent.",
                "Failed or uncertain delivery states are never retried automatically.",
            ],
            proposed_action: null,
            message_draft: null,
            review_action_id:
                preparation?.status === "action_approved"
                    ? preparation?.workflow?.governed_action_id || null
                    : null,
            workflow: preparation.workflow,
        }
    }

    if (preparation?.status === "appointment_exists") {
        const appointmentDate = getEventPrimaryDate(preparation.appointment)

        return {
            answer:
                `I did not prepare another request because I found a future ` +
                `Librela appointment on ${formatDate(appointmentDate)} in trusted records.`,
            answer_type: "grounded_answer",
            confidence: "high",
            citations: [
                eventCitation(
                    preparation.appointment,
                    "Existing Librela appointment"
                ),
            ],
            limitations: [
                "No duplicate appointment message was drafted.",
            ],
            proposed_action: null,
            message_draft: null,
            workflow: preparation.workflow,
        }
    }

    const messages = {
        reminder_not_found:
            "I couldn’t prepare the message because I don’t see an active planned Librela reminder in trusted records.",
        due_date_not_found:
            "I found the Librela reminder, but it does not contain a trusted due date for the request.",
        injection_not_found:
            "I found the Librela reminder, but I don’t see a verified prior Librela injection to reference.",
        recipient_not_found:
            "I found the Librela schedule, but I couldn’t identify the clinic from trusted records.",
    }

    return {
        answer:
            `${messages[preparation?.status] || "I couldn’t safely prepare that Librela appointment message."} ` +
            "No message was created or sent.",
        answer_type: "clarification_needed",
        confidence: "high",
        citations: [],
        limitations: [
            "TomoCare does not invent missing schedule or recipient details.",
        ],
        proposed_action: null,
        message_draft: null,
        workflow: preparation?.workflow || null,
    }
}

function actionClarificationAnswer(answer) {
    return {
        answer,
        answer_type: "clarification_needed",
        confidence: "high",
        citations: [],
        limitations: [
            "No care action was prepared without the required details.",
        ],
        proposed_action: null,
    }
}

function noTrustedDataAnswer(answer) {
    return {
        answer,
        answer_type: "no_trusted_data",
        confidence: "low",
        citations: [],
        limitations: ["No answer was generated without trusted records."],
        proposed_action: null,
    }
}

function isLibrelaReminder(reminder) {
    const details = reminder.details_json || {}

    const haystack = [
        reminder.event_type,

        details.medication,
        details.medication_name,
        details.item,
        details.item_name,
        details.line_item,
        details.service,
        details.service_name,
        details.subtype,
        details.title,
        details.label,
        details.description,
        details.reason,
        details.treatment,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

function getReminderLabel(reminder) {
    const details = reminder.details_json || {}

    return (
        details.care_item ||
        details.careItem ||
        details.title ||
        details.label ||
        details.subtype ||
        details.description ||
        details.reason ||
        details.medication ||
        details.treatment ||
        "Reminder"
    )
}

function getReminderCitationLabel(reminder) {
    const label = getReminderLabel(reminder)

    return /\breminder\b/i.test(label)
        ? label
        : `${label} reminder`
}

function findMatchingLibrelaReminder(reminders = [], dueDate, reminderDate) {
    return reminders
        .filter(isLibrelaReminder)
        .find((reminder) => {
            const details = reminder.details_json || {}

            const relatedDates = [
                reminder.event_date,
                details.due_date,
                details.dueDate,
                details.target_date,
                details.targetDate,
                details.next_due_date,
                details.nextDueDate,
            ].filter(Boolean)

            return relatedDates.includes(reminderDate) || relatedDates.includes(dueDate)
        })
}

function findNextLibrelaAppointment(appointments = []) {
    const today = getTodayDateString()

    return appointments
        .filter(isLibrelaAppointmentRelated)
        .filter((appointment) => getEventPrimaryDate(appointment) >= today)
        .sort((a, b) => new Date(getEventPrimaryDate(a)) - new Date(getEventPrimaryDate(b)))[0]
}

function isLibrelaAppointmentRelated(appointment) {
    const details = appointment.details_json || {}

    const haystack = [
        appointment.event_type,
        appointment.status,
        details.medication,
        details.medication_name,
        details.item,
        details.item_name,
        details.line_item,
        details.service,
        details.service_name,
        details.subtype,
        details.title,
        details.label,
        details.description,
        details.reason,
        details.treatment,
        details.visit_type,
        details.appointment_type,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

function getEventPrimaryDate(event) {
    if (event.event_date) return event.event_date
    if (event.event_start) return String(event.event_start).slice(0, 10)
    return ""
}

function formatAppointmentStatus(appointment) {
    const status = String(appointment.status || "scheduled").toLowerCase()

    if (status === "planned") return "planned"
    if (status === "confirmed") return "confirmed"
    if (status === "booked") return "booked"
    return "scheduled"
}

function addDays(dateString, days) {
    const [year, month, day] = dateString.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function getWeightFactsInRange(context, queryPlan) {
    return [...(context.verifiedWeightFacts || [])]
        .filter((fact) => dateInRange(fact.fact_date, queryPlan.date_range))
        .filter((fact) => Number.isFinite(getWeightKg(fact)))
}

function getWeightKg(fact) {
    const valueJson = fact.value_json || {}

    if (valueJson.value_kg !== undefined && valueJson.value_kg !== null) {
        return Number(valueJson.value_kg)
    }

    const value = Number(valueJson.value)
    const unit = String(valueJson.unit || "kg").toLowerCase()

    if (!Number.isFinite(value)) return NaN
    if (unit === "lb" || unit === "lbs") return value / 2.2046226218

    return value
}

function getWeightLb(fact) {
    const valueJson = fact.value_json || {}

    if (valueJson.value_lb !== undefined && valueJson.value_lb !== null) {
        return Number(valueJson.value_lb)
    }

    const kg = getWeightKg(fact)
    if (!Number.isFinite(kg)) return NaN

    return kg * 2.2046226218
}

function formatWeightFact(fact) {
    const kg = getWeightKg(fact)
    const lb = getWeightLb(fact)

    if (!Number.isFinite(kg)) return "an unknown weight"

    return `${formatDecimal(kg)} kg${Number.isFinite(lb) ? ` (${formatDecimal(lb)} lb)` : ""}`
}

function formatSignedWeightChange(changeKg) {
    const absKg = Math.abs(changeKg)
    const absLb = absKg * 2.2046226218

    if (Math.abs(changeKg) < 0.01) {
        return "unchanged"
    }

    const direction = changeKg > 0 ? "up" : "down"

    return `${direction} ${formatDecimal(absKg)} kg (${formatDecimal(absLb)} lb)`
}

function describeWeightDirection(changeKg) {
    const absChangeKg = Math.abs(changeKg)

    if (absChangeKg < 0.05) return "stable overall"
    if (absChangeKg <= 0.25) {
        return changeKg > 0
            ? "slightly upward overall"
            : "slightly downward overall"
    }

    return changeKg > 0 ? "upward overall" : "downward overall"
}

function describeRecentWeightDirection(weights) {
    if (weights.length < 2) return "mixed"

    const values = weights.map(getWeightKg)
    const nonDecreasing = values.every(
        (value, index) => index === 0 || value >= values[index - 1] - 0.01
    )
    const nonIncreasing = values.every(
        (value, index) => index === 0 || value <= values[index - 1] + 0.01
    )
    const netChange = values[values.length - 1] - values[0]

    if (nonIncreasing && netChange < -0.05) {
        return "show a gradual downward movement"
    }
    if (nonDecreasing && netChange > 0.05) {
        return "show a gradual upward movement"
    }
    if (Math.abs(netChange) < 0.05) return "remain stable"

    return "mixed"
}

function formatDecimal(value) {
    if (!Number.isFinite(value)) return "unknown"

    return Number(value.toFixed(2)).toString()
}

function formatNaturalList(values = []) {
    if (!values.length) return ""
    if (values.length === 1) return values[0]
    if (values.length === 2) return `${values[0]} and ${values[1]}`

    return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`
}

function uniqueWeightFactCitations(facts) {
    const seen = new Set()

    return facts
        .filter(Boolean)
        .filter((fact) => {
            if (seen.has(fact.id)) return false
            seen.add(fact.id)
            return true
        })
        .map((fact) => factCitation(fact, "Verified weight"))
}

function formatDate(value) {
    if (!value) return "an unknown date"

    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date)
}

function formatMoney(value, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(value)
}

function getTodayDateString() {
    return getCareDate()
}

function countUnique(values) {
    return new Set(values).size
}

function isVaccineRelated(event) {
    const details = event.details_json || {}

    const haystack = [
        event.event_type,
        event.status,
        details.medication,
        details.medication_name,
        details.item,
        details.item_name,
        details.line_item,
        details.service,
        details.service_name,
        details.subtype,
        details.title,
        details.label,
        details.description,
        details.reason,
        details.treatment,
        details.visit_type,
        details.procedure,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return (
        haystack.includes("vaccine") ||
        haystack.includes("vaccination") ||
        haystack.includes("rabies") ||
        haystack.includes("dhpp") ||
        haystack.includes("bordetella") ||
        haystack.includes("lepto")
    )
}

function isRabiesRelated(event) {
    const details = event.details_json || {}

    const haystack = [
        event.event_type,
        details.medication,
        details.medication_name,
        details.item,
        details.item_name,
        details.service,
        details.service_name,
        details.title,
        details.label,
        details.description,
        details.reason,
        details.treatment,
        details.procedure,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("rabies")
}

function findNextUpcomingReminder(reminders = []) {
    const today = getTodayDateString()

    return reminders
        .filter((reminder) => reminder.event_date >= today)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))[0]
}

function dedupeCitations(citations = []) {
    const seen = new Set()

    return citations.filter((citation) => {
        const key = `${citation.table}-${citation.id}`

        if (seen.has(key)) return false

        seen.add(key)
        return true
    })
}

function getHomeMedicationRemindersForSubject(context, subject) {
    const reminders = context.homeMedicationReminders || []

    if (subject === "home_medications") return reminders

    return reminders.filter((event) =>
        getHomeMedicationSubjectFromEvent(event) === subject
    )
}

function getHomeMedicationAdministrationsForSubject(context, subject) {
    const administrations = context.homeMedicationAdministrationEvents || []

    if (subject === "home_medications") return administrations

    return administrations.filter((event) =>
        getHomeMedicationSubjectFromEvent(event) === subject
    )
}

function findLastHomeMedicationAdministration(context, subject) {
    return getHomeMedicationAdministrationsForSubject(context, subject)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0]
}

function getHomeMedicationSubjectFromEvent(event) {
    const careItem = String(event.details_json?.care_item || "").toLowerCase()

    if (careItem.includes("simparica")) return "simparica_trio"
    if (careItem.includes("adequan")) return "adequan"

    return "home_medications"
}

function getHomeMedicationDisplayName(subject) {
    if (subject === "simparica_trio") return "Simparica Trio"
    if (subject === "adequan") return "Adequan"

    return "home medication"
}

function getLatestAdministrationByCareItem(events = []) {
    const latestBySubject = new Map()

    for (const event of events) {
        const subject = getHomeMedicationSubjectFromEvent(event)
        const existing = latestBySubject.get(subject)

        if (!existing || new Date(event.event_date) > new Date(existing.event_date)) {
            latestBySubject.set(subject, event)
        }
    }

    return [...latestBySubject.values()].sort(
        (a, b) => new Date(b.event_date) - new Date(a.event_date)
    )
}
