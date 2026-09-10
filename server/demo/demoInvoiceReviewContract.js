import {
    DEMO_INTAKE_FIXTURE,
    DEMO_PET_ID,
    DEMO_SCENARIO_ID,
} from "./scenarioManifest.js"

export const DEMO_INVOICE_REVIEW_FIELD = "invoice_id"
export const DEMO_INVOICE_ID = "HVC-DEMO-090726"
export const DEMO_INVOICE_SOURCE_REVIEW_MODEL =
    "tomocare-demo-source-contract-v1"

const SOURCE_ANCHORS = Object.freeze([
    "sample - demo data - wholly fictional",
    "harborlight veterinary center",
    `invoice ${DEMO_INVOICE_ID.toLowerCase()}`,
    "service date september 7, 2026",
    "visit weight 13.1 kg",
    "librela was administered during this visit",
    "total paid $177.00",
    "rabies status: current per clinic record",
    "does not document a rabies vaccine administration",
])

export function isManifestOwnedDemoInvoice(document) {
    const refs = document?.external_refs || {}

    return Boolean(
        document?.id === DEMO_INTAKE_FIXTURE.documentId &&
            document?.pet_id === DEMO_PET_ID &&
            document?.doc_type === "receipt" &&
            document?.title === DEMO_INTAKE_FIXTURE.title &&
            document?.file_url === DEMO_INTAKE_FIXTURE.storageKey &&
            refs.demo_owned === true &&
            refs.scenario_id === DEMO_SCENARIO_ID &&
            refs.fixture_kind === DEMO_INTAKE_FIXTURE.fixtureKind &&
            refs.content_sha256 === DEMO_INTAKE_FIXTURE.contentSha256
    )
}

export function buildDemoInvoiceCandidate({ document, rawText } = {}) {
    if (!isManifestOwnedDemoInvoice(document)) return null

    assertExpectedSourceText(rawText)

    return {
        doc_id: document.id,
        pet_id: document.pet_id,
        doc_type: "receipt",
        doc_date: "2026-09-07",
        source_org: "Harborlight Veterinary Center",
        title: DEMO_INTAKE_FIXTURE.title,

        // This one intentional omission creates the bounded human-correction
        // moment in the demo. The source comparison points Rosa to the clearly
        // printed invoice number without promoting it automatically.
        invoice_id: null,
        summary:
            "Mobility follow-up with Librela administration for fictional patient Momo.",
        weight_measurement: {
            value: 13.1,
            unit: "kg",
            measured_date: "2026-09-07",
            value_kg: 13.1,
            value_lb: 28.88,
            source_field: "text_extracted.weight_measurement",
            source_label: "Visit weight",
            extraction_method: "labeled_weight",
            source_context: "Visit weight 13.1 kg",
            schema_version: 1,
        },
        vaccine_evidence: [
            {
                schema_version: 1,
                care_kind: "vaccine",
                care_item: "rabies",
                source_record_type: "receipt",
                assertions: [
                    {
                        assertion_type: "clinic_reported_status",
                        status: "current",
                        as_of_date: "2026-09-07",
                        source_context:
                            "Rabies status: Current per clinic record.",
                    },
                ],
                product_details: {},
            },
        ],
        events: [
            {
                event_type: "injection",
                event_date: "2026-09-07",
                status: "completed",
                details_json: {
                    subtype: "Librela",
                    medication: "Librela",
                    description:
                        "Librela was administered during the mobility follow-up visit.",
                },
            },
        ],
        cost_items: [
            {
                service_date: "2026-09-07",
                category: "visit",
                label: "Nurse mobility visit",
                amount: 48,
                currency: "USD",
                notes: null,
            },
            {
                service_date: "2026-09-07",
                category: "medication",
                label: "Librela administration",
                amount: 29.5,
                currency: "USD",
                notes: null,
            },
            {
                service_date: "2026-09-07",
                category: "medication",
                label: "Librela 10 mg/mL single-dose vial",
                amount: 112,
                currency: "USD",
                notes: null,
            },
            {
                service_date: "2026-09-07",
                category: "other",
                label: "Demo wellness credit",
                amount: -12.5,
                currency: "USD",
                notes: "Adjustment",
            },
        ],
        totals: { paid: 177, currency: "USD" },
        labs: [],
        confidence: 1,
        notes:
            "SAMPLE — DEMO DATA. Deterministic untrusted candidate; invoice number requires human correction from the source.",
    }
}

export function buildDemoInvoiceSourceReview({
    document,
    rawText,
    extracted,
    fields = [],
} = {}) {
    if (!isManifestOwnedDemoInvoice(document)) return null

    const expected = buildDemoInvoiceCandidate({ document, rawText })
    expected.invoice_id = DEMO_INVOICE_ID

    return {
        model: DEMO_INVOICE_SOURCE_REVIEW_MODEL,
        failed: false,
        fields: fields.map((field) =>
            buildFieldSourceReview(field, expected)
        ),
        notes:
            "The manifest-owned synthetic invoice was compared with its bounded deterministic source contract.",
    }
}

function buildFieldSourceReview(field, expected) {
    const expectedValue = getPathValue(expected, field.path)

    if (
        field.path === DEMO_INVOICE_REVIEW_FIELD &&
        (field.value == null || field.value === "")
    ) {
        return {
            path: field.path,
            state: "missing_in_candidate",
            reason:
                `The source clearly prints invoice ${DEMO_INVOICE_ID}, but the candidate did not capture it.`,
        }
    }

    if (valuesEqual(field.value, expectedValue)) {
        return {
            path: field.path,
            state: "source_match",
            reason: "The synthetic source clearly supports this value.",
        }
    }

    return {
        path: field.path,
        state: "uncertain",
        reason: "This candidate value does not match the bounded synthetic source contract.",
    }
}

function assertExpectedSourceText(rawText) {
    const normalized = normalizeSourceText(rawText)
    const missing = SOURCE_ANCHORS.filter(
        (anchor) => !normalized.includes(anchor)
    )

    if (missing.length) {
        throw new Error(
            "The manifest-owned demo invoice text does not match its approved synthetic source contract."
        )
    }
}

function normalizeSourceText(value) {
    return String(value || "")
        .normalize("NFKC")
        .replace(/[–—−]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
}

function getPathValue(value, path) {
    const candidatePath = path.replace(
        /^(events\[\d+\])\.description$/,
        "$1.details_json.description"
    )
    const parts = candidatePath
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean)

    return parts.reduce((current, part) => current?.[part], value)
}

function valuesEqual(left, right) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}
