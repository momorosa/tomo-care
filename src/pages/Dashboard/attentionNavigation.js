export const GOOGLE_CALENDAR_HOME_URL =
    "https://calendar.google.com/calendar/u/0/r"

const RECORD_TARGETS = Object.freeze({
    open_reminder: "reminder",
    open_care_action: "care_action",
    open_review_document: "review_document",
})

export function getAttentionNavigationEffect(target, { petId } = {}) {
    if (!target || typeof target !== "object") return null

    const recordType = RECORD_TARGETS[target.kind]
    if (recordType) {
        if (!isRequiredString(target.target_id)) return null

        return {
            type: recordType,
            recordId: target.target_id,
        }
    }

    if (target.kind === "open_profile") {
        if (
            !isRequiredString(target.target_id) ||
            !isRequiredString(petId) ||
            target.target_id !== petId
        ) {
            return null
        }

        return {
            type: "profile",
            recordId: target.target_id,
        }
    }

    if (target.kind === "open_calendar_home") {
        if (target.url !== GOOGLE_CALENDAR_HOME_URL) return null

        return {
            type: "external_url",
            url: GOOGLE_CALENDAR_HOME_URL,
        }
    }

    if (
        target.kind === "open_calendar_event" &&
        isAllowedGoogleCalendarUrl(target.url)
    ) {
        return {
            type: "external_url",
            url: target.url,
        }
    }

    return null
}

function isRequiredString(value) {
    return typeof value === "string" && Boolean(value.trim())
}

function isAllowedGoogleCalendarUrl(value) {
    if (!isRequiredString(value)) return false

    try {
        const url = new URL(value)
        return (
            url.protocol === "https:" &&
            (url.hostname === "calendar.google.com" ||
                (url.hostname === "www.google.com" &&
                    url.pathname.startsWith("/calendar/")))
        )
    } catch {
        return false
    }
}
