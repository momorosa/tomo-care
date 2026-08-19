import { addDaysToIsoDate, getCareDate } from "../lib/careDates.js"

export function resolveDateRange(question, today = new Date()) {
    const q = question.toLowerCase()
    const todayString = /^\d{4}-\d{2}-\d{2}$/.test(String(today))
        ? String(today)
        : getCareDate(today)
    const currentYear = Number(todayString.slice(0, 4))

    const explicitYear = q.match(/\b(20\d{2})\b/)?.[1]
    const explicitMonth = getExplicitMonth(q)

    if (explicitMonth) {
        const year = Number(explicitYear || currentYear)
        const month = explicitMonth.index + 1
        const monthNumber = String(month).padStart(2, "0")
        const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

        return {
            type: "calendar_month",
            label: `${explicitMonth.label} ${year}`,
            start: `${year}-${monthNumber}-01`,
            end: `${year}-${monthNumber}-${String(endDay).padStart(2, "0")}`,
        }
    }

    if (explicitYear) {
        return {
            type: "calendar_year",
            label: explicitYear,
            start: `${explicitYear}-01-01`,
            end: `${explicitYear}-12-31`,
        }
    }

    if (
        q.includes("year to date") ||
        q.includes("ytd") ||
        q.includes("this year")
    ) {
        return {
            type: "year_to_date",
            label: "year to date",
            start: `${currentYear}-01-01`,
            end: todayString,
        }
    }

    if (q.includes("last year")) {
        const year = currentYear - 1

        return {
            type: "calendar_year",
            label: String(year),
            start: `${year}-01-01`,
            end: `${year}-12-31`,
        }
    }

    return {
        type: "all_time",
        label: "all time",
        start: null,
        end: null,
    }
}

export function resolveAttentionDateRange(question, today = new Date()) {
    const q = question.toLowerCase()
    const todayString = /^\d{4}-\d{2}-\d{2}$/.test(String(today))
        ? String(today)
        : getCareDate(today)

    if (/\btomorrow\b/.test(q)) {
        const tomorrow = addDaysToIsoDate(todayString, 1)
        return {
            type: "next_care_day",
            label: "tomorrow",
            start: tomorrow,
            end: tomorrow,
        }
    }

    if (/\btoday\b/.test(q)) {
        return {
            type: "care_day",
            label: "today",
            start: todayString,
            end: todayString,
        }
    }

    if (/\bthis week\b/.test(q)) {
        const dayOfWeek = new Date(`${todayString}T00:00:00.000Z`).getUTCDay()
        const daysUntilSunday = (7 - dayOfWeek) % 7

        return {
            type: "current_week",
            label: "this week",
            start: todayString,
            end: addDaysToIsoDate(todayString, daysUntilSunday),
        }
    }

    if (/\bthis month\b/.test(q)) {
        const [year, month] = todayString.split("-").map(Number)
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

        return {
            type: "current_month",
            label: "this month",
            start: todayString,
            end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
        }
    }

    return {
        type: "all_time",
        label: "current attention",
        start: null,
        end: null,
    }
}

export function dateInRange(value, dateRange) {
    if (!value || !dateRange) return true
    if (!dateRange.start && !dateRange.end) return true

    if (dateRange.start && value < dateRange.start) return false
    if (dateRange.end && value > dateRange.end) return false

    return true
}

export function getDateRangePhrase(dateRange) {
    if (!dateRange || dateRange.type === "all_time") {
        return ""
    }

    if (dateRange.type === "year_to_date") {
        return "year to date"
    }

    if (dateRange.type === "calendar_year") {
        return `in ${dateRange.label}`
    }

    if (dateRange.type === "calendar_month") {
        return `in ${dateRange.label}`
    }

    if (
        ["care_day", "next_care_day", "current_week", "current_month"].includes(
            dateRange.type
        )
    ) {
        return dateRange.label
    }

    return ""
}

function getExplicitMonth(question) {
    const months = [
        ["january", "jan"],
        ["february", "feb"],
        ["march", "mar"],
        ["april", "apr"],
        ["may"],
        ["june", "jun"],
        ["july", "jul"],
        ["august", "aug"],
        ["september", "sep", "sept"],
        ["october", "oct"],
        ["november", "nov"],
        ["december", "dec"],
    ]

    for (const [index, aliases] of months.entries()) {
        if (
            aliases[0] === "may" &&
            !looksLikeCalendarMay(question)
        ) {
            continue
        }

        if (new RegExp(`\\b(?:${aliases.join("|")})\\b`).test(question)) {
            return {
                index,
                label:
                    aliases[0].charAt(0).toUpperCase() +
                    aliases[0].slice(1),
            }
        }
    }

    return null
}

function looksLikeCalendarMay(question) {
    if (!/\bmay\b/.test(question)) return false

    return (
        /^may[?.!]*$/.test(question.trim()) ||
        /\bmay\s+20\d{2}\b/.test(question) ||
        /\b20\d{2}\s+may\b/.test(question) ||
        /\b(?:in|during|for|from|through|until|since|before|after)\s+may\b/.test(
            question
        ) ||
        /\b(?:calendar|schedule|timeline|records?|events?|appointments?)\b[^.!?]*\bmay\b/.test(
            question
        )
    )
}
