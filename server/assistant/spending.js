import { resolveDateRange, dateInRange, getDateRangePhrase } from "./dateRanges.js"
import { costItemCitation } from "./citations.js"

const SCOPES = new Set(["verified_medication_line_items", "direct_librela_line_items", "librela_visit_total"])

export function sanitizeSpendingContext(value) {
    if (!["spend_summary", "spend_clarification"].includes(value?.intent)) return null
    if (value.intent === "spend_summary" && !SCOPES.has(value.scope)) return null
    const range = value.date_range
    let dateRange = resolveDateRange("")
    if (range && range.type !== "all_time") {
        if (!/^20\d{2}-\d{2}-\d{2}$/.test(range.end || "")) return null
        const date = new Date(`${range.end}T12:00:00Z`)
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== range.end) return null
        if (range.type === "year_to_date") dateRange = resolveDateRange("this year", range.end)
        else if (range.type === "calendar_year") dateRange = resolveDateRange(range.end.slice(0, 4))
        else if (range.type === "calendar_month") {
            const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })
            dateRange = resolveDateRange(`${month} ${range.end.slice(0, 4)}`)
        } else return null
        if (dateRange.start !== range.start || dateRange.end !== range.end) return null
    }
    return {
        intent: value.intent,
        subject: value.scope === "verified_medication_line_items" ? "medications" : value.intent === "spend_summary" ? "librela" : null,
        scope: value.intent === "spend_summary" ? value.scope : null,
        date_range: dateRange,
    }
}

export function resolveSpendingPlan(question, dateRange, previous) {
    const q = question.toLowerCase().replace(/[’]/g, "'").replace(/[,.!?]/g, "").trim()
    const spending = /\b(spend(?:ing)?|spent|costs?|paid|expenses?)\b/.test(q)
    const medication = /\b(medications?|medicines?|meds|prescriptions?)\b/.test(q)
    const context = sanitizeSpendingContext(previous)
    const shortFollowup = /^(?:(?:the |all |all of |her |momo's )?(?:spending|costs|medications?|meds|librela|librela visits?|full librela visits?)(?: costs| spending)?(?: please)?|what about (?:last year|this year|20\d{2})|and (?:last year|this year|20\d{2}))$/.test(q)
    if (!spending && !(medication && /how much/.test(q)) && !(context && shortFollowup)) return null
    // Named Librela questions retain the existing direct-versus-visit distinction.
    let scope = /\blibrela\b/.test(q)
        ? /\b(visit|visits|appointment)\b/.test(q) ? "librela_visit_total" : "direct_librela_line_items"
        : medication ? "verified_medication_line_items" : context && shortFollowup ? context.scope : null
    // Never broaden a named medication to all medications just because it mentions costs.
    if (/\b(adequan|simparica|rabies)\b/.test(q)) scope = null
    const inheritedRange = context && shortFollowup && dateRange.type === "all_time" && !/all time|ever/.test(q)
    return {
        intent: scope ? "spend_summary" : "spend_clarification",
        subject: scope === "verified_medication_line_items" ? "medications" : scope ? "librela" : null,
        scope: scope || "clarification_needed",
        date_range: inheritedRange ? context.date_range : dateRange,
        trusted_only: true, requires_action: false, action: null,
    }
}

export function answerMedicationSpend(context, plan) {
    const items = (context.verifiedMedicationCostItems || []).filter(item =>
        item.status === "verified" && item.category === "medication" && dateInRange(item.service_date, plan.date_range)
    )
    const invalid = items.some(item => item.amount === null || item.amount === "" ||
        !Number.isFinite(Number(item.amount)) || !/^[A-Z]{3}$/.test(item.currency || "") || !item.service_date)
    if (!items.length || invalid) return {
        answer: invalid
            ? "Some verified medication costs are missing a usable amount, currency, or date, so I can’t give a reliable medication total yet."
            : "I don’t have verified medication cost items for that timeframe, so I can’t calculate medication spending from trusted data.",
        answer_type: "no_trusted_data", confidence: "high", citations: [], proposed_action: null,
        limitations: ["Missing or invalid costs are not treated as zero spending."],
    }
    const groups = new Map()
    for (const item of items) {
        const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency, currencyDisplay: "code" })
        const scale = 10 ** formatter.resolvedOptions().maximumFractionDigits
        const group = groups.get(item.currency) || { minor: 0, scale, formatter }
        group.minor += Math.round(Number(item.amount) * scale)
        groups.set(item.currency, group)
    }
    const totals = [...groups.values()].map(group => group.formatter.format(group.minor / group.scale)).join(" and ")
    const period = getDateRangePhrase(plan.date_range)
    return {
        answer: `Momo’s verified medication line-item spending${period ? ` ${period}` : ""} totals ${totals} across ${items.length} verified line item${items.length === 1 ? "" : "s"}. This includes only items categorized as medication; visit fees and other categories are excluded.`,
        answer_type: "grounded_answer", confidence: "high", proposed_action: null,
        citations: items.map(item => costItemCitation(item, `${item.item_name || "Medication"} · ${item.currency} ${item.amount}`)),
        limitations: ["This is the medication subtotal in verified records, not proof of all actual spending. Medication-category credits and discounts are included; other categories are not allocated to medication.", ...(groups.size > 1 ? ["Currencies are totaled separately; no currency conversion is inferred."] : [])],
    }
}
