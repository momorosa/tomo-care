const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const LIBRELA_EVIDENCE_CLASSIFIER_VERSION =
    "librela_evidence_v1"

const LIBRELA_TERM_RE = /\blibrela\b/i
const ADMINISTRATION_TERM_RE =
    /\b(injection|injected|administered|administration|given|gave)\b/i

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isValidDate(value) {
    if (typeof value !== "string" || !DATE_RE.test(value)) return false

    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function firstValidDate(...values) {
    return values.find(isValidDate) || null
}

function asNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "string") return null

    const normalized = value.replace(/[$,\s]/g, "")
    if (!normalized) return null

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

function getEventDetails(event) {
    return isObject(event?.details_json) ? event.details_json : {}
}

function getStructuredEventText(event) {
    const details = getEventDetails(event)

    return [
        details.subtype,
        details.target_subtype,
        details.description,
        details.title,
        details.medication,
        details.drug,
        details.name,
    ]
        .filter(Boolean)
        .join(" ")
}

function getCostItemLabel(item) {
    return String(item?.label || item?.item_name || item?.name || "").trim()
}

function getCostItemDate(item, document) {
    const extracted = document?.text_extracted || {}

    return firstValidDate(
        item?.service_date,
        item?.event_date,
        extracted.doc_date,
        document?.doc_date
    )
}

function getDocumentEvents(document, events) {
    if (Array.isArray(events)) return events
    return Array.isArray(document?.text_extracted?.events)
        ? document.text_extracted.events
        : []
}

function getDocumentCostItems(document, costItems) {
    if (Array.isArray(costItems)) return costItems
    return Array.isArray(document?.text_extracted?.cost_items)
        ? document.text_extracted.cost_items
        : []
}

function documentHasLibrelaMention(document, events, costItems) {
    const extracted = document?.text_extracted || {}
    const structuredText = [
        document?.title,
        document?.doc_type,
        ...events.map(getStructuredEventText),
        ...costItems.map(getCostItemLabel),
        extracted.summary,
        extracted.notes,
    ]
        .filter(Boolean)
        .join(" ")

    return LIBRELA_TERM_RE.test(structuredText)
}

function isStructuredLibrelaInjectionEvent(event) {
    if (!event || event.event_type !== "injection") return false
    if (!isValidDate(event.event_date)) return false

    return LIBRELA_TERM_RE.test(getStructuredEventText(event))
}

export function isVerifiedLibrelaInjectionEvent(event) {
    return event?.status === "verified" && isStructuredLibrelaInjectionEvent(event)
}

function buildEligibleAssessment({ eventDate, evidenceSource, evidencePath }) {
    return {
        state: "eligible",
        event_date: eventDate,
        evidence_source: evidenceSource,
        evidence_path: evidencePath,
        classifier_version: LIBRELA_EVIDENCE_CLASSIFIER_VERSION,
        message: "Verified source evidence confirms a Librela injection.",
    }
}

function buildReviewAssessment(reason, message) {
    return {
        state: "review_required",
        event_date: null,
        evidence_source: null,
        evidence_path: null,
        classifier_version: LIBRELA_EVIDENCE_CLASSIFIER_VERSION,
        reason,
        message,
    }
}

export function classifyLibrelaAdministrationEvidence({
    document,
    events,
    costItems,
} = {}) {
    if (document?.status !== "verified") {
        return buildReviewAssessment(
            "document_not_verified",
            "Verify this document before using it as care evidence."
        )
    }

    const sourceEvents = getDocumentEvents(document, events)
    const sourceCostItems = getDocumentCostItems(document, costItems)

    const verifiedInjection = sourceEvents.find(isStructuredLibrelaInjectionEvent)

    if (verifiedInjection) {
        return buildEligibleAssessment({
            eventDate: verifiedInjection.event_date,
            evidenceSource: "verified_structured_event",
            evidencePath: `events[${sourceEvents.indexOf(verifiedInjection)}]`,
        })
    }

    const directAdministrationItems = sourceCostItems
        .map((item, index) => ({
            item,
            index,
            label: getCostItemLabel(item),
            amount: asNumber(item?.amount),
            eventDate: getCostItemDate(item, document),
        }))
        .filter(({ label, amount }) =>
            LIBRELA_TERM_RE.test(label) &&
            ADMINISTRATION_TERM_RE.test(label) &&
            (amount == null || amount >= 0)
        )

    if (directAdministrationItems.length) {
        const validDates = [
            ...new Set(
                directAdministrationItems
                    .map(({ eventDate }) => eventDate)
                    .filter(isValidDate)
            ),
        ]

        if (validDates.length === 1) {
            const evidence = directAdministrationItems.find(
                ({ eventDate }) => eventDate === validDates[0]
            )

            return buildEligibleAssessment({
                eventDate: validDates[0],
                evidenceSource: "verified_invoice_cost_item",
                evidencePath: `cost_items[${evidence.index}]`,
            })
        }

        if (validDates.length > 1) {
            return buildReviewAssessment(
                "conflicting_administration_dates",
                "Review required — Librela administration appears on more than one date."
            )
        }

        return buildReviewAssessment(
            "missing_administration_date",
            "Review required — the Librela injection does not have a valid care date."
        )
    }

    const hasLibrelaMention = documentHasLibrelaMention(
        document,
        sourceEvents,
        sourceCostItems
    )

    if (hasLibrelaMention) {
        return buildReviewAssessment(
            "administration_not_confirmed",
            "Review required — no verified Librela administration was found."
        )
    }

    return {
        state: "not_applicable",
        event_date: null,
        evidence_source: null,
        evidence_path: null,
        classifier_version: LIBRELA_EVIDENCE_CLASSIFIER_VERSION,
        message: "No Librela evidence was found in this document.",
    }
}

export function buildCanonicalLibrelaInjectionEvent({ document, assessment }) {
    const result =
        assessment || classifyLibrelaAdministrationEvidence({ document })

    if (result.state !== "eligible" || !isValidDate(result.event_date)) {
        return null
    }

    return {
        event_type: "injection",
        event_date: result.event_date,
        details_json: {
            subtype: "Librela",
            medication: "Librela",
            description: "Librela injection",
            derived_from: result.evidence_source,
            source_evidence_path: result.evidence_path,
            classifier_version: result.classifier_version,
        },
    }
}

export function canonicalizeVerifiedLibrelaEvents({ document, events } = {}) {
    const sourceEvents = Array.isArray(events) ? events : []
    const assessment = classifyLibrelaAdministrationEvidence({
        document,
        events: sourceEvents,
    })

    if (assessment.state !== "eligible") {
        return { events: sourceEvents, assessment, derived: false }
    }

    const existingIndex = sourceEvents.findIndex(
        isStructuredLibrelaInjectionEvent
    )

    if (existingIndex >= 0) {
        const existing = sourceEvents[existingIndex]
        const details = getEventDetails(existing)
        const normalized = {
            ...existing,
            details_json: {
                ...details,
                subtype: "Librela",
                medication: details.medication || "Librela",
                classifier_version: LIBRELA_EVIDENCE_CLASSIFIER_VERSION,
            },
        }

        return {
            events: sourceEvents.map((event, index) =>
                index === existingIndex ? normalized : event
            ),
            assessment,
            derived: false,
        }
    }

    const canonicalEvent = buildCanonicalLibrelaInjectionEvent({
        document,
        assessment,
    })

    return {
        events: canonicalEvent
            ? [...sourceEvents, canonicalEvent]
            : sourceEvents,
        assessment,
        derived: Boolean(canonicalEvent),
    }
}

export function getLibrelaReminderReadiness({
    document,
    materializedEvents = [],
} = {}) {
    const evidence = classifyLibrelaAdministrationEvidence({ document })
    const injection = materializedEvents.find(isVerifiedLibrelaInjectionEvent) || null

    if (evidence.state === "not_applicable") {
        return {
            state: "not_applicable",
            evidence_state: evidence.state,
            actionable: false,
            injection: null,
            message: evidence.message,
        }
    }

    if (evidence.state === "review_required") {
        return {
            state: "review_required",
            evidence_state: evidence.state,
            actionable: false,
            injection: null,
            reason: evidence.reason,
            message: evidence.message,
        }
    }

    if (!injection) {
        return {
            state: "repair_required",
            evidence_state: evidence.state,
            actionable: false,
            injection: null,
            reason: "canonical_event_missing",
            message:
                "Verified invoice evidence confirms a Librela injection, but this record needs repair before a reminder can be created.",
        }
    }

    return {
        state: "eligible",
        evidence_state: evidence.state,
        actionable: true,
        injection,
        message: evidence.message,
    }
}

export function buildLibrelaReminderRecommendation({
    document,
    materializedEvents = [],
} = {}) {
    const readiness = getLibrelaReminderReadiness({
        document,
        materializedEvents,
    })

    if (readiness.state === "not_applicable") {
        return {
            state: readiness.state,
            show: false,
            disabled: true,
            recommended: false,
            badge: null,
            badge_tone: null,
            button_label: "Unavailable",
            body: readiness.message,
        }
    }

    if (!readiness.actionable) {
        return {
            state: readiness.state,
            show: true,
            disabled: true,
            recommended: false,
            badge: "Review required",
            badge_tone: "warning",
            button_label: "Review",
            body: readiness.message,
        }
    }

    return {
        state: readiness.state,
        show: true,
        disabled: false,
        recommended: true,
        badge: "Recommended",
        badge_tone: "brand",
        button_label: "Create",
        body:
            "Verified evidence confirms a Librela injection. Calculate Momo’s next expected dose and create a reminder before it is due.",
    }
}
