export function evaluateAssistantResponse(data, expected = {}) {
    const issues = []
    const answer = normalizeForMatch(data?.answer)
    const citations = Array.isArray(data?.citations) ? data.citations : []

    if (expected.intent && data?.query_plan?.intent !== expected.intent) {
        issues.push(
            `Expected intent "${expected.intent}", got "${data?.query_plan?.intent}"`
        )
    }

    if (
        expected.answer_type &&
        data?.answer_type !== expected.answer_type
    ) {
        issues.push(
            `Expected answer_type "${expected.answer_type}", got "${data?.answer_type}"`
        )
    }

    if (
        Array.isArray(expected.answer_type_any_of) &&
        !expected.answer_type_any_of.includes(data?.answer_type)
    ) {
        issues.push(
            `Expected answer_type to be one of ${JSON.stringify(expected.answer_type_any_of)}, got "${data?.answer_type}"`
        )
    }

    for (const phrase of expected.required_phrases || []) {
        if (!answer.includes(normalizeForMatch(phrase))) {
            issues.push(`Missing required phrase: "${phrase}"`)
        }
    }

    if (
        Array.isArray(expected.required_any_phrases) &&
        expected.required_any_phrases.length > 0 &&
        !expected.required_any_phrases.some((phrase) =>
            answer.includes(normalizeForMatch(phrase))
        )
    ) {
        issues.push(
            `Expected at least one phrase: ${JSON.stringify(expected.required_any_phrases)}`
        )
    }

    for (const phrase of expected.forbidden_phrases || []) {
        if (answer.includes(normalizeForMatch(phrase))) {
            issues.push(`Contains forbidden phrase: "${phrase}"`)
        }
    }

    if (
        Number.isFinite(expected.min_citations) &&
        citations.length < expected.min_citations
    ) {
        issues.push(
            `Expected at least ${expected.min_citations} citation(s), got ${citations.length}`
        )
    }

    requireCitationValues({
        citations,
        field: "source_title",
        expectedValues: expected.required_citation_source_titles,
        issues,
        label: "citation source title",
    })

    requireCitationValues({
        citations,
        field: "display_title",
        expectedValues: expected.required_citation_display_titles,
        issues,
        label: "citation display title",
    })

    requireCitationValues({
        citations,
        field: "table",
        expectedValues: expected.required_citation_tables,
        issues,
        label: "citation table",
    })

    assertPresence({
        actual: data?.proposed_action,
        expectation: expected.proposed_action,
        fieldName: "proposed_action",
        issues,
    })

    assertPresence({
        actual: data?.message_draft,
        expectation: expected.message_draft,
        fieldName: "message_draft",
        issues,
    })

    for (const [fieldPath, expectedValue] of Object.entries(
        expected.required_path_values || {}
    )) {
        const actualValue = getValueAtPath(data, fieldPath)

        if (actualValue !== expectedValue) {
            issues.push(
                `Expected ${fieldPath} to be ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
            )
        }
    }

    for (const [fieldPath, expectedValue] of Object.entries(
        expected.if_present_path_values || {}
    )) {
        const actualValue = getValueAtPath(data, fieldPath)

        if (actualValue !== undefined && actualValue !== expectedValue) {
            issues.push(
                `Expected ${fieldPath}, when present, to be ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
            )
        }
    }

    assertCitationMentions({
        answer,
        citations,
        minimum: expected.min_answer_citation_dates,
        candidatesForCitation: getCitationDateCandidates,
        label: "citation date",
        issues,
    })

    assertCitationMentions({
        answer,
        citations,
        minimum: expected.min_answer_citation_values,
        candidatesForCitation: getCitationValueCandidates,
        label: "citation value",
        issues,
    })

    return issues
}

export function normalizePendingActions(actions = []) {
    return actions
        .map((action) => ({
            id: action?.id || null,
            status: action?.status || null,
        }))
        .sort((a, b) =>
            `${a.id}:${a.status}`.localeCompare(`${b.id}:${b.status}`)
        )
}

export function comparePendingActionSnapshots(before, after) {
    const normalizedBefore = normalizePendingActions(before)
    const normalizedAfter = normalizePendingActions(after)

    if (
        JSON.stringify(normalizedBefore) === JSON.stringify(normalizedAfter)
    ) {
        return []
    }

    return [
        "The pending care-action ledger changed during read-only assistant evals.",
        `Before: ${JSON.stringify(normalizedBefore)}`,
        `After: ${JSON.stringify(normalizedAfter)}`,
    ]
}

export function isReadOnlyEvaluationBlocked({
    evaluationMode,
    queryPlan,
}) {
    return (
        evaluationMode === "read_only" &&
        queryPlan?.intent === "home_medication_given_action" &&
        !queryPlan?.action?.issue
    )
}

function requireCitationValues({
    citations,
    field,
    expectedValues = [],
    issues,
    label,
}) {
    for (const expectedValue of expectedValues || []) {
        const found = citations.some(
            (citation) =>
                normalizeForMatch(citation?.[field]) ===
                normalizeForMatch(expectedValue)
        )

        if (!found) {
            issues.push(`Missing ${label}: "${expectedValue}"`)
        }
    }
}

function assertPresence({
    actual,
    expectation,
    fieldName,
    issues,
}) {
    if (expectation === "null" && actual != null) {
        issues.push(`Expected ${fieldName} to be null`)
    }

    if (expectation === "present" && actual == null) {
        issues.push(`Expected ${fieldName} to be present`)
    }
}

function assertCitationMentions({
    answer,
    citations,
    minimum,
    candidatesForCitation,
    label,
    issues,
}) {
    if (!Number.isFinite(minimum)) return

    const mentionedCount = citations.filter((citation) =>
        candidatesForCitation(citation).some((candidate) =>
            answer.includes(normalizeForMatch(candidate))
        )
    ).length

    if (mentionedCount < minimum) {
        issues.push(
            `Expected the answer to mention at least ${minimum} ${label}(s), got ${mentionedCount}`
        )
    }
}

function getCitationDateCandidates(citation) {
    const dateValue = citation?.display_date || citation?.date

    if (!dateValue) return []

    const isoDate = String(dateValue).slice(0, 10)
    const parsed = new Date(`${isoDate}T00:00:00`)

    if (Number.isNaN(parsed.getTime())) return [dateValue]

    return [
        isoDate,
        new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        }).format(parsed),
        new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(parsed),
    ]
}

function getCitationValueCandidates(citation) {
    const value = citation?.display_value
    return value ? [value] : []
}

function getValueAtPath(value, fieldPath) {
    return String(fieldPath)
        .split(".")
        .reduce(
            (current, key) =>
                current == null ? undefined : current[key],
            value
        )
}

function normalizeForMatch(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/\s+/g, " ")
        .trim()
}