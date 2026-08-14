import { normalizeProfileFields } from "../profile/governedProfile.js"

export function summarizeVerifiedCareEvents(events = []) {
    const verifiedEvents = events
        .filter((event) => event?.status === "verified" && event?.event_date)
        .sort((a, b) => compareDateDescending(a.event_date, b.event_date))

    const latestVerifiedCare = verifiedEvents[0] || null
    const lastLibrela = verifiedEvents.find(
        (event) => event.event_type === "injection" && isLibrelaRelated(event)
    ) || null

    return {
        latest_verified_care: toSummaryItem(latestVerifiedCare),
        last_librela: toSummaryItem(lastLibrela),
    }
}

export function summarizePetProfile(pet, currentCareDate) {
    if (!pet) return null

    return normalizeProfileFields(pet, currentCareDate)
}

function isLibrelaRelated(event) {
    const details = event?.details_json || {}
    const haystack = [
        event?.event_type,
        details.medication,
        details.medication_name,
        details.drug,
        details.care_item,
        details.subtype,
        details.title,
        details.description,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

function toSummaryItem(event) {
    if (!event) return null

    return {
        id: event.id,
        event_type: event.event_type,
        event_date: event.event_date,
        care_item:
            event.details_json?.care_item ||
            event.details_json?.medication ||
            event.details_json?.subtype ||
            null,
    }
}

function compareDateDescending(a, b) {
    return String(b).localeCompare(String(a))
}
