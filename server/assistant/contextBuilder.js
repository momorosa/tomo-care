import { sbAdmin } from "../supabase.js"
import { buildTrustedContextFromRows } from "./trustedContext.js"

export {
    buildTrustedContextFromRows,
    isLibrelaRelated,
    isScheduledAppointment,
} from "./trustedContext.js"

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
            .limit(50),

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

    return buildTrustedContextFromRows({
        petId,
        events: eventsResult.data || [],
        costItems: costItemsResult.data || [],
        documents: docsResult.data || [],
        facts: factsResult.data || [],
    })
}
