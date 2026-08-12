import { createHash } from "node:crypto"

export const VERIFIED_WEIGHT_VERSION = "verified_weight_v1"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const LABELED_WEIGHT_RE = /\b(?:weight|wt|patient weight)\s*[:-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(kg|kgs|kilogram|kilograms|lb|lbs|pound|pounds)\b/i
const PATIENT_HEADER_WEIGHT_RE = /patients?\s*:\s*.{0,240}?(\d{1,2}(?:\.\d{1,2})?)\s*(kg|kgs|kilogram|kilograms|lb|lbs|pound|pounds)\b/i

function round(value, decimals = 2) {
    return Number(Number(value).toFixed(decimals))
}

function normalizeUnit(unit) {
    const value = String(unit || "").trim().toLowerCase()
    if (["lb", "lbs", "pound", "pounds"].includes(value)) return "lb"
    if (["kg", "kgs", "kilogram", "kilograms"].includes(value)) return "kg"
    return null
}

function isValidDate(value) {
    if (!DATE_RE.test(value || "")) return false
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isPlausibleWeight(value, unit) {
    if (!Number.isFinite(value)) return false
    if (unit === "kg") return value >= 8 && value <= 25
    if (unit === "lb") return value >= 18 && value <= 55
    return false
}

function getContext(text, index = 0, length = 0) {
    const start = Math.max(index - 100, 0)
    const end = Math.min(index + length + 140, text.length)
    return text.slice(start, end).replace(/\s+/g, " ").trim()
}

function toCanonicalMeasurement({
    value,
    unit,
    measuredDate,
    sourceField,
    sourceLabel,
    extractionMethod,
    sourceContext,
}) {
    const numericValue = Number(value)
    const normalizedUnit = normalizeUnit(unit)

    if (!isPlausibleWeight(numericValue, normalizedUnit)) return null
    if (!isValidDate(measuredDate)) return null

    const valueKg = normalizedUnit === "kg"
        ? numericValue
        : numericValue / 2.2046226218
    const valueLb = normalizedUnit === "lb"
        ? numericValue
        : numericValue * 2.2046226218

    return {
        value: round(numericValue),
        unit: normalizedUnit,
        measured_date: measuredDate,
        value_kg: round(valueKg),
        value_lb: round(valueLb),
        source_field: sourceField || "text_extracted.weight_measurement",
        source_label: sourceLabel || "Verified weight",
        extraction_method: extractionMethod || "structured_weight_measurement",
        source_context: sourceContext ? String(sourceContext).trim() : null,
        schema_version: 1,
        rule_version: VERIFIED_WEIGHT_VERSION,
    }
}

export function normalizeStructuredWeightMeasurement(measurement, fallbackDate) {
    if (!measurement || typeof measurement !== "object") return null

    return toCanonicalMeasurement({
        value: measurement.value,
        unit: measurement.unit,
        measuredDate: measurement.measured_date || fallbackDate,
        sourceField:
            measurement.source_field || "text_extracted.weight_measurement",
        sourceLabel: measurement.source_label || "Weight",
        extractionMethod:
            measurement.extraction_method || "structured_weight_measurement",
        sourceContext: measurement.source_context,
    })
}

export function extractWeightMeasurementFromText(text, fallbackDate) {
    const source = String(text || "")
    if (!source || !isValidDate(fallbackDate)) return null

    for (const [pattern, extractionMethod, sourceLabel] of [
        [LABELED_WEIGHT_RE, "labeled_weight", "Weight"],
        [PATIENT_HEADER_WEIGHT_RE, "patient_header_weight", "Patient metadata weight"],
    ]) {
        const match = pattern.exec(source)
        if (!match) continue

        const candidate = toCanonicalMeasurement({
            value: match[1],
            unit: match[2],
            measuredDate: fallbackDate,
            sourceField: "raw_text",
            sourceLabel,
            extractionMethod,
            sourceContext: getContext(source, match.index, match[0].length),
        })

        if (candidate) return candidate
    }

    return null
}

export function getVerifiedWeightCandidate(document, { allowRawText = false } = {}) {
    const extracted = document?.text_extracted || {}
    const fallbackDate =
        extracted.doc_date || document?.doc_date || null

    const structured = normalizeStructuredWeightMeasurement(
        extracted.weight_measurement,
        fallbackDate
    )

    if (structured) return structured
    if (!allowRawText) return null

    return extractWeightMeasurementFromText(document?.raw_text, fallbackDate)
}

function factMatchesCandidate(fact, candidate) {
    if (!fact || !candidate) return false
    const value = fact.value_json || {}

    return (
        fact.fact_type === "weight" &&
        fact.fact_date === candidate.measured_date &&
        Math.abs(Number(value.value_kg) - candidate.value_kg) < 0.01
    )
}

function buildPreviewToken({ document, candidate, facts, pet }) {
    const snapshot = {
        schema_version: 1,
        document_id: document?.id || null,
        document_status: document?.status || null,
        document_updated_at: document?.updated_at || null,
        candidate,
        facts: (facts || [])
            .filter((fact) => fact?.fact_type === "weight")
            .map((fact) => ({
                id: fact.id,
                fact_date: fact.fact_date,
                status: fact.status,
                value_kg: fact.value_json?.value_kg ?? null,
            }))
            .sort((a, b) => String(a.id).localeCompare(String(b.id))),
        pet_snapshot: {
            weight_value: pet?.weight_value ?? null,
            weight_unit: pet?.weight_unit ?? null,
            updated_at: pet?.updated_at ?? null,
        },
    }

    return createHash("sha256")
        .update(JSON.stringify(snapshot))
        .digest("hex")
}

export function buildVerifiedWeightPlan({ document, facts = [], pet = null } = {}) {
    if (!document || document.status !== "verified") {
        return {
            state: "verification_required",
            actionable: false,
            reason: "document_not_verified",
            message: "Verify this document before saving its weight measurement.",
            preview_token: null,
        }
    }

    const candidate = getVerifiedWeightCandidate(document, {
        allowRawText: true,
    })

    if (!candidate) {
        return {
            state: "not_applicable",
            actionable: false,
            reason: "no_weight_measurement",
            message: "No supported weight measurement was found in this document.",
            preview_token: null,
        }
    }

    const documentWeightFacts = facts.filter(
        (fact) => fact?.fact_type === "weight" && fact?.doc_id === document.id
    )
    const matchingFact = documentWeightFacts.find((fact) =>
        factMatchesCandidate(fact, candidate)
    )
    const conflictingFact = documentWeightFacts.find(
        (fact) => !factMatchesCandidate(fact, candidate)
    )

    if (conflictingFact?.status === "verified") {
        return {
            state: "review_required",
            actionable: false,
            reason: "conflicting_verified_weight",
            message:
                "This document already has a different verified weight. Review the trusted record before changing it.",
            candidate,
            preview_token: null,
        }
    }

    const previewToken = buildPreviewToken({
        document,
        candidate,
        facts,
        pet,
    })

    return {
        state:
            matchingFact?.status === "verified"
                ? "already_materialized"
                : "materialization_required",
        actionable: true,
        candidate,
        fact: matchingFact || conflictingFact || null,
        preview_token: previewToken,
        changes: {
            weight_fact: matchingFact ? "preserve" : conflictingFact ? "update" : "create",
            source_document: document.text_extracted?.weight_measurement
                ? "preserve"
                : "add_structured_measurement",
            latest_weight_snapshot: "update_if_newest",
            events: "preserve",
            cost_items: "preserve",
            reminders: "preserve",
        },
    }
}

export function toVerifiedWeightPreview(plan) {
    if (!plan?.actionable) return null

    return {
        state: plan.state,
        preview_token: plan.preview_token,
        measurement: plan.candidate,
        weight_fact_action: plan.changes.weight_fact,
        source_document_action: plan.changes.source_document,
        latest_weight_snapshot: plan.changes.latest_weight_snapshot,
        preserves_events: true,
        preserves_cost_items: true,
        preserves_reminders: true,
    }
}

export function buildWeightMaterializationRecommendation({
    document,
    facts = [],
    pet = null,
} = {}) {
    const plan = buildVerifiedWeightPlan({ document, facts, pet })

    if (plan.state === "materialization_required") {
        return {
            show: true,
            disabled: false,
            state: "repair_available",
            badge: "Weight available",
            badge_tone: "warning",
            button_label: "Review weight",
            body:
                "Review the measurement from this verified invoice before adding it to Momo’s trusted weight history.",
        }
    }

    if (plan.state === "already_materialized") {
        return {
            show: true,
            disabled: true,
            state: "materialized",
            badge: "Saved",
            badge_tone: "success",
            button_label: "Done",
            body: "The verified weight is already part of Momo’s trusted history.",
        }
    }

    return {
        show: plan.state === "review_required",
        disabled: true,
        state: plan.state,
        badge: plan.state === "review_required" ? "Review required" : null,
        badge_tone: "warning",
        button_label: "Review",
        body: plan.message || null,
    }
}
