import { sbAdmin } from "../supabase.js"

export async function buildTrustedContext(petId) {
    const [eventsResult, costItemsResult, docsResult, factsResult] = await Promise.all([
        sbAdmin
            .from("events")
            .select("id, pet_id, doc_id, event_type, event_date, event_start, event_end, status, details_json, created_at, updated_at")
            .eq("pet_id", petId)
            .in("status", ["verified", "planned", "scheduled", "confirmed", "booked"])
            .order("event_date", { ascending: false }),

        sbAdmin
            .from("cost_items")
            .select("id, pet_id, doc_id, service_date, category, item_name, amount, currency, status, verified_at, verified_by")
            .eq("pet_id", petId)
            .eq("status", "verified")
            .order("service_date", { ascending: false }),

        sbAdmin
            .from("documents")
            .select("id, title, doc_type, doc_date, source_org, status, file_url, updated_at")
            .eq("pet_id", petId)
            .eq("status", "verified")
            .order("doc_date", { ascending: false })
            .limit(20),
        sbAdmin
            .from("facts")
            .select("id, pet_id, doc_id, fact_type, fact_date, value_json, status, confidence, verified_at, verified_by")
            .eq("pet_id", petId)
            .eq("status", "verified")
            .order("fact_date", { ascending: false })
    ])

    if (eventsResult.error) throw new Error(eventsResult.error.message)
    if (costItemsResult.error) throw new Error(costItemsResult.error.message)
    if (docsResult.error) throw new Error(docsResult.error.message)
    if (factsResult.error) throw new Error(factsResult.error.message)

    const events = eventsResult.data || []
    const costItems = costItemsResult.data || []
    const documents = docsResult.data || []
    const facts = factsResult.data || []

    const verifiedEvents = events.filter((event) => event.status === "verified")
    const plannedReminders = events.filter(
        (event) => event.status === "planned" && event.event_type === "reminder"
    )

    const scheduledAppointments = events.filter(isScheduledAppointment)

    const librelaInjectionEvents = verifiedEvents
        .filter((event) => event.event_type === "injection")
        .filter(isLibrelaRelated)

    const librelaInjectionDocIds = new Set(
        librelaInjectionEvents
            .map((event) => event.doc_id)
            .filter(Boolean)
    )

    const directLibrelaCostItems = costItems.filter(isLibrelaRelated)

    const librelaVisitCostItems = costItems.filter((item) =>
        item.doc_id && librelaInjectionDocIds.has(item.doc_id)
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