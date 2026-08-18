import assert from "node:assert/strict"
import test from "node:test"

import { getCandidateFingerprint } from "../verification/verificationIntelligence.js"
import { createSpecialistRegistry } from "./specialistRegistry.js"
import {
    buildVerificationContextFingerprint,
    coordinateVerificationIntelligenceReview,
    VerificationIntelligenceHandoffError,
} from "./verificationIntelligenceHandoff.js"
import { verificationIntelligenceSpecialist } from "./verificationIntelligenceSpecialist.js"

const EXTRACTED = {
    doc_date: "2026-08-16",
    source_org: "Fictional Cedar Veterinary Center",
    cost_items: [],
}
const FINGERPRINT = getCandidateFingerprint(EXTRACTED)

function buildAssessment() {
    return {
        schema_version: "verification_intelligence_v1",
        specialist: "verification_intelligence",
        status: "ready",
        candidate_fingerprint: FINGERPRINT,
        history: { document_ids: [] },
        fields: [],
        summary: { blocking_count: 0 },
        fail_safe: false,
    }
}

function buildDocument(overrides = {}) {
    return {
        id: "document-1",
        pet_id: "pet-1",
        raw_text:
            "Fictional veterinary source text long enough for the manager handoff test.",
        text_extracted: EXTRACTED,
        triage_result: null,
        doc_type: "receipt",
        doc_date: "2026-08-16",
        source_org: "Fictional Cedar Veterinary Center",
        updated_at: "2026-08-18T16:00:00.000Z",
        ...overrides,
    }
}

function buildRepository({ reusable = null } = {}) {
    const calls = {
        insertRun: [],
        updateRun: [],
    }
    let active = null

    return {
        calls,
        async findReusableRun() {
            return reusable
        },
        async findActiveRun() {
            return active
        },
        async insertRun(run) {
            calls.insertRun.push(run)
            active = {
                ...run,
                id: "run-1",
                updated_at: "2026-08-18T16:00:01.000Z",
            }
            return active
        },
        async updateRun(args) {
            calls.updateRun.push(args)
            active = {
                ...active,
                ...args.patch,
                updated_at: "2026-08-18T16:00:02.000Z",
            }
            return active
        },
    }
}

function buildTools({ document = buildDocument(), persistError = null } = {}) {
    const assessment = buildAssessment()
    const calls = []

    return {
        calls,
        async load_current_document() {
            calls.push("load_current_document")
            return document
        },
        async load_comparable_history() {
            calls.push("load_comparable_history")
            return []
        },
        async compare_current_source() {
            calls.push("compare_current_source")
            return { failed: false, model: "fixture", fields: [] }
        },
        async build_verification_assessment() {
            calls.push("build_verification_assessment")
            return assessment
        },
        async persist_review_assessment() {
            calls.push("persist_review_assessment")
            if (persistError) throw persistError
            return { id: "document-1" }
        },
    }
}

const registry = createSpecialistRegistry([
    verificationIntelligenceSpecialist,
])

test("routes a document review through Tomo and returns a safe trace", async () => {
    const repository = buildRepository()
    const tools = buildTools()
    const result = await coordinateVerificationIntelligenceReview({
        documentId: "document-1",
        repository,
        registry,
        tools,
        now: () => "2026-08-18T16:00:03.000Z",
    })

    assert.equal(result.cached, false)
    assert.equal(result.triage_result.status, "ready")
    assert.equal(result.orchestration_trace.manager.decision, "delegate")
    assert.equal(
        result.orchestration_trace.specialist.name,
        "verification_intelligence"
    )
    assert.equal(result.orchestration_trace.result_status, "assessment_ready")
    assert.equal(repository.calls.insertRun.length, 1)
    assert.equal(repository.calls.updateRun.length, 1)

    const traceJson = JSON.stringify(result.orchestration_trace)
    assert.doesNotMatch(traceJson, /Fictional veterinary source text/)
    assert.doesNotMatch(traceJson, /raw_text/)
    assert.doesNotMatch(traceJson, /prompt/i)
})

test("recovers a completed trace and current assessment without specialist work", async () => {
    const assessment = buildAssessment()
    const document = buildDocument({ triage_result: assessment })
    const contextFingerprint = buildVerificationContextFingerprint({
        documentId: document.id,
        candidateFingerprint: FINGERPRINT,
    })
    const reusableTrace = {
        schema_version: "tomo_manager_trace_v1",
        run_id: "run-existing",
        manager: { decision: "delegate" },
        specialist: { name: "verification_intelligence", status: "completed" },
        evidence: { count: 1, ids: [document.id] },
        result_status: "assessment_ready",
        recovered: false,
    }
    const repository = buildRepository({
        reusable: {
            id: "run-existing",
            context_fingerprint: contextFingerprint,
            result_json: { safe_trace: reusableTrace },
        },
    })
    const tools = buildTools({ document })
    const result = await coordinateVerificationIntelligenceReview({
        documentId: document.id,
        repository,
        registry,
        tools,
    })

    assert.equal(result.cached, true)
    assert.equal(result.triage_result, assessment)
    assert.equal(result.orchestration_trace.recovered, true)
    assert.deepEqual(tools.calls, ["load_current_document"])
    assert.equal(repository.calls.insertRun.length, 0)
})

test("maps changed evidence during persistence to a typed retry boundary", async () => {
    const repository = buildRepository()
    const staleError = new Error("document changed")
    staleError.reason = "stale_evidence"
    staleError.retryable = true
    const tools = buildTools({ persistError: staleError })

    await assert.rejects(
        () =>
            coordinateVerificationIntelligenceReview({
                documentId: "document-1",
                repository,
                registry,
                tools,
            }),
        (error) => {
            assert.ok(error instanceof VerificationIntelligenceHandoffError)
            assert.equal(error.status, 409)
            assert.equal(error.reason, "stale_evidence")
            assert.equal(error.trace.result_status, "stale_evidence")
            return true
        }
    )
})

test("rejects missing source text before creating an orchestration run", async () => {
    const repository = buildRepository()
    const tools = buildTools({
        document: buildDocument({ raw_text: "" }),
    })

    await assert.rejects(
        () =>
            coordinateVerificationIntelligenceReview({
                documentId: "document-1",
                repository,
                registry,
                tools,
            }),
        (error) => {
            assert.equal(error.status, 400)
            assert.equal(error.reason, "source_text_missing")
            return true
        }
    )

    assert.equal(repository.calls.insertRun.length, 0)
})
