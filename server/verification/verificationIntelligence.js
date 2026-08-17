import crypto from "node:crypto"

export const VERIFICATION_SCHEMA_VERSION = "verification_intelligence_v1"

export const REVIEW_OUTCOMES = Object.freeze({
    CONSISTENT: "consistent_pattern",
    LIMITED: "new_or_limited_history",
    CHANGED: "changed_from_pattern",
    CONFLICT: "conflict_or_uncertainty",
    NOT_CAPTURED: "not_captured",
    MANUAL: "manual_review",
})

const BLOCKING_OUTCOMES = new Set([
    REVIEW_OUTCOMES.CHANGED,
    REVIEW_OUTCOMES.CONFLICT,
    REVIEW_OUTCOMES.MANUAL,
])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONEY_TOLERANCE = 0.01
const WEIGHT_ATTENTION_PERCENT = 5
const MAX_CORRECTIONS = 20

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue)
    if (!value || typeof value !== "object") return value

    return Object.fromEntries(
        Object.keys(value)
            .sort()
            .map((key) => [key, stableValue(value[key])])
    )
}

export function getCandidateFingerprint(extracted) {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(stableValue(extracted || {})))
        .digest("hex")
}

export function enumerateVerificationFields(extracted = {}) {
    const fields = []
    const add = (path, value, kind = "administrative") => {
        fields.push({ path, value, kind })
    }

    for (const key of ["invoice_id", "doc_date", "source_org", "summary"]) {
        if (key in extracted) add(key, extracted[key])
    }

    if (extracted.totals && typeof extracted.totals === "object") {
        if ("paid" in extracted.totals) {
            add("totals.paid", extracted.totals.paid, "financial")
        }
    }

    if (
        extracted.weight_measurement &&
        typeof extracted.weight_measurement === "object"
    ) {
        add(
            "weight_measurement.value",
            extracted.weight_measurement.value,
            "weight"
        )
        add(
            "weight_measurement.unit",
            extracted.weight_measurement.unit,
            "weight"
        )
        add(
            "weight_measurement.measured_date",
            extracted.weight_measurement.measured_date,
            "weight"
        )
    }

    if (Array.isArray(extracted.events)) {
        extracted.events.forEach((event, index) => {
            add(`events[${index}].event_type`, event?.event_type, "care")
            add(`events[${index}].event_date`, event?.event_date, "care")
            if (event?.details_json?.description != null) {
                add(
                    `events[${index}].description`,
                    event.details_json.description,
                    "care"
                )
            }
        })
    }

    if (Array.isArray(extracted.cost_items)) {
        extracted.cost_items.forEach((item, index) => {
            add(`cost_items[${index}].label`, item?.label, "care")
            add(`cost_items[${index}].amount`, item?.amount, "financial")
            add(
                `cost_items[${index}].service_date`,
                item?.service_date,
                "care"
            )
        })
    }

    return fields
}

function normalizeText(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
}

function normalizeMoney(value) {
    const number = Number(value)
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : null
}

function moneyDiffExceedsTolerance(left, right) {
    return Math.round(Math.abs(left - right) * 100) > MONEY_TOLERANCE * 100
}

function normalizeWeightKg(value, unit) {
    const number = Number(value)
    if (!Number.isFinite(number)) return null

    const normalizedUnit = normalizeText(unit)
    if (normalizedUnit === "kg") return number
    if (normalizedUnit === "lb" || normalizedUnit === "lbs") {
        return number * 0.45359237
    }

    return null
}

function sourceEntry(sourceReview, path) {
    return sourceReview?.fields?.find((field) => field.path === path) || null
}

function sourceNeedsReview(sourceReview, path) {
    const state = sourceEntry(sourceReview, path)?.state
    return (
        !state ||
        state === "uncertain" ||
        state === "unreadable" ||
        state === "missing_in_candidate" ||
        state === "not_present"
    )
}

function fieldAssessment({
    path,
    value,
    outcome,
    reason,
    evidence = [],
    group = "other",
    blocksApproval = BLOCKING_OUTCOMES.has(outcome),
}) {
    return {
        path,
        outcome,
        reason,
        extracted_value: value ?? null,
        evidence,
        group,
        blocks_approval: Boolean(blocksApproval),
    }
}

function collectDates(extracted = {}) {
    const values = []
    const add = (path, value) => {
        if (value != null && value !== "") values.push({ path, value })
    }

    add("doc_date", extracted.doc_date)
    add(
        "weight_measurement.measured_date",
        extracted.weight_measurement?.measured_date
    )
    extracted.events?.forEach((event, index) =>
        add(`events[${index}].event_date`, event?.event_date)
    )
    extracted.cost_items?.forEach((item, index) =>
        add(`cost_items[${index}].service_date`, item?.service_date)
    )

    return values
}

function buildDateAssessment(extracted, sourceReview) {
    const dates = collectDates(extracted)
    if (!dates.length) return null

    const invalid = dates.filter(({ value }) => !DATE_RE.test(String(value)))
    const unclear = dates.filter(({ path }) => sourceNeedsReview(sourceReview, path))
    const unique = [...new Set(dates.map(({ value }) => value))]

    if (invalid.length || unclear.length || unique.length > 1) {
        const details = []
        if (invalid.length) details.push("one or more dates are not valid")
        if (unique.length > 1) details.push("the invoice and line-item dates differ")
        if (unclear.length) details.push("one or more dates are unclear in the source")

        return fieldAssessment({
            path: "checks.date_consistency",
            value: unique,
            outcome: REVIEW_OUTCOMES.CONFLICT,
            reason: `Please review the dates because ${details.join(" and ")}.`,
            evidence: dates,
            group: "dates",
        })
    }

    return fieldAssessment({
        path: "checks.date_consistency",
        value: unique[0],
        outcome: REVIEW_OUTCOMES.CONSISTENT,
        reason: `The invoice date and all captured line-item dates match ${unique[0]}.`,
        evidence: dates,
        group: "dates",
        blocksApproval: false,
    })
}

function buildArithmeticAssessment(extracted) {
    const items = Array.isArray(extracted.cost_items)
        ? extracted.cost_items
        : []
    const hasPaidTotal =
        extracted.totals &&
        typeof extracted.totals === "object" &&
        "paid" in extracted.totals

    if (!items.length && !hasPaidTotal) return null

    const amounts = items.map((item) => normalizeMoney(item?.amount))

    if (!items.length || amounts.some((amount) => amount == null)) {
        return fieldAssessment({
            path: "checks.invoice_arithmetic",
            value: null,
            outcome: REVIEW_OUTCOMES.CONFLICT,
            reason: "Tomo could not calculate a reliable line-item total. Please review the amounts.",
            group: "costs",
        })
    }

    const calculated = normalizeMoney(
        amounts.reduce((sum, amount) => sum + amount, 0)
    )
    const paid = normalizeMoney(extracted.totals?.paid)

    if (paid == null) {
        return fieldAssessment({
            path: "checks.invoice_arithmetic",
            value: { calculated_line_total: calculated, source_paid_total: null },
            outcome: REVIEW_OUTCOMES.LIMITED,
            reason: `The captured line items total $${calculated.toFixed(2)}, but the source paid total was not captured. Tomo did not fill it in automatically.`,
            evidence: [{ type: "calculated_line_total", value: calculated }],
            group: "costs",
            blocksApproval: false,
        })
    }

    if (moneyDiffExceedsTolerance(calculated, paid)) {
        return fieldAssessment({
            path: "checks.invoice_arithmetic",
            value: { calculated_line_total: calculated, source_paid_total: paid },
            outcome: REVIEW_OUTCOMES.CONFLICT,
            reason: `The captured line items total $${calculated.toFixed(2)}, which does not match the $${paid.toFixed(2)} paid total.`,
            evidence: [
                { type: "calculated_line_total", value: calculated },
                { type: "source_paid_total", value: paid },
            ],
            group: "costs",
        })
    }

    return fieldAssessment({
        path: "checks.invoice_arithmetic",
        value: paid,
        outcome: REVIEW_OUTCOMES.CONSISTENT,
        reason: `The captured line items add up to the $${paid.toFixed(2)} paid total.`,
        evidence: [
            { type: "calculated_line_total", value: calculated },
            { type: "source_paid_total", value: paid },
        ],
        group: "costs",
        blocksApproval: false,
    })
}

function historicalCostValues(history, normalizedLabel, amountRank = 0) {
    return history.map((record) => {
        const match = record.cost_items
            ?.filter(
                (item) =>
                    normalizeText(item.item_name || item.label) ===
                    normalizedLabel
            )
            .sort(
                (left, right) =>
                    normalizeMoney(left.amount) - normalizeMoney(right.amount)
            )[amountRank]
        if (!match) return null
        return {
            document_id: record.document?.id || record.id || null,
            document_date:
                record.document?.doc_date || record.doc_date || null,
            label: match.item_name || match.label,
            amount: normalizeMoney(match.amount),
        }
    })
}

function repeatedValue(values, selector) {
    if (values.length < 3) return null
    const firstThreeRecords = values.slice(0, 3)
    if (firstThreeRecords.some((value) => value == null)) return null
    const firstThree = firstThreeRecords.map(selector)
    return firstThree.every((value) => value === firstThree[0])
        ? firstThree[0]
        : null
}

function buildCostPatternAssessments(extracted, history, sourceReview) {
    const fields = []

    extracted.cost_items?.forEach((item, index) => {
        const labelPath = `cost_items[${index}].label`
        const amountPath = `cost_items[${index}].amount`
        const normalizedLabel = normalizeText(item?.label)
        const currentAmount = normalizeMoney(item?.amount)
        const amountRank = extracted.cost_items
            .map((candidate, candidateIndex) => ({
                candidateIndex,
                label: normalizeText(candidate?.label),
                amount: normalizeMoney(candidate?.amount),
            }))
            .filter((candidate) => candidate.label === normalizedLabel)
            .sort((left, right) => left.amount - right.amount)
            .findIndex((candidate) => candidate.candidateIndex === index)

        if (!normalizedLabel || sourceNeedsReview(sourceReview, labelPath)) {
            fields.push(
                fieldAssessment({
                    path: labelPath,
                    value: item?.label,
                    outcome: REVIEW_OUTCOMES.CONFLICT,
                    reason: "The service or medication name is not clear enough in the source to compare safely.",
                    group: "changes",
                })
            )
            return
        }

        if (sourceNeedsReview(sourceReview, amountPath) || currentAmount == null) {
            fields.push(
                fieldAssessment({
                    path: amountPath,
                    value: item?.amount,
                    outcome: REVIEW_OUTCOMES.CONFLICT,
                    reason: `${item.label} has an amount that is unclear in the current source.`,
                    group: "changes",
                })
            )
            return
        }

        const matches = historicalCostValues(
            history,
            normalizedLabel,
            Math.max(amountRank, 0)
        )
        const establishedAmount = repeatedValue(matches, (entry) => entry.amount)
        const evidence = matches.filter(Boolean)

        if (
            history.length >= 3 &&
            matches.slice(0, 3).every((match) => match == null)
        ) {
            fields.push(
                fieldAssessment({
                    path: labelPath,
                    value: item?.label,
                    outcome: REVIEW_OUTCOMES.CHANGED,
                    reason: `${item.label} is new compared with the last three comparable verified visits.`,
                    group: "changes",
                })
            )
            return
        }

        if (establishedAmount == null) {
            fields.push(
                fieldAssessment({
                    path: labelPath,
                    value: item?.label,
                    outcome: REVIEW_OUTCOMES.LIMITED,
                    reason: `${item.label} does not yet have three consecutive comparable verified visits establishing a pattern.`,
                    evidence,
                    group: "limited_history",
                    blocksApproval: false,
                })
            )
            return
        }

        if (moneyDiffExceedsTolerance(currentAmount, establishedAmount)) {
            fields.push(
                fieldAssessment({
                    path: amountPath,
                    value: currentAmount,
                    outcome: REVIEW_OUTCOMES.CHANGED,
                    reason: `${item.label} is $${currentAmount.toFixed(2)} now; it was $${establishedAmount.toFixed(2)} across the last three comparable verified visits.`,
                    evidence: evidence.slice(0, 5),
                    group: "changes",
                })
            )
            return
        }

        fields.push(
            fieldAssessment({
                path: `patterns.cost_items[${index}]`,
                value: { label: item.label, amount: currentAmount },
                outcome: REVIEW_OUTCOMES.CONSISTENT,
                reason: `${item.label} remains $${currentAmount.toFixed(2)}, matching the last three comparable verified visits.`,
                evidence: evidence.slice(0, 5),
                group: "consistent",
                blocksApproval: false,
            })
        )
    })

    return fields
}

function latestHistoricalWeight(history) {
    for (const record of history) {
        const fact = record.facts?.find(
            (candidate) =>
                candidate.status === "verified" &&
                candidate.fact_type === "weight"
        )
        if (!fact) continue

        const value = fact.value_json || {}
        const valueKg =
            Number.isFinite(Number(value.value_kg))
                ? Number(value.value_kg)
                : normalizeWeightKg(value.value, value.unit)

        if (valueKg != null) {
            return {
                document_id: record.document?.id || record.id || null,
                document_date: record.document?.doc_date || record.doc_date || null,
                measured_date: fact.fact_date || value.measured_date || null,
                value_kg: valueKg,
            }
        }
    }

    return null
}

function historicalWeights(history) {
    return history.map((record) => latestHistoricalWeight([record]))
}

function buildWeightAssessment(extracted, history, sourceReview) {
    const weight = extracted.weight_measurement
    if (!weight) return null

    const paths = [
        "weight_measurement.value",
        "weight_measurement.unit",
        "weight_measurement.measured_date",
    ]
    const currentKg = normalizeWeightKg(weight.value, weight.unit)

    if (
        currentKg == null ||
        !DATE_RE.test(String(weight.measured_date || "")) ||
        paths.some((path) => sourceNeedsReview(sourceReview, path))
    ) {
        return fieldAssessment({
            path: "checks.weight_comparison",
            value: weight,
            outcome: REVIEW_OUTCOMES.CONFLICT,
            reason: "Please review the weight because its value, unit, date, or source match is unclear.",
            group: "changes",
        })
    }

    const latest = latestHistoricalWeight(history)
    const weights = historicalWeights(history)
    const weightEvidence = weights.filter(Boolean)
    if (!latest) {
        return fieldAssessment({
            path: "checks.weight_comparison",
            value: weight,
            outcome: REVIEW_OUTCOMES.LIMITED,
            reason: "No earlier verified weight is available for comparison.",
            group: "limited_history",
            blocksApproval: false,
        })
    }

    const percentChange = Math.abs((currentKg - latest.value_kg) / latest.value_kg) * 100
    if (percentChange >= WEIGHT_ATTENTION_PERCENT) {
        return fieldAssessment({
            path: "checks.weight_comparison",
            value: weight,
            outcome: REVIEW_OUTCOMES.CHANGED,
            reason: `The captured weight is ${percentChange.toFixed(1)}% different from the latest verified measurement. This is a review threshold, not a medical conclusion.`,
            evidence: [latest],
            group: "changes",
        })
    }

    if (
        weights.length < 3 ||
        weights.slice(0, 3).some((candidate) => candidate == null)
    ) {
        return fieldAssessment({
            path: "checks.weight_comparison",
            value: weight,
            outcome: REVIEW_OUTCOMES.LIMITED,
            reason: `The captured weight is ${percentChange.toFixed(1)}% different from the latest verified measurement, but fewer than three comparable weights are available.`,
            evidence: [latest],
            group: "limited_history",
            blocksApproval: false,
        })
    }

    return fieldAssessment({
        path: "checks.weight_comparison",
        value: weight,
        outcome: REVIEW_OUTCOMES.CONSISTENT,
        reason: `The captured weight is within ${WEIGHT_ATTENTION_PERCENT}% of the latest verified measurement.`,
        evidence: weightEvidence.slice(0, 5),
        group: "consistent",
        blocksApproval: false,
    })
}

function buildUnsupportedAssessments(rawText) {
    const text = String(rawText || "")
    const results = []

    const add = (path, label, pattern) => {
        if (pattern.test(text)) {
            results.push(
                fieldAssessment({
                    path,
                    value: label,
                    outcome: REVIEW_OUTCOMES.NOT_CAPTURED,
                    reason: `${label} appears in the source but is outside this invoice-review contract. It was not added to trusted care records.`,
                    group: "not_captured",
                    blocksApproval: false,
                })
            )
        }
    }

    add(
        "unsupported.vaccine_status",
        "Vaccine information",
        /\b(vaccine|vaccination|rabies|bordetella|dhpp|distemper)\b/i
    )
    add(
        "unsupported.annual_wellness",
        "Annual checkup or wellness reminder",
        /\b(annual|wellness|yearly)\b.{0,40}\b(exam|checkup|visit|due|reminder)\b|\b(exam|checkup|visit)\b.{0,40}\b(annual|yearly)\b/is
    )
    add(
        "unsupported.labs",
        "Lab information",
        /\b(lab|laboratory|bloodwork|blood work|urinalysis|chemistry panel|cbc)\b/i
    )

    return results
}

function buildManualSourceAssessments(extracted, sourceReview) {
    return enumerateVerificationFields(extracted).map((field) => {
        const source = sourceEntry(sourceReview, field.path)
        const detail = source?.reason
            ? ` ${source.reason}`
            : " Tomo could not complete the source comparison."

        return fieldAssessment({
            path: field.path,
            value: field.value,
            outcome: REVIEW_OUTCOMES.MANUAL,
            reason: `Please compare this field with the source before verifying.${detail}`,
            group: "manual",
        })
    })
}

function fallbackAdministrativeAssessments(extracted, sourceReview, usedPaths) {
    return enumerateVerificationFields(extracted)
        .filter((field) => !usedPaths.has(field.path))
        .filter(
            (field) =>
                !field.path.endsWith(".service_date") &&
                !field.path.endsWith(".event_date") &&
                !field.path.startsWith("weight_measurement.") &&
                !field.path.startsWith("cost_items[")
        )
        .map((field) => {
            if (sourceNeedsReview(sourceReview, field.path)) {
                return fieldAssessment({
                    path: field.path,
                    value: field.value,
                    outcome: REVIEW_OUTCOMES.CONFLICT,
                    reason:
                        sourceEntry(sourceReview, field.path)?.reason ||
                        "This value could not be confirmed clearly in the source.",
                    group: "changes",
                })
            }

            return fieldAssessment({
                path: field.path,
                value: field.value,
                outcome: REVIEW_OUTCOMES.LIMITED,
                reason: "This value matches the current source but does not use a repeated historical pattern.",
                group: "limited_history",
                blocksApproval: false,
            })
        })
}

function outcomeSummary(fields) {
    const counts = Object.fromEntries(
        Object.values(REVIEW_OUTCOMES).map((outcome) => [outcome, 0])
    )
    fields.forEach((field) => {
        if (field.outcome in counts) counts[field.outcome] += 1
    })

    return {
        counts,
        blocking_count: fields.filter((field) => field.blocks_approval).length,
        reviewed_item_count: fields.length,
    }
}

export function buildVerificationAssessment({
    rawText,
    extracted,
    document,
    history = [],
    sourceReview = null,
    sourceReviewFailed = false,
    correctionHistory = [],
    model = null,
    createdAt = new Date().toISOString(),
} = {}) {
    const candidateFingerprint = getCandidateFingerprint(extracted)
    const boundedHistory = history.slice(0, 5)
    let fields

    if (sourceReviewFailed) {
        fields = [
            ...buildManualSourceAssessments(extracted, sourceReview),
            ...buildUnsupportedAssessments(rawText),
        ]
    } else {
        fields = []
        const date = buildDateAssessment(extracted, sourceReview)
        const arithmetic = buildArithmeticAssessment(extracted)
        const weight = buildWeightAssessment(extracted, boundedHistory, sourceReview)

        if (date) fields.push(date)
        if (arithmetic) fields.push(arithmetic)
        if (weight) fields.push(weight)
        fields.push(
            ...buildCostPatternAssessments(
                extracted,
                boundedHistory,
                sourceReview
            )
        )
        fields.push(...buildUnsupportedAssessments(rawText))

        const usedPaths = new Set(fields.map((field) => field.path))
        if (date) {
            collectDates(extracted).forEach(({ path }) => usedPaths.add(path))
        }
        if (arithmetic) usedPaths.add("totals.paid")
        if (weight) {
            usedPaths.add("weight_measurement.value")
            usedPaths.add("weight_measurement.unit")
            usedPaths.add("weight_measurement.measured_date")
        }
        fields.push(
            ...fallbackAdministrativeAssessments(
                extracted,
                sourceReview,
                usedPaths
            )
        )
    }

    const summary = outcomeSummary(fields)

    return {
        schema_version: VERIFICATION_SCHEMA_VERSION,
        specialist: "verification_intelligence",
        status: "ready",
        model,
        created_at: createdAt,
        candidate_fingerprint: candidateFingerprint,
        history: {
            comparable_record_count: boundedHistory.length,
            maximum_records: 5,
            pattern_minimum: 3,
            document_ids: boundedHistory
                .map((record) => record.document?.id || record.id)
                .filter(Boolean),
        },
        fields,
        summary,
        correction_history: correctionHistory.slice(-MAX_CORRECTIONS),
        fail_safe: sourceReviewFailed,
        notes: sourceReviewFailed
            ? "Source comparison was unavailable. Manual review is required."
            : "Review outcomes combine current-source comparison, deterministic checks, and bounded trusted history.",
        document_id: document?.id || null,
    }
}

export function isCurrentVerificationAssessment(assessment, extracted) {
    return Boolean(
        assessment?.schema_version === VERIFICATION_SCHEMA_VERSION &&
            assessment?.status === "ready" &&
            assessment?.candidate_fingerprint ===
                getCandidateFingerprint(extracted)
    )
}

export function getBlockingAssessmentPaths(assessment) {
    return (assessment?.fields || [])
        .filter((field) => field.blocks_approval === true)
        .map((field) => field.path)
}

export function validateVerificationApproval({
    assessment,
    extracted,
    candidateFingerprint,
    acceptedPaths = [],
} = {}) {
    const currentFingerprint = getCandidateFingerprint(extracted)

    if (!isCurrentVerificationAssessment(assessment, extracted)) {
        return {
            ok: false,
            reason: "assessment_required",
            error: "Run the current verification review before saving this document to trusted records.",
        }
    }

    if (
        !candidateFingerprint ||
        candidateFingerprint !== currentFingerprint ||
        candidateFingerprint !== assessment.candidate_fingerprint
    ) {
        return {
            ok: false,
            reason: "stale_candidate",
            error: "The extracted fields changed after review. Save and run the review again.",
        }
    }

    const accepted = new Set(
        Array.isArray(acceptedPaths) ? acceptedPaths.slice(0, 200) : []
    )
    const unresolvedPaths = getBlockingAssessmentPaths(assessment).filter(
        (path) => !accepted.has(path)
    )

    if (unresolvedPaths.length) {
        return {
            ok: false,
            reason: "review_required",
            error: `Review ${unresolvedPaths.length} attention item${
                unresolvedPaths.length === 1 ? "" : "s"
            } before saving to trusted records.`,
            unresolved_paths: unresolvedPaths,
        }
    }

    return {
        ok: true,
        candidate_fingerprint: currentFingerprint,
        accepted_paths: [...accepted].filter((path) =>
            getBlockingAssessmentPaths(assessment).includes(path)
        ),
    }
}

function valuesEqual(left, right) {
    return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
}

function getPathValue(value, path) {
    const parts = path
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean)
    return parts.reduce((current, part) => current?.[part], value)
}

export function buildCorrectionHistory({
    previousExtracted,
    nextExtracted,
    existingHistory = [],
    changedAt = new Date().toISOString(),
} = {}) {
    const paths = new Set([
        ...enumerateVerificationFields(previousExtracted).map((field) => field.path),
        ...enumerateVerificationFields(nextExtracted).map((field) => field.path),
    ])

    const changes = [...paths]
        .map((path) => ({
            path,
            previous_value: getPathValue(previousExtracted, path) ?? null,
            next_value: getPathValue(nextExtracted, path) ?? null,
        }))
        .filter(
            ({ previous_value, next_value }) =>
                !valuesEqual(previous_value, next_value)
        )

    if (!changes.length) return existingHistory.slice(-MAX_CORRECTIONS)

    return [
        ...existingHistory,
        {
            changed_at: changedAt,
            changes,
        },
    ].slice(-MAX_CORRECTIONS)
}

export function buildStaleAssessment({
    previousAssessment,
    previousExtracted,
    nextExtracted,
    changedAt = new Date().toISOString(),
} = {}) {
    return {
        schema_version: VERIFICATION_SCHEMA_VERSION,
        specialist: "verification_intelligence",
        status: "stale",
        created_at: previousAssessment?.created_at || changedAt,
        invalidated_at: changedAt,
        candidate_fingerprint:
            previousAssessment?.candidate_fingerprint ||
            getCandidateFingerprint(previousExtracted),
        fields: [],
        correction_history: buildCorrectionHistory({
            previousExtracted,
            nextExtracted,
            existingHistory: previousAssessment?.correction_history || [],
            changedAt,
        }),
        notes: "Candidate fields changed. Run Verification Intelligence again.",
    }
}
