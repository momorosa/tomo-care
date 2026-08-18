import assert from "node:assert/strict"
import test from "node:test"

import { getCandidateFingerprint } from "../verification/verificationIntelligence.js"
import { invokeSpecialist } from "./specialistContract.js"
import {
    VERIFICATION_INTELLIGENCE_CONTRACT,
    runVerificationIntelligence,
} from "./verificationIntelligenceSpecialist.js"

const EXTRACTED = {
    doc_date: "2026-08-16",
    source_org: "Fictional Cedar Veterinary Center",
    cost_items: [],
}
const CANDIDATE_FINGERPRINT = getCandidateFingerprint(EXTRACTED)

function buildAssessment({ failSafe = false } = {}) {
    return {
        schema_version: "verification_intelligence_v1",
        specialist: "verification_intelligence",
        status: "ready",
        candidate_fingerprint: CANDIDATE_FINGERPRINT,
        history: {
            document_ids: ["history-1"],
        },
        fields: [],
        summary: {
            blocking_count: failSafe ? 1 : 0,
        },
        fail_safe: failSafe,
    }
}

function buildDocument(overrides = {}) {
    return {
        id: "document-1",
        pet_id: "pet-1",
        raw_text:
            "Fictional veterinary source text long enough for bounded review testing only.",
        text_extracted: EXTRACTED,
        triage_result: null,
        doc_type: "receipt",
        doc_date: "2026-08-16",
        source_org: "Fictional Cedar Veterinary Center",
        updated_at: "2026-08-18T16:00:00.000Z",
        ...overrides,
    }
}

function buildInput(overrides = {}) {
    return {
        schema_version: "verification_intelligence_input_v1",
        intent: "review_document",
        document_id: "document-1",
        candidate_fingerprint: CANDIDATE_FINGERPRINT,
        source_metadata: {
            doc_type: "receipt",
            doc_date: "2026-08-16",
            source_org: "Fictional Cedar Veterinary Center",
        },
        force: false,
        ...overrides,
    }
}

async function invoke({ input = buildInput(), tools }) {
    return invokeSpecialist({
        contract: VERIFICATION_INTELLIGENCE_CONTRACT,
        input,
        handler: runVerificationIntelligence,
        tools,
    })
}

test("uses only the bounded review tools and returns a current assessment", async () => {
    const calls = []
    const assessment = buildAssessment()
    const result = await invoke({
        tools: {
            async load_current_document() {
                calls.push("load_current_document")
                return buildDocument()
            },
            async load_comparable_history() {
                calls.push("load_comparable_history")
                return [{ document: { id: "history-1" } }]
            },
            async compare_current_source() {
                calls.push("compare_current_source")
                return { failed: false, model: "fixture", fields: [] }
            },
            async build_verification_assessment() {
                calls.push("build_verification_assessment")
                return assessment
            },
            async persist_review_assessment(input) {
                calls.push("persist_review_assessment")
                assert.equal(input.documentId, "document-1")
                assert.equal(input.assessment, assessment)
                return { id: "document-1" }
            },
        },
    })

    assert.equal(result.status, "completed")
    assert.equal(result.result.result_status, "assessment_ready")
    assert.equal(result.result.assessment, assessment)
    assert.deepEqual(result.result.evidence_ids, ["document-1", "history-1"])
    assert.deepEqual(calls, [
        "load_current_document",
        "load_comparable_history",
        "compare_current_source",
        "build_verification_assessment",
        "persist_review_assessment",
    ])
})

test("rejects stale candidate evidence before comparison or persistence", async () => {
    let comparisonCalls = 0
    let persistenceCalls = 0
    const result = await invoke({
        input: buildInput({ candidate_fingerprint: "stale-fingerprint" }),
        tools: {
            async load_current_document() {
                return buildDocument()
            },
            async compare_current_source() {
                comparisonCalls += 1
            },
            async persist_review_assessment() {
                persistenceCalls += 1
            },
        },
    })

    assert.equal(result.status, "failed")
    assert.equal(result.failure.type, "stale_evidence")
    assert.equal(comparisonCalls, 0)
    assert.equal(persistenceCalls, 0)
})

test("returns a cached current assessment without repeating specialist work", async () => {
    const assessment = buildAssessment()
    const calls = []
    const result = await invoke({
        tools: {
            async load_current_document() {
                calls.push("load_current_document")
                return buildDocument({ triage_result: assessment })
            },
        },
    })

    assert.equal(result.status, "completed")
    assert.equal(result.result.result_status, "cached_assessment")
    assert.equal(result.result.cached, true)
    assert.deepEqual(calls, ["load_current_document"])
})

test("continues safely without history and records the limitation", async () => {
    const assessment = buildAssessment()
    let assessmentInput = null
    const result = await invoke({
        tools: {
            async load_current_document() {
                return buildDocument()
            },
            async load_comparable_history() {
                throw new Error("history unavailable")
            },
            async compare_current_source() {
                return { failed: false, model: "fixture", fields: [] }
            },
            async build_verification_assessment(input) {
                assessmentInput = input
                return assessment
            },
            async persist_review_assessment() {
                return { id: "document-1" }
            },
        },
    })

    assert.equal(result.status, "completed")
    assert.equal(result.result.history_unavailable, true)
    assert.deepEqual(assessmentInput.history, [])
    assert.equal(assessmentInput.historyUnavailable, true)
})

test("keeps an unavailable source reviewer as a completed manual-review assessment", async () => {
    const assessment = buildAssessment({ failSafe: true })
    const result = await invoke({
        tools: {
            async load_current_document() {
                return buildDocument()
            },
            async load_comparable_history() {
                return []
            },
            async compare_current_source() {
                return { failed: true, model: "fixture", fields: [] }
            },
            async build_verification_assessment() {
                return assessment
            },
            async persist_review_assessment() {
                return { id: "document-1" }
            },
        },
    })

    assert.equal(result.status, "completed")
    assert.equal(result.result.result_status, "manual_review")
    assert.equal(result.result.assessment.fail_safe, true)
    assert.equal(result.result.pending_human_decision, "review_verification_assessment")
})

test("keeps source text outside the specialist input contract", async () => {
    let toolCalled = false
    const result = await invoke({
        input: buildInput({ raw_text: "private source" }),
        tools: {
            async load_current_document() {
                toolCalled = true
                return buildDocument()
            },
        },
    })

    assert.equal(result.status, "failed")
    assert.equal(result.failure.type, "malformed_input")
    assert.equal(toolCalled, false)
})
