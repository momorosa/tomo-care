function rowsForDocument(rows, documentId) {
    return (rows || []).filter((row) => row.doc_id === documentId)
}

export function buildHistoricalSnapshots({
    documents = [],
    costItems = [],
    facts = [],
    events = [],
} = {}) {
    return documents.slice(0, 5).map((document) => ({
        document,
        cost_items: rowsForDocument(costItems, document.id),
        facts: rowsForDocument(facts, document.id),
        events: rowsForDocument(events, document.id),
    }))
}

export async function loadComparableVerificationHistory({
    document,
    client,
    limit = 5,
} = {}) {
    if (!document?.pet_id || !client) return []

    let query = client
        .from("documents")
        .select("id, pet_id, doc_type, doc_date, source_org, status")
        .eq("pet_id", document.pet_id)
        .eq("status", "verified")
        .neq("id", document.id)
        .order("doc_date", { ascending: false })
        .limit(Math.min(Number(limit) || 5, 5))

    if (document.doc_type) query = query.eq("doc_type", document.doc_type)
    if (document.source_org) query = query.eq("source_org", document.source_org)

    const { data: documents, error } = await query
    if (error) throw new Error(error.message)
    if (!documents?.length) return []

    const documentIds = documents.map((candidate) => candidate.id)
    const [costItems, facts, events] = await Promise.all([
        client
            .from("cost_items")
            .select(
                "id, doc_id, service_date, category, item_name, amount, currency, status, verified_at"
            )
            .in("doc_id", documentIds)
            .eq("status", "verified"),
        client
            .from("facts")
            .select(
                "id, doc_id, fact_type, fact_date, value_json, status, verified_at"
            )
            .in("doc_id", documentIds)
            .eq("status", "verified"),
        client
            .from("events")
            .select(
                "id, doc_id, event_type, event_date, details_json, status"
            )
            .in("doc_id", documentIds)
            .eq("status", "verified"),
    ])

    for (const result of [costItems, facts, events]) {
        if (result.error) throw new Error(result.error.message)
    }

    return buildHistoricalSnapshots({
        documents,
        costItems: costItems.data || [],
        facts: facts.data || [],
        events: events.data || [],
    })
}
