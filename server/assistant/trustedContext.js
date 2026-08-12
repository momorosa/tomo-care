export function buildTrustedContextFromRows({
    petId,
    events = [],
    costItems = [],
    documents = [],
    facts = [],
} = {}) {
    const verifiedEvents = events.filter((event) => event.status === "verified")
    const plannedReminders = events.filter(
        (event) => event.status === "planned" && event.event_type === "reminder"
    )
    const homeMedicationReminders = plannedReminders.filter(
        isHomeMedicationReminder
    )
    const homeMedicationAdministrationEvents = verifiedEvents
        .filter((event) => event.event_type === "medication_administration")
        .filter(isHomeMedicationRelated)
    const scheduledAppointments = events.filter(isScheduledAppointment)
    const librelaInjectionEvents = verifiedEvents
        .filter((event) => event.event_type === "injection")
        .filter(isLibrelaRelated)
    const librelaInjectionDocIds = new Set(
        librelaInjectionEvents.map((event) => event.doc_id).filter(Boolean)
    )
    const directLibrelaCostItems = costItems.filter(isLibrelaRelated)
    const librelaVisitCostItems = costItems.filter(
        (item) => item.doc_id && librelaInjectionDocIds.has(item.doc_id)
    )
    const verifiedWeightFacts = facts
        .filter((fact) => fact.fact_type === "weight")
        .filter((fact) => fact.fact_date)
        .filter((fact) => fact.value_json?.value_kg || fact.value_json?.value)

    return {
        petId,
        verifiedEvents,
        plannedReminders,
        scheduledAppointments,
        documents,
        verifiedWeightFacts,
        homeMedicationReminders,
        homeMedicationAdministrationEvents,
        librelaInjectionEvents,
        directLibrelaCostItems,
        librelaVisitCostItems,
    }
}

export function isLibrelaRelated(row) {
    const details = row.details_json || {}
    const haystack = [
        row.event_type,
        row.category,
        row.item_name,
        details.medication,
        details.medication_name,
        details.drug,
        details.drug_name,
        details.product,
        details.product_name,
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
        details.procedure,
        details.treatment,
        details.visit_type,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return haystack.includes("librela")
}

export function isScheduledAppointment(event) {
    const details = event.details_json || {}
    const eventType = String(event.event_type || "").toLowerCase()
    const status = String(event.status || "").toLowerCase()
    const haystack = [
        event.event_type,
        status,
        details.type,
        details.subtype,
        details.title,
        details.label,
        details.description,
        details.reason,
        details.visit_type,
        details.appointment_type,
        details.service,
        details.service_name,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    const looksLikeAppointment =
        eventType === "appointment" ||
        haystack.includes("appointment") ||
        haystack.includes("appt") ||
        haystack.includes("booked") ||
        haystack.includes("scheduled")
    const looksScheduled =
        status === "planned" ||
        status === "scheduled" ||
        status === "confirmed" ||
        status === "booked"

    return looksLikeAppointment && looksScheduled
}

function isHomeMedicationReminder(event) {
    const details = event.details_json || {}

    return (
        event.event_type === "reminder" &&
        event.status === "planned" &&
        (details.reminder_type === "home_medication" ||
            details.care_category === "at_home_medication" ||
            details.care_category === "at_home_injection")
    )
}

function isHomeMedicationRelated(event) {
    const details = event.details_json || {}
    const haystack = [
        event.event_type,
        details.care_item,
        details.care_category,
        details.reminder_type,
        details.route,
        details.source,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

    return (
        haystack.includes("simparica") ||
        haystack.includes("adequan") ||
        haystack.includes("home_medication") ||
        haystack.includes("at_home_medication") ||
        haystack.includes("at_home_injection")
    )
}
