const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/
const ISO_DATE_IN_TEXT_PATTERN = /\b(\d{4})-(\d{2})-(\d{2})\b/g

export function formatDisplayDate(value, fallback = "—") {
    if (!value) return fallback

    const match = String(value).match(ISO_DATE_PATTERN)
    if (!match || !isValidIsoDate(match[1], match[2], match[3])) {
        return String(value)
    }

    return `${match[2]}-${match[3]}-${match[1]}`
}

export function formatIsoDatesInText(value) {
    if (!value) return ""

    return String(value).replace(
        ISO_DATE_IN_TEXT_PATTERN,
        (match, year, month, day) =>
            isValidIsoDate(year, month, day)
                ? `${month}-${day}-${year}`
                : match
    )
}

function isValidIsoDate(year, month, day) {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

    return (
        date.getUTCFullYear() === Number(year) &&
        date.getUTCMonth() === Number(month) - 1 &&
        date.getUTCDate() === Number(day)
    )
}
