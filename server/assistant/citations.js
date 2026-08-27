export function eventCitation(event, label = "Trusted event") {
    return {
        type: "trusted_event",
        table: "events",
        id: event.id,
        doc_id: event.doc_id,
        label,
        date: event.event_date,
    }
}

export function costItemCitation(item, label = "Verified cost item") {
    return {
        type: "verified_cost_item",
        table: "cost_items",
        id: item.id,
        doc_id: item.doc_id,
        label,
        date: item.service_date,
    }
}

export function documentCitation(doc, label = "Verified document") {
    return {
        type: "verified_document",
        table: "documents",
        id: doc.id,
        doc_id: doc.id,
        label,
        date: doc.doc_date,
    }
}

export function factCitation(fact, label = "Verified fact") {
    return {
        type: "trusted_fact",
        table: "facts",
        id: fact.id,
        doc_id: fact.doc_id,
        label,
        date: fact.fact_date,
    }
}

export function enrichCitations(citations = [], context = {}) {
    const documentById = new Map(
        (context.documents || []).map((doc) => [doc.id, doc])
    )

    const eventById = new Map(
        (context.verifiedEvents || [])
            .concat(context.plannedReminders || [])
            .concat(context.scheduledAppointments || [])
            .map((event) => [event.id, event])
    )

    const costItemById = new Map(
        [
            ...(context.directLibrelaCostItems || []),
            ...(context.librelaVisitCostItems || []),
        ].map((item) => [item.id, item])
    )

    const factById = new Map(
        [
            ...(context.verifiedWeightFacts || []),
            ...(context.verifiedPreventiveCareFacts || []),
        ].map((fact) => [fact.id, fact])
    )

    return citations.map((citation) => {
        const sourceDoc = citation.doc_id
            ? documentById.get(citation.doc_id)
            : null

        const sourceRecord =
            citation.table === "events"
                ? eventById.get(citation.id)
                : citation.table === "cost_items"
                    ? costItemById.get(citation.id)
                    : citation.table === "facts"
                        ? factById.get(citation.id)
                        : sourceDoc

        return {
            ...citation,

            display_title: citation.label || getDefaultTitle(citation),
            display_value: getDisplayValue(citation, sourceRecord),
            display_date: citation.date || getRecordDate(sourceRecord),

            source_title: getSourceTitle({ sourceDoc, citation, sourceRecord }),
            source_org: sourceDoc?.source_org || null,
            source_date: sourceDoc?.doc_date || null,
            source_pdf_available: Boolean(sourceDoc?.file_url),
            verification_url: citation.doc_id ? `/review/${citation.doc_id}` : null,

            verification_status: sourceRecord?.status || sourceDoc?.status || "verified",
            verified_at: sourceRecord?.verified_at || null,
            verified_by: sourceRecord?.verified_by || null,

            evidence_note: getEvidenceNote(citation, sourceRecord),
            source_context: getSourceContext(sourceRecord),
        }
    })
}

function getDefaultTitle(citation) {
    if (citation.type === "trusted_fact") return "Verified fact"
    if (citation.type === "trusted_event") return "Trusted event"
    if (citation.type === "verified_cost_item") return "Verified cost item"
    if (citation.type === "verified_document") return "Verified document"

    return "Evidence"
}

function getSourceTitle({ sourceDoc, citation, sourceRecord }) {
    if (sourceDoc?.title) return sourceDoc.title

    if (
        citation.table === "events" &&
        sourceRecord?.details_json?.source === "owner_confirmation" &&
        sourceRecord?.details_json?.care_action_id
    ) {
        return "Owner confirmation through an approved TomoCare action"
    }

    return "Trusted TomoCare record"
}

function getDisplayValue(citation, sourceRecord) {
    if (!sourceRecord) return null

    if (citation.table === "facts") {
        return getFactDisplayValue(sourceRecord)
    }

    if (citation.table === "cost_items") {
        const amount = Number(sourceRecord.amount || 0)
        const currency = sourceRecord.currency || "USD"
        const itemName = sourceRecord.item_name || "Cost item"

        return `${itemName} · ${formatMoney(amount, currency)}`
    }

    if (citation.table === "events") {
        const date = sourceRecord.event_date || sourceRecord.event_start
        return date ? formatDate(date) : null
    }

    if (citation.table === "documents") {
        return sourceRecord.doc_date ? formatDate(sourceRecord.doc_date) : null
    }

    return null
}

function getFactDisplayValue(fact) {
    const valueJson = fact.value_json || {}

    if (fact.fact_type === "weight") {
        const kg = Number(valueJson.value_kg ?? valueJson.value)
        const lb = Number(valueJson.value_lb)

        if (Number.isFinite(kg) && Number.isFinite(lb)) {
            return `${formatDecimal(kg)} kg (${formatDecimal(lb)} lb)`
        }

        if (Number.isFinite(kg)) {
            return `${formatDecimal(kg)} kg`
        }
    }

    if (fact.fact_type === "preventive_care_status") {
        const item = String(valueJson.care_item || "preventive care")
        if (valueJson.clinic_reported_next_due) {
            return `${titleCase(item)} · clinic-reported next due ${formatDate(
                valueJson.clinic_reported_next_due
            )}`
        }
        if (valueJson.clinic_reported_status) {
            return `${titleCase(item)} · clinic reported ${valueJson.clinic_reported_status}`
        }
    }

    if (valueJson.value !== undefined && valueJson.unit) {
        return `${valueJson.value} ${valueJson.unit}`
    }

    return null
}

function getRecordDate(record) {
    return (
        record?.fact_date ||
        record?.event_date ||
        record?.service_date ||
        record?.doc_date ||
        null
    )
}

function getEvidenceNote(citation, sourceRecord) {
    if (!sourceRecord) return null

    if (citation.table === "facts") {
        const method = sourceRecord.value_json?.extraction_method

        if (method === "labeled_weight") {
            return "Extracted from a labeled weight field."
        }

        if (method === "patient_header_weight") {
            return "Extracted from patient metadata in the source document."
        }

        if (sourceRecord.fact_type === "preventive_care_status") {
            return "Verified clinic-reported preventive status; no medical interpretation or reminder was inferred."
        }

        return "Verified fact from trusted TomoCare records."
    }

    if (citation.table === "events") {
        if (
            sourceRecord.details_json?.source === "owner_confirmation" &&
            sourceRecord.details_json?.care_action_id
        ) {
            return "Verified owner confirmation recorded through the approved action."
        }

        return "Trusted event from TomoCare records."
    }

    if (citation.table === "cost_items") {
        return "Verified cost item from the source document."
    }

    return null
}

function titleCase(value) {
    return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function getSourceContext(sourceRecord) {
    return (
        sourceRecord?.value_json?.source_context ||
        sourceRecord?.details_json?.source_context ||
        null
    )
}

function formatMoney(value, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(value)
}

function formatDate(value) {
    if (!value) return null

    const dateValue = String(value).slice(0, 10)
    const date = new Date(`${dateValue}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date)
}

function formatDecimal(value) {
    if (!Number.isFinite(value)) return "unknown"

    return Number(value.toFixed(2)).toString()
}
