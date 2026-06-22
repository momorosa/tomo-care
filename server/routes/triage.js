import express from "express"
import { sbAdmin } from "../supabase.js"

const router = express.Router()

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const TRIAGE_MODEL = process.env.TRIAGE_MODEL || "claude-sonnet-4-6"

// ─────────────────────────────────────────────
// POST /api/documents/:docId/triage
//
// Runs the AI reviewer against an existing extraction.
// Scores each field, does NOT re-extract.
// Stores result in documents.triage_result.
// ─────────────────────────────────────────────
router.post("/documents/:docId/triage", async (req, res) => {
  const { docId } = req.params
  const { force = false } = req.body || {}

  try {
    // 1) Load doc
    const { data: doc, error } = await sbAdmin
      .from("documents")
      .select("id, raw_text, text_extracted, triage_result, doc_type, doc_date, status")
      .eq("id", docId)
      .single()

    if (error || !doc) {
      return res.status(404).json({ error: error?.message || "Document not found" })
    }

    // Skip if already triaged (unless forced)
    if (doc.triage_result && !force) {
      return res.json({ ok: true, cached: true, triage_result: doc.triage_result })
    }

    const rawText = (doc.raw_text || "").trim()
    const extracted = doc.text_extracted

    if (!rawText || rawText.length < 40) {
      return res.status(400).json({ error: "No raw_text available for triage." })
    }

    if (!extracted || typeof extracted !== "object" || Object.keys(extracted).length === 0) {
      return res.status(400).json({ error: "No text_extracted available for triage." })
    }

    // 2) Build triage prompt
    const triageResult = await runTriage(rawText, extracted, doc)

    // 3) Persist
    const { error: updateErr } = await sbAdmin
      .from("documents")
      .update({ triage_result: triageResult })
      .eq("id", docId)

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message })
    }

    res.json({ ok: true, cached: false, triage_result: triageResult })
  } catch (err) {
    console.error("[triage] error:", err)
    res.status(500).json({ error: err?.message || "Triage failed" })
  }
})

// ─────────────────────────────────────────────
// Triage logic
// ─────────────────────────────────────────────

async function runTriage(rawText, extracted, doc) {
  if (!ANTHROPIC_API_KEY) {
    console.warn("[triage] No ANTHROPIC_API_KEY — returning fail-safe needs-confirmation for all fields")
    return buildFailSafeResult("No API key configured")
  }

  const fieldPaths = enumerateFields(extracted)

  // Nothing to triage
  if (fieldPaths.length === 0) {
    return {
      model: TRIAGE_MODEL,
      created_at: new Date().toISOString(),
      overall_confidence: "low",
      fields: [],
      notes: "No triageable fields found in extraction.",
    }
  }

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(rawText, extracted, fieldPaths, doc)

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: TRIAGE_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error("[triage] API error:", response.status, errBody)
      return buildFailSafeResult(`API returned ${response.status}`)
    }

    const data = await response.json()
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")

    const parsed = parseTriageResponse(text)

    return {
      model: TRIAGE_MODEL,
      created_at: new Date().toISOString(),
      overall_confidence: parsed.overall_confidence || "medium",
      fields: parsed.fields || [],
      notes: parsed.notes || null,
    }
  } catch (err) {
    console.error("[triage] fetch error:", err)
    return buildFailSafeResult(err.message)
  }
}


function buildSystemPrompt() {
  return `You are an AI reviewer for a pet health record system called TomoCare.

Your job is to REVIEW an existing AI extraction — NOT to re-extract. You are given:
1. The raw text extracted from a PDF document
2. The structured JSON that another AI produced from that raw text

For each field in the extraction, you must classify it:

- "auto-confirmed": The extracted value clearly matches what's in the raw text. High confidence.
- "needs-confirmation": The value is plausible but uncertain (ambiguous in source, could be misread, or this is a high-stakes field like a medication name, dosage, or date that should always get a human look).
- "unreadable-source": The raw text in the relevant area appears garbled, truncated, or too ambiguous to verify against.

Rules:
- Medication names, dosages, injection types, and dates are ALWAYS high-stakes. Even if confident, classify as "needs-confirmation" unless the match is unambiguous.
- Financial totals: cross-check against line item sum if possible.
- If a field's value is null/empty in the extraction AND you can find the value in raw_text, mark as "needs-confirmation" with reason explaining what was missed.
- If a field's value is null/empty AND it genuinely doesn't appear in the raw text, mark as "auto-confirmed" with reason "Not present in source document."

Return ONLY valid JSON. No markdown fences, no explanation outside the JSON.

JSON shape:
{
  "overall_confidence": "high" | "medium" | "low",
  "fields": [
    {
      "path": "invoice_id",
      "state": "auto-confirmed" | "needs-confirmation" | "unreadable-source",
      "reason": "brief explanation",
      "extracted_value": "<the value from the extraction>"
    }
  ],
  "notes": "optional overall notes"
}`
}


function buildUserPrompt(rawText, extracted, fieldPaths, doc) {
  // Truncate raw_text to avoid blowing context
  const truncatedRaw = rawText.length > 80000 ? rawText.slice(0, 80000) + "\n[TRUNCATED]" : rawText

  const fieldsToReview = fieldPaths.map((f) => `  - ${f.path}: ${JSON.stringify(f.value)}`).join("\n")

  return `DOCUMENT METADATA:
doc_type: ${doc.doc_type || "unknown"}
doc_date: ${doc.doc_date || "unknown"}
status: ${doc.status || "unknown"}

EXTRACTED JSON:
${JSON.stringify(extracted, null, 2)}

FIELDS TO REVIEW:
${fieldsToReview}

RAW TEXT FROM SOURCE PDF:
${truncatedRaw}

Review each field above. Return your triage as JSON.`
}


// ─────────────────────────────────────────────
// Field enumeration
// ─────────────────────────────────────────────

function enumerateFields(extracted) {
  const fields = []

  // Top-level scalar fields
  const topLevel = ["invoice_id", "doc_date", "source_org", "summary"]
  for (const key of topLevel) {
    if (key in extracted) {
      fields.push({ path: key, value: extracted[key] })
    }
  }

  // Totals
  if (extracted.totals && typeof extracted.totals === "object") {
    if ("paid" in extracted.totals) {
      fields.push({ path: "totals.paid", value: extracted.totals.paid })
    }
  }

  // Events
  if (Array.isArray(extracted.events)) {
    extracted.events.forEach((e, i) => {
      fields.push({ path: `events[${i}].event_type`, value: e?.event_type })
      fields.push({ path: `events[${i}].event_date`, value: e?.event_date })
      if (e?.details_json?.description) {
        fields.push({ path: `events[${i}].description`, value: e.details_json.description })
      }
    })
  }

  // Cost items
  if (Array.isArray(extracted.cost_items)) {
    extracted.cost_items.forEach((ci, i) => {
      fields.push({ path: `cost_items[${i}].label`, value: ci?.label })
      fields.push({ path: `cost_items[${i}].amount`, value: ci?.amount })
      fields.push({ path: `cost_items[${i}].service_date`, value: ci?.service_date })
    })
  }

  // Labs (high-level — panel + date, not every analyte for now)
  if (Array.isArray(extracted.labs)) {
    extracted.labs.forEach((lab, i) => {
      fields.push({ path: `labs[${i}].panel`, value: lab?.panel })
      fields.push({ path: `labs[${i}].lab_date`, value: lab?.lab_date })
      // Flag result count so reviewer can sanity-check completeness
      const resultCount = Array.isArray(lab?.results) ? lab.results.length : 0
      fields.push({ path: `labs[${i}].result_count`, value: resultCount })
    })
  }

  return fields
}


// ─────────────────────────────────────────────
// Response parsing
// ─────────────────────────────────────────────

function parseTriageResponse(text) {
  const cleaned = (text || "").trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === "object" && Array.isArray(parsed.fields)) {
      return parsed
    }
  } catch {
    // Try to find JSON object in the response
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1))
        if (typeof parsed === "object" && Array.isArray(parsed.fields)) {
          return parsed
        }
      } catch {
        // fall through to fail-safe
      }
    }
  }

  console.error("[triage] Could not parse model response. First 500 chars:", cleaned.slice(0, 500))
  return {
    overall_confidence: "low",
    fields: [],
    notes: "Triage response could not be parsed. All fields default to needs-confirmation.",
  }
}


// ─────────────────────────────────────────────
// Fail-safe: everything needs confirmation
// ─────────────────────────────────────────────

function buildFailSafeResult(reason) {
  return {
    model: TRIAGE_MODEL,
    created_at: new Date().toISOString(),
    overall_confidence: "low",
    fields: [],
    notes: `Fail-safe: triage could not run (${reason}). All fields default to needs-confirmation.`,
    fail_safe: true,
  }
}

export default router
