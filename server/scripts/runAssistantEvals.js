import fs from "node:fs/promises"
import path from "node:path"

const PET_ID =
    process.env.PET_ID || "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

const BASE_URL =
    process.env.ASSISTANT_BASE_URL || "http://localhost:3001"

const EVAL_FILE =
    process.env.EVAL_FILE ||
    path.resolve("server/assistant/evals/phase3a.json")

async function main() {
    const raw = await fs.readFile(EVAL_FILE, "utf8")
    const cases = JSON.parse(raw)

    let passed = 0
    let failed = 0

    console.log(`Running ${cases.length} assistant eval(s)...\n`)

    for (const testCase of cases) {
        const result = await runCase(testCase)

        if (result.ok) {
            passed += 1
            console.log(`✅ ${testCase.id}`)
        } else {
            failed += 1
            console.log(`❌ ${testCase.id}`)
            console.log(`   Question: ${testCase.question}`)
            for (const issue of result.issues) {
                console.log(`   - ${issue}`)
            }

            if (result.response) {
                console.log(`   intent: ${result.response.query_plan?.intent}`)
                console.log(`   answer_type: ${result.response.answer_type}`)
                console.log(`   answer: ${result.response.answer}`)
            }

            console.log("")
        }
    }

    console.log(`\nResult: ${passed} passed, ${failed} failed`)

    if (failed > 0) {
        process.exit(1)
    }
}

async function runCase(testCase) {
    const response = await fetch(
        `${BASE_URL}/api/pets/${PET_ID}/assistant/query`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ question: testCase.question }),
        }
    )

    const data = await response.json()

    if (!response.ok || data.error) {
        return {
            ok: false,
            issues: [data.error || `HTTP ${response.status}`],
            response: data,
        }
    }

    const issues = evaluateResponse(data, testCase.expected || {})

    return {
        ok: issues.length === 0,
        issues,
        response: data,
    }
}

function evaluateResponse(data, expected) {
    const issues = []
    const answer = normalizeForMatch(data.answer)
    const citations = data.citations || []

    if (expected.intent && data.query_plan?.intent !== expected.intent) {
        issues.push(
            `Expected intent "${expected.intent}", got "${data.query_plan?.intent}"`
        )
    }

    if (
        expected.answer_type &&
        data.answer_type !== expected.answer_type
    ) {
        issues.push(
            `Expected answer_type "${expected.answer_type}", got "${data.answer_type}"`
        )
    }

    for (const phrase of expected.required_phrases || []) {
        if (!answer.includes(normalizeForMatch(phrase))) {
            issues.push(`Missing required phrase: "${phrase}"`)
        }
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

    for (const sourceTitle of expected.required_citation_source_titles || []) {
        const found = citations.some(
            (citation) =>
                normalizeForMatch(citation.source_title) ===
                normalizeForMatch(sourceTitle)
        )

        if (!found) {
            issues.push(`Missing citation source title: "${sourceTitle}"`)
        }
    }

    if (expected.proposed_action === "null" && data.proposed_action !== null) {
        issues.push("Expected proposed_action to be null")
    }

    if (
        expected.proposed_action === "present" &&
        (data.proposed_action === null || data.proposed_action === undefined)
    ) {
        issues.push("Expected proposed_action to be present")
    }

    if (expected.proposed_action === "any") {
        // Explicitly no-op.
    }

    return issues
}

function normalizeForMatch(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/\s+/g, " ")
        .trim()
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})  
