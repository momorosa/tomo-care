export function eventCitation(event, label) {
    return {
        type: "trusted_event",
        table: "events",
        id: event.id,
        doc_id: event.doc_id,
        label,
        date: event.event_date,
    }
}

export function costItemCitation(item, label) {
    return {
        type: "trusted_cost_item",
        table: "cost_items",
        id: item.id,
        doc_id: item.doc_id,
        label,
        date: item.service_date,
    }
}

export function documentCitation(doc, label) {
    return {
        type: "source_document",
        table: "documents",
        id: doc.id,
        doc_id: doc.id,
        label,
        date: doc.doc_date,
        title: doc.title,
        source_org: doc.source_org,
    }
}