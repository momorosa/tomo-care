import {
    costItemCitation,
    documentCitation,
    eventCitation,
} from "./citations.js"
import {
    dateInRange,
    getDateRangePhrase,
} from "./dateRanges.js"

export function composeGroundedAnswer({ question, queryPlan, context }) {
    let response

    switch (queryPlan.intent) {
        case "last_librela":
            response = answerLastLibrela(context, queryPlan)
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
            response = answerActionRequest()
            break

        default:
            response = {
                answer:
                    "I don’t have enough trusted information to answer that yet. I can only answer from verified TomoCare records, and this question is not supported in the first read-only assistant slice.",
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
        query_plan: queryPlan,
    }
}

function answerLastLibrela(context, queryPlan) {
    const injections = context.librelaInjectionEvents
        .filter((event) => dateInRange(event.event_date, queryPlan.date_range))
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))

    const latest = injections[0]

    if (!latest) {
        return noTrustedDataAnswer(
            "I don’t have a verified Librela injection record for that timeframe, so I can’t answer from trusted data."
        )
    }

    const rangePhrase = getDateRangePhrase(queryPlan.date_range)

    return {
        answer: `Momo’s last verified Librela injection${rangePhrase ? ` ${rangePhrase}` : ""} was on ${formatDate(latest.event_date)}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: [eventCitation(latest, "Verified Librela injection")],
        limitations: [],
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

function answerActiveReminders(context) {
    const reminders = [...context.plannedReminders].sort(
        (a, b) => new Date(a.event_date) - new Date(b.event_date)
    )

    if (!reminders.length) {
        return noTrustedDataAnswer("I don’t see any active planned reminders right now.")
    }

    const reminderText = reminders
        .slice(0, 5)
        .map((reminder) => {
            const label = getReminderLabel(reminder)
            return `${label} on ${formatDate(reminder.event_date)}`
        })
        .join("; ")

    return {
        answer: `I found ${reminders.length} active planned reminder${reminders.length === 1 ? "" : "s"}: ${reminderText}.`,
        answer_type: "grounded_answer",
        confidence: "high",
        citations: reminders
            .slice(0, 5)
            .map((reminder) => eventCitation(reminder, "Planned reminder")),
        limitations:
            reminders.length > 5
                ? ["Only the first five reminders are shown in this answer."]
                : [],
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

function answerActionRequest() {
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
    return new Date().toISOString().slice(0, 10)
}

function countUnique(values) {
    return new Set(values).size
}