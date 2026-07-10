import { sbAdmin } from "../supabase.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const DRY_RUN = process.argv.includes("--dry-run")

async function main() {
    const { data: docs, error } = await sbAdmin
        .from("documents")
        .select("id, pet_id, title, doc_type, doc_date, raw_text, text_extracted, status")
        .eq("pet_id", PET_ID)
        .eq("status", "verified")
        .order("doc_date", { ascending: false })

    if (error) throw new Error(error.message)

    const candidates = []

    for (const doc of docs || []) {
        const candidate = extractWeightCandidate(doc)

        if (!candidate) continue

        candidates.push(candidate)
    }

    console.log(`Found ${candidates.length} weight candidate(s).`)

    for (const candidate of candidates) {
        console.log("\n---")
        console.log({
            doc_id: candidate.doc_id,
            title: candidate.title,
            fact_date: candidate.fact_date,
            value: candidate.value_json.value,
            unit: candidate.value_json.unit,
            value_lb: candidate.value_json.value_lb,
            confidence: candidate.confidence,
            extraction_method: candidate.value_json.extraction_method,
            source_context: candidate.value_json.source_context,
        })

        if (!DRY_RUN) {
            await insertWeightFactIfMissing(candidate)
        }
    }

    if (DRY_RUN) {
        console.log("\nDry run only. No facts inserted.")
    } else {
        console.log("\nDone inserting proposed weight facts.")
    }
}

function extractWeightCandidate(doc) {
    const textParts = []

    const notes = doc.text_extracted?.notes
    if (notes) {
        textParts.push({
            source: "text_extracted.notes",
            text: String(notes),
        })
    }

    if (doc.text_extracted) {
        textParts.push({
            source: "text_extracted",
            text: JSON.stringify(doc.text_extracted),
        })
    }

    if (doc.raw_text) {
        textParts.push({
            source: "raw_text",
            text: String(doc.raw_text),
        })
    }

    for (const part of textParts) {
        const labeled = extractLabeledWeight(part.text)
        if (labeled) {
            return buildCandidate(doc, labeled, part.source, "labeled_weight", 0.95)
        }
    }

    for (const part of textParts) {
        const patientHeader = extractPatientHeaderWeight(part.text)
        if (patientHeader) {
            return buildCandidate(doc, patientHeader, part.source, "patient_header_weight", 0.85)
        }
    }

    return null
}

function extractLabeledWeight(text) {
    const match = text.match(/\b(?:weight|wt|patient weight)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(kg|kgs|kilogram|kilograms|lb|lbs|pound|pounds)\b/i)

    if (!match) return null

    return {
        value: Number(match[1]),
        unit: normalizeUnit(match[2]),
        source_context: getContext(text, match.index, match[0].length),
    }
}

function extractPatientHeaderWeight(text) {
    const patientLineMatch = text.match(/patients?\s*:\s*.{0,240}?(\d{1,2}(?:\.\d{1,2})?)\s*(kg|kgs|kilogram|kilograms|lb|lbs|pound|pounds)\b/i)

    if (!patientLineMatch) return null

    const value = Number(patientLineMatch[1])
    const unit = normalizeUnit(patientLineMatch[2])

    if (!isPlausibleMomoWeight(value, unit)) return null

    return {
        value,
        unit,
        source_context: getContext(
            text,
            patientLineMatch.index,
            patientLineMatch[0].length
        ),
    }
}

function buildCandidate(doc, extracted, sourceField, extractionMethod, confidence) {
    const valueKg = extracted.unit === "kg"
        ? extracted.value
        : extracted.value / 2.2046226218

    const valueLb = extracted.unit === "lb"
        ? extracted.value
        : extracted.value * 2.2046226218

    return {
        pet_id: PET_ID,
        doc_id: doc.id,
        fact_type: "weight",
        fact_date: doc.doc_date,
        status: "proposed",
        confidence,
        title: doc.title,
        value_json: {
            value: round(extracted.value, 2),
            unit: extracted.unit,
            value_kg: round(valueKg, 2),
            value_lb: round(valueLb, 2),
            source_field: sourceField,
            source_label: extractionMethod === "labeled_weight" ? "Weight" : "Patient metadata weight",
            extraction_method: extractionMethod,
            source_context: extracted.source_context,
        },
    }
}

async function insertWeightFactIfMissing(candidate) {
    const { data: existing, error: existingError } = await sbAdmin
        .from("facts")
        .select("id")
        .eq("pet_id", candidate.pet_id)
        .eq("doc_id", candidate.doc_id)
        .eq("fact_type", "weight")
        .eq("fact_date", candidate.fact_date)
        .limit(1)

    if (existingError) throw new Error(existingError.message)

    if (existing?.length) {
        console.log(`Skipping existing weight fact for doc ${candidate.doc_id}`)
        return
    }

    const { error } = await sbAdmin
        .from("facts")
        .insert({
            pet_id: candidate.pet_id,
            doc_id: candidate.doc_id,
            fact_type: candidate.fact_type,
            fact_date: candidate.fact_date,
            status: candidate.status,
            confidence: candidate.confidence,
            value_json: candidate.value_json,
        })

    if (error) throw new Error(error.message)

    console.log(`Inserted proposed weight fact for doc ${candidate.doc_id}`)
}

function normalizeUnit(unit) {
    const value = String(unit).toLowerCase()

    if (["lb", "lbs", "pound", "pounds"].includes(value)) return "lb"
    return "kg"
}

function isPlausibleMomoWeight(value, unit) {
    if (unit === "kg") return value >= 8 && value <= 25
    if (unit === "lb") return value >= 18 && value <= 55
    return false
}

function getContext(text, index = 0, length = 0) {
    const start = Math.max(index - 100, 0)
    const end = Math.min(index + length + 140, text.length)

    return text
        .slice(start, end)
        .replace(/\s+/g, " ")
        .trim()
}

function round(value, decimals = 2) {
    return Number(value.toFixed(decimals))
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})