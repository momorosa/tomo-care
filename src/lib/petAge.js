export function getAgeInYears(birthDate, currentDate = new Date()) {
    const parts = String(birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!parts) return null

    const birthYear = Number(parts[1])
    const birthMonth = Number(parts[2])
    const birthDay = Number(parts[3])
    const today = normalizeCurrentDate(currentDate)

    if (!today) return null

    let age = today.year - birthYear
    const birthdayHasPassed =
        today.month > birthMonth ||
        (today.month === birthMonth && today.day >= birthDay)

    if (!birthdayHasPassed) age -= 1

    return age >= 0 ? age : null
}

export function formatAge(birthDate, currentDate = new Date()) {
    const age = getAgeInYears(birthDate, currentDate)
    if (age === null) return "Age not set"
    return `${age} ${age === 1 ? "year" : "years"}`
}

function normalizeCurrentDate(value) {
    if (typeof value === "string") {
        const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (!parts) return null
        return {
            year: Number(parts[1]),
            month: Number(parts[2]),
            day: Number(parts[3]),
        }
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null

    return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
    }
}
