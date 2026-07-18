import { getCareDate } from "../lib/careDates.js"

export function resolveDateRange(question, today = new Date()) {
    const q = question.toLowerCase()
    const todayString = getCareDate(today)
    const currentYear = Number(todayString.slice(0, 4))

    const explicitYear = q.match(/\b(20\d{2})\b/)?.[1]

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

    return ""
}
