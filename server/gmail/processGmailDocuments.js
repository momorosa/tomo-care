import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import { sbAdmin } from "../supabase.js"
import { ingestGmailReceipts } from "./ingestGmailReceipts.js"
import { getDocumentProcessingDecision } from "./documentProcessingDecision.js"
import { getInboxProcessingPlan } from "./documentProvenance.js"
import {
    buildManualReviewExtraction,
    buildManualReviewWarning,
    getProcessingFailurePresentation,
} from "./documentProcessingFallback.js"

export { getDocumentProcessingDecision } from "./documentProcessingDecision.js"

/**
 * Gmail ingest
 * → create documents row
 * → populate raw_text
 * → run extraction wrapper
 * → call triage endpoint
 * → set status = needs_review
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "../..")

const PYTHON_BIN = process.env.PYTHON_BIN || "python3"
const API_BASE_URL = process.env.TOMO_API_BASE_URL || "http://localhost:3001"

const POPULATE_RAW_TEXT_SCRIPT = path.join(
    PROJECT_ROOT,
    "agent/scripts/populate_raw_text.py"
)

const EXTRACT_DOCUMENT_SCRIPT = path.join(
    PROJECT_ROOT,
    "agent/scripts/extract_document.py"
)

function runCommand(command, args, label) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: PROJECT_ROOT,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        })

        let stdout = ""
        let stderr = ""

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        })

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        })

        child.on("error", (error) => {
            reject(
                new Error(
                `[${label}] failed to start: ${error.message}`
                )
            )
        })

        child.on("close", (code) => {
            if (code !== 0) {
                reject(
                    new Error(
                    `[${label}] exited with code ${code}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
                    )
                )
                return
            }

            resolve({
                label,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            })
        })
    })
}

async function populateRawText(docId) {
    return runCommand(
        PYTHON_BIN,
        [POPULATE_RAW_TEXT_SCRIPT, docId],
        "populate_raw_text"
    )
}

async function extractDocument(docId) {
    return runCommand(
        PYTHON_BIN,
        [EXTRACT_DOCUMENT_SCRIPT, docId],
        "extract_document"
    )
}

async function runTriage(docId) {
    let response

    try {
        response = await fetch(`${API_BASE_URL}/api/documents/${docId}/triage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                force: true,
            }),
        })
    } catch (error) {
        throw new Error(
            `[triage] Could not reach ${API_BASE_URL}. Is npm run dev:api running?\n${error.message}`
        )
    }

    const text = await response.text()

    let body
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text
    }

    if (!response.ok) {
        throw new Error(
            `[triage] failed with ${response.status}\n${JSON.stringify(body, null, 2)}`
        )
    }

    return body
}

async function markNeedsReview(docId) {
    const { data, error } = await sbAdmin
        .from("documents")
        .update({
            status: "needs_review",
            remarks:
                "Imported from Gmail. Raw text, extraction, and triage completed; ready for review.",
            updated_at: new Date().toISOString(),
        })
        .eq("id", docId)
        .select("id, status, updated_at")
        .single()

    if (error) throw error

    return data;
}

async function markProcessingFailed(docId, step, error) {
    const message = `[Gmail processing failed at ${step}] ${error.message}`

    await sbAdmin
        .from("documents")
        .update({
            remarks: message.slice(0, 1000),
            updated_at: new Date().toISOString(),
        })
        .eq("id", docId)

    return message
}

async function markExtractionFallbackForReview(document, error) {
    const warning = buildManualReviewWarning(document.id)
    const fallback = buildManualReviewExtraction(document)
    const message = `[${warning.code}] ${error.message}`

    const { data, error: updateError } = await sbAdmin
        .from("documents")
        .update({
            text_extracted: fallback,
            triage_result: null,
            status: "needs_review",
            remarks: message.slice(0, 1000),
            updated_at: new Date().toISOString(),
        })
        .eq("id", document.id)
        .select("id, status, updated_at")
        .single()

    if (updateError) throw updateError

    return { warning, document: data }
}

export async function processDocumentToReview(docId, { force = false } = {}) {
    const result = {
        documentId: docId,
        status: "started",
        steps: [],
    }

    const { data: document, error: documentError } = await sbAdmin
        .from("documents")
        .select(
            "id, pet_id, title, doc_type, doc_date, source_org, status, raw_text, text_extracted, triage_result"
        )
        .eq("id", docId)
        .single()

    if (documentError) {
        result.status = "failed"
        result.error = `[load_document] ${documentError.message}`
        return result
    }

    const processingDecision = getDocumentProcessingDecision(document)

    if (!processingDecision.allowed) {
        return {
            documentId: docId,
            status: "skipped",
            reason: processingDecision.reason,
            steps: [],
        }
    }

    let currentStep = "populate_raw_text"

    try {
        if (!document.raw_text || force) {
            const rawTextResult = await populateRawText(docId)
            result.steps.push({
                step: "populate_raw_text",
                ok: true,
                outputReceived: Boolean(rawTextResult.stdout),
            })
        } else {
            result.steps.push({
                step: "populate_raw_text",
                ok: true,
                skipped: true,
                reason: "raw_text already exists",
            })
        }
    

        currentStep = "extract_document"

        if (!document.text_extracted || force) {
            const extractionResult = await extractDocument(docId)
            result.steps.push({
                step: "extract_document",
                ok: true,
                outputReceived: Boolean(extractionResult.stdout),
            })
        } else {
            result.steps.push({
                step: "extract_document",
                ok: true,
                skipped: true,
                reason: "text_extracted already exists",
            })
        }

        currentStep = "triage"

        if (!document.triage_result || force) {
            const triageResult = await runTriage(docId)
            result.steps.push({
                step: "triage",
                ok: true,
                cached: triageResult?.cached ?? false,
            })
        } else {
            result.steps.push({
                step: "triage",
                ok: true,
                skipped: true,
                reason: "triage_result already exists",
            })
        }

        currentStep = "mark_needs_review"
        const reviewStatus = await markNeedsReview(docId)
        result.steps.push({
            step: "mark_needs_review",
            ok: true,
            status: reviewStatus.status,
        })

        result.status = "needs_review"
        return result
    } catch (error) {
        let failureError = error
        const rawTextAvailable =
            Boolean(document.raw_text) ||
            result.steps.some(
                (step) => step.step === "populate_raw_text" && step.ok
            )

        if (currentStep === "extract_document" && rawTextAvailable) {
            try {
                const fallback = await markExtractionFallbackForReview(
                    document,
                    error
                )

                result.status = "needs_review"
                result.degraded = true
                result.failedStep = currentStep
                result.warning = fallback.warning
                result.steps.push({
                    step: "route_to_manual_review",
                    ok: true,
                    status: fallback.document.status,
                })
                return result
            } catch (fallbackError) {
                failureError = fallbackError
                currentStep = "mark_needs_review"
            }
        }

        result.status = "failed"
        result.error = failureError.message
        result.failedStep = currentStep
        result.presentation = getProcessingFailurePresentation(currentStep)

        await markProcessingFailed(docId, currentStep, failureError)

        return result
    }
}

export async function processExistingDocuments({ documentIds }) {
    const processedDocuments = []

    for (const docId of documentIds) {
        const processed = await processDocumentToReview(docId, { force: false })
        processedDocuments.push(processed);
    }

    return {
        mode: "existing_documents",
        documentsRequested: documentIds.length,
        processedDocuments,
    }
}

export async function processGmailInbox({
    maxResults = 25,
    dryRun = false,
} = {}) {
    const ingestSummary = await ingestGmailReceipts({
        maxResults,
        dryRun,
    })

    const processingPlan = getInboxProcessingPlan(ingestSummary.items)

    const processedDocuments = []

    if (!dryRun) {
        for (const item of processingPlan) {
            const processed = await processDocumentToReview(item.documentId)
            processedDocuments.push({
                ...processed,
                filename: item.filename,
                intakeAction: item.intakeAction,
            })
        }
    }

    return {
        mode: "gmail_inbox",
        dryRun,
        ingestSummary,
        documentsCreated: ingestSummary.documentsCreated || 0,
        documentsRetried: processingPlan.filter(
            (item) => item.intakeAction === "retry_existing_document"
        ).length,
        processedDocuments,
    }
}
