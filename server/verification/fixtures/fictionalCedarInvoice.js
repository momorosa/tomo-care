export const FICTIONAL_CURRENT_DOCUMENT = Object.freeze({
    id: "71000000-0000-4000-8000-000000000006",
    pet_id: "70000000-0000-4000-8000-000000000001",
    doc_type: "receipt",
    doc_date: "2026-08-16",
    source_org: "Cedar Grove Veterinary Center",
    title: "SAMPLE — DEMO DATA — Cedar Grove receipt",
    status: "needs_review",
})

export const FICTIONAL_CURRENT_RAW_TEXT = `
SAMPLE — DEMO DATA
Cedar Grove Veterinary Center
Patient: Poppy
Invoice date: 08/16/2026
Weight: 15.0 kg

Nurse Office Visit                         $44.00
Injection Librela                         -$14.78
Librela 10 mg/ml Solution Vial             $99.53
Injection Librela                          $31.65
Total paid                                $160.40

Future care reminders
Rabies vaccine due: 02/10/2027
Annual wellness exam due: 08/01/2027
Senior lab panel: discuss at next annual visit
`.trim()

export const FICTIONAL_CURRENT_EXTRACTED = Object.freeze({
    doc_type: "receipt",
    doc_date: "2026-08-16",
    source_org: "Cedar Grove Veterinary Center",
    invoice_id: "DEMO-081626",
    summary: "Librela nurse visit for fictional patient Poppy.",
    weight_measurement: {
        value: 15,
        unit: "kg",
        measured_date: "2026-08-16",
        source_label: "Weight",
        source_context: "Patient: Poppy · Weight: 15.0 kg",
    },
    events: [],
    cost_items: [
        {
            service_date: "2026-08-16",
            category: "visit",
            label: "Nurse Office Visit",
            amount: 44,
            currency: "USD",
        },
        {
            service_date: "2026-08-16",
            category: "medication",
            label: "Injection Librela",
            amount: -14.78,
            currency: "USD",
        },
        {
            service_date: "2026-08-16",
            category: "medication",
            label: "Librela 10 mg/ml Solution Vial",
            amount: 99.53,
            currency: "USD",
        },
        {
            service_date: "2026-08-16",
            category: "medication",
            label: "Injection Librela",
            amount: 31.65,
            currency: "USD",
        },
    ],
    totals: { paid: 160.4, currency: "USD" },
    labs: [],
    confidence: 1,
    notes: "Wholly fictional Phase 3E.5 test fixture.",
})

const HISTORY_DATES = [
    "2026-06-16",
    "2026-04-16",
    "2026-02-16",
    "2025-12-16",
    "2025-10-16",
]
const HISTORY_WEIGHTS = [15.2, 15.1, 15.3, 15.2, 15.4]

export const FICTIONAL_TRUSTED_HISTORY = Object.freeze(
    HISTORY_DATES.map((date, index) => {
        const documentId = `71000000-0000-4000-8000-00000000000${5 - index}`
        return {
            document: {
                id: documentId,
                pet_id: FICTIONAL_CURRENT_DOCUMENT.pet_id,
                doc_type: "receipt",
                doc_date: date,
                source_org: FICTIONAL_CURRENT_DOCUMENT.source_org,
                status: "verified",
            },
            cost_items: FICTIONAL_CURRENT_EXTRACTED.cost_items.map((item) => ({
                doc_id: documentId,
                service_date: date,
                category: item.category,
                item_name: item.label,
                amount: item.amount,
                currency: "USD",
                status: "verified",
            })),
            facts: [
                {
                    doc_id: documentId,
                    fact_type: "weight",
                    fact_date: date,
                    value_json: {
                        value: HISTORY_WEIGHTS[index],
                        unit: "kg",
                        value_kg: HISTORY_WEIGHTS[index],
                    },
                    status: "verified",
                },
            ],
            events: [],
        }
    })
)

export function buildMatchingSourceReview(extracted = FICTIONAL_CURRENT_EXTRACTED) {
    const fields = []
    const add = (path) =>
        fields.push({
            path,
            state: "source_match",
            reason: "The fictional source clearly supports this value.",
        })

    for (const path of ["invoice_id", "doc_date", "source_org", "summary"]) {
        if (path in extracted) add(path)
    }
    if (extracted.totals && "paid" in extracted.totals) add("totals.paid")
    if (extracted.weight_measurement) {
        add("weight_measurement.value")
        add("weight_measurement.unit")
        add("weight_measurement.measured_date")
    }
    extracted.events?.forEach((event, index) => {
        add(`events[${index}].event_type`)
        add(`events[${index}].event_date`)
        if (event?.details_json?.description != null) {
            add(`events[${index}].description`)
        }
    })
    extracted.cost_items?.forEach((item, index) => {
        add(`cost_items[${index}].label`)
        add(`cost_items[${index}].amount`)
        add(`cost_items[${index}].service_date`)
    })

    return { failed: false, model: "fictional-source-reviewer", fields }
}
