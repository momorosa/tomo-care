export const DEFAULT_APP_TIME_ZONE = "America/Los_Angeles"

export function getAppTimeZone(env = process.env) {
    const timeZone = env.APP_TIME_ZONE?.trim() || DEFAULT_APP_TIME_ZONE

    assertValidTimeZone(timeZone)
    return timeZone
}

export function getCareDate(
    now = new Date(),
    timeZone = getAppTimeZone()
) {
    const date = now instanceof Date ? now : new Date(now)

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${now}`)
    }

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date)

    const year = getDatePart(parts, "year")
    const month = getDatePart(parts, "month")
    const day = getDatePart(parts, "day")

    return `${year}-${month}-${day}`
}

export function resolveRelativeCareDate(
    value,
    { now = new Date(), timeZone = getAppTimeZone() } = {}
) {
    const normalized = String(value || "").trim().toLowerCase()
    const today = getCareDate(now, timeZone)

    if (normalized === "today") return today
    if (normalized === "yesterday") return addDaysToIsoDate(today, -1)

    throw new Error(`Unsupported relative care date: ${value}`)
}

export function addDaysToIsoDate(dateString, days) {
    const { year, month, day } = parseIsoDate(dateString)

    if (!Number.isInteger(days)) {
        throw new Error(`Day offset must be an integer: ${days}`)
    }

    const date = new Date(Date.UTC(year, month - 1, day))
    date.setUTCDate(date.getUTCDate() + days)

    return date.toISOString().slice(0, 10)
}

function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        throw new Error(`Invalid ISO date: ${value}`)
    }

    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new Error(`Invalid ISO date: ${value}`)
    }

    return { year, month, day }
}

function assertValidTimeZone(timeZone) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone }).format()
    } catch {
        throw new Error(`Invalid APP_TIME_ZONE: ${timeZone}`)
    }
}

function getDatePart(parts, type) {
    const value = parts.find((part) => part.type === type)?.value

    if (!value) {
        throw new Error(`Could not resolve ${type} for care date.`)
    }

    return value
}