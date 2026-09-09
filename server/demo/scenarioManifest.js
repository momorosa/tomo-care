import { addDaysToIsoDate } from "../lib/careDates.js"

export const DEMO_SCENARIO_ID = "tomocare-demo-v1"
export const DEMO_PROJECT_REF = "gohzjjqsbtwavjuhjdwj"
export const DEMO_PROJECT_URL = `https://${DEMO_PROJECT_REF}.supabase.co`
export const DEMO_PET_ID = "d3000000-0000-4000-8000-000000000001"
export const DEMO_STORAGE_BUCKET = "tomo-docs"
export const DEMO_STORAGE_PREFIX = `demo/${DEMO_SCENARIO_ID}`
export const DEMO_INTAKE_DOCUMENT_ID =
    "d3100000-0000-4000-8000-000000000006"
export const DEMO_INTAKE_FIXTURE = Object.freeze({
    documentId: DEMO_INTAKE_DOCUMENT_ID,
    filename: "tomocare-demo-v1-harborlight-invoice.pdf",
    mimeType: "application/pdf",
    contentSha256:
        "d6e63c3b9f9dfdb4631d425bbdfc41f370e52f32d40922d31ab6e1fe725cb702",
    subjectPrefix: "[TomoCare Demo]",
    storageKey: `${DEMO_STORAGE_PREFIX}/intake/tomocare-demo-v1-harborlight-invoice.pdf`,
    title: "SAMPLE — DEMO DATA — Harborlight Veterinary invoice",
    fixtureKind: "gmail-intake-invoice",
})

export const DEMO_OWNED_TABLES = Object.freeze([
    "apple_messages_handoffs",
    "care_actions",
    "orchestration_runs",
    "cost_items",
    "labs",
    "facts",
    "events",
    "documents",
    "provider_contacts",
    "pets",
])

export const DEMO_RECORD_IDS = Object.freeze({
    pet: DEMO_PET_ID,
    documents: Object.freeze([
        "d3100000-0000-4000-8000-000000000001",
        "d3100000-0000-4000-8000-000000000002",
        "d3100000-0000-4000-8000-000000000003",
        "d3100000-0000-4000-8000-000000000004",
        "d3100000-0000-4000-8000-000000000005",
    ]),
    events: Object.freeze([
        "d3200000-0000-4000-8000-000000000001",
        "d3200000-0000-4000-8000-000000000002",
        "d3200000-0000-4000-8000-000000000003",
        "d3200000-0000-4000-8000-000000000004",
    ]),
    facts: Object.freeze([
        "d3300000-0000-4000-8000-000000000001",
        "d3300000-0000-4000-8000-000000000002",
        "d3300000-0000-4000-8000-000000000003",
        "d3300000-0000-4000-8000-000000000004",
        "d3300000-0000-4000-8000-000000000005",
    ]),
    costItems: Object.freeze([
        "d3400000-0000-4000-8000-000000000001",
    ]),
    providerContacts: Object.freeze([]),
    intakeDocument: DEMO_INTAKE_DOCUMENT_ID,
})

const WEIGHT_READINGS = Object.freeze([
    Object.freeze({ offsetDays: -330, valueKg: 13.8 }),
    Object.freeze({ offsetDays: -220, valueKg: 13.6 }),
    Object.freeze({ offsetDays: -110, valueKg: 13.5 }),
    Object.freeze({ offsetDays: -35, valueKg: 13.3 }),
])

export function buildDemoScenario(careDate) {
    assertIsoDate(careDate)

    const timestamp = `${careDate}T12:00:00.000Z`
    const weightDates = WEIGHT_READINGS.map(({ offsetDays }) =>
        addDaysToIsoDate(careDate, offsetDays)
    )
    const vaccineRecordDate = addDaysToIsoDate(careDate, -60)
    const rabiesNextDueDate = addDaysToIsoDate(careDate, 360)
    const librelaInjectionDate = addDaysToIsoDate(careDate, -35)
    const librelaDueDate = addDaysToIsoDate(careDate, 14)
    const simparicaAdministrationDate = addDaysToIsoDate(careDate, -30)
    const simparicaDueDate = addDaysToIsoDate(careDate, 2)

    const documents = [
        ...weightDates.map((docDate, index) => ({
            id: DEMO_RECORD_IDS.documents[index],
            pet_id: DEMO_PET_ID,
            doc_type: index === 3 ? "receipt" : "wellness_summary",
            title:
                index === 3
                    ? "SAMPLE — DEMO DATA — Pain-management visit"
                    : `SAMPLE — DEMO DATA — Wellness visit ${index + 1}`,
            doc_date: docDate,
            source_org: "Harborlight Veterinary Center",
            source_person: "Dr. Avery Chen",
            file_url: null,
            raw_text: null,
            text_extracted: null,
            triage_result: null,
            remarks:
                "SAMPLE — DEMO DATA. Metadata-only fictional source fixture.",
            external_refs: demoExternalRefs(`weight-source-${index + 1}`),
            status: "verified",
            created_at: timestamp,
            updated_at: timestamp,
        })),
        {
            id: DEMO_RECORD_IDS.documents[4],
            pet_id: DEMO_PET_ID,
            doc_type: "vaccination_certificate",
            title: "SAMPLE — DEMO DATA — Preventive-care status",
            doc_date: vaccineRecordDate,
            source_org: "Harborlight Veterinary Center",
            source_person: "Dr. Avery Chen",
            file_url: null,
            raw_text: null,
            text_extracted: null,
            triage_result: null,
            remarks:
                "SAMPLE — DEMO DATA. Metadata-only fictional source fixture.",
            external_refs: demoExternalRefs("preventive-status-source"),
            status: "verified",
            created_at: timestamp,
            updated_at: timestamp,
        },
    ]

    const facts = [
        ...WEIGHT_READINGS.map(({ valueKg }, index) => ({
            id: DEMO_RECORD_IDS.facts[index],
            pet_id: DEMO_PET_ID,
            doc_id: DEMO_RECORD_IDS.documents[index],
            fact_type: "weight",
            value_json: {
                value: valueKg,
                unit: "kg",
                value_kg: valueKg,
                value_lb: round(valueKg * 2.2046226218),
                source_field: "synthetic_fixture.weight",
                source_label: "Verified weight",
                extraction_method: "labeled_weight",
                source_context: "SAMPLE — DEMO DATA — fictional weight field.",
                schema_version: 1,
                rule_version: "verified_weight_v1",
                demo_owned: true,
                scenario_id: DEMO_SCENARIO_ID,
            },
            fact_date: weightDates[index],
            confidence: 1,
            verified_at: timestamp,
            verified_by: "demo-fixture",
            status: "verified",
            created_at: timestamp,
            updated_at: timestamp,
        })),
        {
            id: DEMO_RECORD_IDS.facts[4],
            pet_id: DEMO_PET_ID,
            doc_id: DEMO_RECORD_IDS.documents[4],
            fact_type: "preventive_care_status",
            value_json: {
                care_kind: "vaccine",
                care_item: "rabies",
                clinic_reported_next_due: rabiesNextDueDate,
                source_document_ids: [DEMO_RECORD_IDS.documents[4]],
                evidence_types: ["vaccination_certificate"],
                date_meaning: "clinic_reported_next_due",
                source_context:
                    "SAMPLE — DEMO DATA — fictional clinic-reported next-due date.",
                schema_version: 1,
                rule_version: "verified_vaccine_evidence_v1",
                demo_owned: true,
                scenario_id: DEMO_SCENARIO_ID,
            },
            fact_date: rabiesNextDueDate,
            confidence: 1,
            verified_at: timestamp,
            verified_by: "demo-fixture",
            status: "verified",
            created_at: timestamp,
            updated_at: timestamp,
        },
    ]

    const events = [
        {
            id: DEMO_RECORD_IDS.events[0],
            pet_id: DEMO_PET_ID,
            doc_id: DEMO_RECORD_IDS.documents[3],
            event_type: "injection",
            event_date: librelaInjectionDate,
            event_start: null,
            event_end: null,
            status: "verified",
            details_json: {
                subtype: "Librela",
                medication: "Librela",
                description: "SAMPLE — DEMO DATA — fictional injection.",
                source_org: "Harborlight Veterinary Center",
                demo_owned: true,
                scenario_id: DEMO_SCENARIO_ID,
            },
            created_at: timestamp,
            updated_at: timestamp,
        },
        {
            id: DEMO_RECORD_IDS.events[1],
            pet_id: DEMO_PET_ID,
            doc_id: DEMO_RECORD_IDS.documents[3],
            event_type: "reminder",
            event_date: careDate,
            event_start: null,
            event_end: null,
            status: "planned",
            details_json: {
                subtype: "Librela",
                care_item: "Librela",
                source_org: "Harborlight Veterinary Center",
                anchor_event_id: DEMO_RECORD_IDS.events[0],
                anchor_event_date: librelaInjectionDate,
                due_date: librelaDueDate,
                calendar_sync_status: "not_synced",
                timing_state: "upcoming",
                demo_owned: true,
                scenario_id: DEMO_SCENARIO_ID,
            },
            created_at: timestamp,
            updated_at: timestamp,
        },
        {
            id: DEMO_RECORD_IDS.events[2],
            pet_id: DEMO_PET_ID,
            doc_id: null,
            event_type: "medication_administration",
            event_date: simparicaAdministrationDate,
            event_start: null,
            event_end: null,
            status: "verified",
            details_json: {
                care_item: "Simparica Trio",
                care_category: "at_home_medication",
                route: "oral chewable",
                source: "synthetic_owner_confirmation",
                demo_owned: true,
                scenario_id: DEMO_SCENARIO_ID,
            },
            created_at: timestamp,
            updated_at: timestamp,
        },
        {
            id: DEMO_RECORD_IDS.events[3],
            pet_id: DEMO_PET_ID,
            doc_id: null,
            event_type: "reminder",
            event_date: careDate,
            event_start: null,
            event_end: null,
            status: "planned",
            details_json: {
                care_item: "Simparica Trio",
                care_category: "at_home_medication",
                reminder_type: "home_medication",
                cadence_days: 30,
                last_administered_date: simparicaAdministrationDate,
                due_date: simparicaDueDate,
                target_admin_date: careDate,
                preferred_admin_day: "Monday",
                reminder_days_before: 0,
                requires_appointment: false,
                route: "oral chewable",
                administered_by: "Demo owner",
                rule_version: "home_medication_v1",
                timing_state: "due_now",
                calendar_sync_status: "not_synced",
                demo_owned: true,
                scenario_id: DEMO_SCENARIO_ID,
            },
            created_at: timestamp,
            updated_at: timestamp,
        },
    ]

    const costItems = [
        {
            id: DEMO_RECORD_IDS.costItems[0],
            pet_id: DEMO_PET_ID,
            doc_id: DEMO_RECORD_IDS.documents[3],
            service_date: librelaInjectionDate,
            category: "medication",
            item_name: "SAMPLE — DEMO DATA — Librela injection",
            quantity: 1,
            unit: "visit",
            amount: 142.75,
            currency: "USD",
            tax_amount: 0,
            confidence: 1,
            status: "verified",
            verified_at: timestamp,
            verified_by: "demo-fixture",
            created_at: timestamp,
            updated_at: timestamp,
        },
    ]

    return Object.freeze({
        scenarioId: DEMO_SCENARIO_ID,
        careDate,
        projectRef: DEMO_PROJECT_REF,
        petId: DEMO_PET_ID,
        storage: Object.freeze({
            bucket: DEMO_STORAGE_BUCKET,
            prefix: DEMO_STORAGE_PREFIX,
        }),
        tables: Object.freeze({
            pets: Object.freeze([
                {
                    id: DEMO_PET_ID,
                    name: "Momo",
                    species: "canine",
                    breed: "Japanese Spitz",
                    sex: "female",
                    spayed_neutered: true,
                    birth_date: "2018-04-12",
                    microchip_id: "SAMPLE-DEMO-CHIP-001",
                    patient_external_id: "SAMPLE-DEMO-PATIENT-001",
                    weight_value: 13.3,
                    weight_unit: "kg",
                    notes: "SAMPLE — DEMO DATA. Entirely fictional care profile.",
                    created_at: timestamp,
                    updated_at: timestamp,
                },
            ]),
            documents: Object.freeze(documents),
            events: Object.freeze(events),
            cost_items: Object.freeze(costItems),
            labs: Object.freeze([]),
            facts: Object.freeze(facts),
            provider_contacts: Object.freeze([]),
            orchestration_runs: Object.freeze([]),
            care_actions: Object.freeze([]),
            apple_messages_handoffs: Object.freeze([]),
        }),
    })
}

export function getDemoScenarioCounts(scenario) {
    return Object.fromEntries(
        Object.entries(scenario.tables).map(([table, rows]) => [
            table,
            rows.length,
        ])
    )
}

function demoExternalRefs(fixtureKind) {
    return {
        source: "synthetic_manifest",
        demo_owned: true,
        scenario_id: DEMO_SCENARIO_ID,
        fixture_kind: fixtureKind,
    }
}

function round(value) {
    return Number(value.toFixed(2))
}

function assertIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        throw new Error(`Invalid demo care date: ${value}`)
    }

    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
    ) {
        throw new Error(`Invalid demo care date: ${value}`)
    }
}
