import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import {
    comparePendingActionSnapshots,
    evaluateAssistantResponse,
} from "../assistant/evalAssertions.js"

const PET_ID =
    process.env.PET_ID || "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

const BASE_URL =
    process.env.ASSISTANT_BASE_URL || "http://localhost:3001"

const DEFAULT_EVAL_FILES = [
    path.resolve("server/assistant/evals/phase3a.json"),
    path.resolve("server/assistant/evals/phase3b.json"),
]

async function main() {
    const suites = await loadEvalSuites()
    const cases = suites.flatMap(({ suiteName, cases: suiteCases }) =>
        suiteCases.map((testCase) => ({
            ...testCase,
            suiteName,
        }))
    )
    const pendingBefore = await loadPendingActions()

    let passed = 0
    let failed = 0

    console.log(
        `Running ${cases.length} read-only assistant eval(s) across ${suites.length} suite(s)...\n`
    )

    for (const testCase of cases) {
        const result = await runCase(testCase)
        const label = `${testCase.suiteName}:${testCase.id}`

        if (result.ok) {
            passed += 1
            console.log(`✅ ${label}`)
        } else {
            failed += 1
            console.log(`❌ ${label}`)
            console.log(`   Question: ${testCase.question}`)
            for (const issue of result.issues) {
                console.log(`   - ${issue}`)
            }

            if (result.response) {
                console.log(
                    `   intent: ${result.response.query_plan?.intent}`
                )
                console.log(
                    `   answer_type: ${result.response.answer_type}`
                )
                console.log(`   answer: ${result.response.answer}`)
            }

            console.log("")
        }
    }

    const pendingAfter = await loadPendingActions()
    const ledgerIssues = comparePendingActionSnapshots(
        pendingBefore,
        pendingAfter
    )

    if (ledgerIssues.length) {
        failed += 1
        console.log("❌ pending_action_ledger_unchanged")
        for (const issue of ledgerIssues) {
            console.log(`   - ${issue}`)
        }
    } else {
        passed += 1
        console.log("✅ pending_action_ledger_unchanged")
    }

    console.log(`\nResult: ${passed} passed, ${failed} failed`)

    if (failed > 0) {
        process.exit(1)
    }
}

async function loadEvalSuites() {
    const evalFiles = process.env.EVAL_FILES
        ? process.env.EVAL_FILES
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
              .map((value) => path.resolve(value))
        : DEFAULT_EVAL_FILES

    return Promise.all(
        evalFiles.map(async (evalFile) => {
            const raw = await fs.readFile(evalFile, "utf8")
            const cases = JSON.parse(raw)

            for (const testCase of cases) {
                if (testCase.safety !== "read_only") {
                    throw new Error(
                        `${evalFile}:${testCase.id} must declare safety "read_only".`
                    )
                }
            }

            return {
                suiteName: path.basename(evalFile, path.extname(evalFile)),
                cases,
            }
        })
    )
}

async function runCase(testCase) {
    let response

    try {
        response = await fetch(
            `${BASE_URL}/api/pets/${PET_ID}/assistant/query`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    question: testCase.question,
                    evaluationMode: "read_only",
                }),
            }
        )
    } catch (error) {
        return {
            ok: false,
            issues: [
                `Could not reach TomoCare at ${BASE_URL}: ${error.message}`,
            ],
            response: null,
        }
    }

    const data = await readJsonResponse(response)

    const expectedStatus = testCase.expected_http_status || 200

    if (response.status !== expectedStatus) {
        return {
            ok: false,
            issues: [
                data.error ||
                    `Expected HTTP ${expectedStatus}, got HTTP ${response.status}`,
            ],
            response: data,
        }
    }

    const issues = evaluateAssistantResponse(
        data,
        testCase.expected || {}
    )

    return {
        ok: issues.length === 0,
        issues,
        response: data,
    }
}

async function loadPendingActions() {
    let response

    try {
        response = await fetch(
            `${BASE_URL}/api/pets/${PET_ID}/care-actions/pending`
        )
    } catch (error) {
        throw new Error(
            `Could not read the pending-action ledger at ${BASE_URL}. Start TomoCare before running evals. ${error.message}`
        )
    }

    const data = await readJsonResponse(response)

    if (!response.ok || data.ok !== true) {
        throw new Error(
            data.error ||
                `Pending-action snapshot failed with HTTP ${response.status}.`
        )
    }

    return Array.isArray(data.pending_actions)
        ? data.pending_actions
        : []
}

async function readJsonResponse(response) {
    const text = await response.text()

    try {
        return text ? JSON.parse(text) : {}
    } catch {
        return {
            error: `Expected JSON but received: ${text.slice(0, 160)}`,
        }
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})