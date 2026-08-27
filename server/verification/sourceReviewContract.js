const SOURCE_STATES = new Set([
    "source_match",
    "uncertain",
    "unreadable",
    "missing_in_candidate",
    "not_present",
])

export function buildSourceReviewSystemPrompt() {
    return `You are the source-comparison tool used by TomoCare's Verification Intelligence specialist.

Compare an existing candidate extraction with the raw text from the current veterinary document. Do not re-extract the document, compare with history, calculate totals, assess medical significance, or decide whether the document may be verified. Deterministic TomoCare services perform those jobs.

For every requested path, return exactly one source state:
- "source_match": the candidate value is clearly supported by the current source.
- "uncertain": the source may support the value, but the wording, identity, amount, date, or unit is ambiguous.
- "unreadable": the relevant source text is garbled, truncated, or unreadable.
- "missing_in_candidate": the source visibly contains a value for this requested concept, but the candidate is empty or materially incomplete.
- "not_present": the candidate is empty and the source genuinely does not contain the value.

Important boundaries:
- Classify only source support and ambiguity. A field's downstream consequence does not make the source uncertain.
- Return "source_match" when a candidate date, medication, weight, or financial value is clearly printed in the source. Do not require human confirmation solely because the field could matter downstream.
- Product concentration such as "10 mg/ml solution vial" is not an administered dose unless the source explicitly says it is the administered dose.
- Do not infer vaccine administration from a future reminder or clinic status section.
- Do not infer a paid total from line-item arithmetic.
- Use brief, plain-language reasons grounded only in the current source.
- Return only valid JSON. No markdown or text outside the JSON.

JSON shape:
{
  "fields": [
    {
      "path": "the exact requested path",
      "state": "source_match" | "uncertain" | "unreadable" | "missing_in_candidate" | "not_present",
      "reason": "brief source-based explanation"
    }
  ],
  "notes": "optional source-comparison note"
}`
}

export function buildSourceReviewUserPrompt({
    rawText,
    extracted,
    fields,
    document,
}) {
    const boundedRawText =
        rawText.length > 80000
            ? `${rawText.slice(0, 80000)}\n[TRUNCATED]`
            : rawText
    const requestedFields = fields
        .map(
            (field) =>
                `- ${field.path}: ${JSON.stringify(field.value)}`
        )
        .join("\n")

    return `DOCUMENT METADATA
type: ${document.doc_type || "unknown"}
date: ${document.doc_date || "unknown"}
source: ${document.source_org || "unknown"}

CANDIDATE JSON
${JSON.stringify(extracted, null, 2)}

REQUESTED PATHS
${requestedFields}

CURRENT SOURCE TEXT
${boundedRawText}`
}

function parseJsonObject(text) {
    const cleaned = String(text || "")
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim()

    try {
        return JSON.parse(cleaned)
    } catch {
        const start = cleaned.indexOf("{")
        const end = cleaned.lastIndexOf("}")
        if (start === -1 || end <= start) return null

        try {
            return JSON.parse(cleaned.slice(start, end + 1))
        } catch {
            return null
        }
    }
}

export function parseSourceReview(text, requestedFields) {
    const parsed = parseJsonObject(text)
    if (!parsed || !Array.isArray(parsed.fields)) return null

    const requested = new Map(
        requestedFields.map((field) => [field.path, field])
    )
    const returned = new Map()

    for (const field of parsed.fields) {
        if (!requested.has(field?.path)) continue
        if (!SOURCE_STATES.has(field?.state)) continue
        if (returned.has(field.path)) continue

        returned.set(field.path, {
            path: field.path,
            state: field.state,
            reason:
                typeof field.reason === "string" && field.reason.trim()
                    ? field.reason.trim().slice(0, 300)
                    : "No source explanation was returned.",
        })
    }

    const fields = requestedFields.map((field) =>
        returned.get(field.path) || {
            path: field.path,
            state: "uncertain",
            reason: "The source reviewer did not return a valid comparison for this field.",
        }
    )

    return {
        fields,
        notes:
            typeof parsed.notes === "string"
                ? parsed.notes.slice(0, 500)
                : null,
    }
}

export function buildSourceReviewFailSafe(
    fields,
    reason,
    model = null,
    {
        reasonCode = "unavailable",
        retryable = true,
        elapsedMs = null,
    } = {}
) {
    return {
        model,
        failed: true,
        failure: {
            reason: reasonCode,
            retryable: Boolean(retryable),
            elapsed_ms: Number.isFinite(elapsedMs)
                ? Math.max(0, Math.round(elapsedMs))
                : null,
        },
        fields: fields.map((field) => ({
            path: field.path,
            state: "uncertain",
            reason,
        })),
        notes: reason,
    }
}
