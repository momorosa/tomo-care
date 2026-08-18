import assert from "node:assert/strict"
import test from "node:test"

import { defineSpecialistContract } from "./specialistContract.js"
import { createSpecialistRegistry } from "./specialistRegistry.js"
import {
    coordinateTomoSpecialist,
    selectSpecialistForIntent,
    TOMO_MANAGER_TRACE_VERSION,
} from "./tomoManager.js"

const CONTRACT = defineSpecialistContract({
    name: "verification_intelligence",
    version: 1,
    description: "Fixture verification specialist.",
    allowedTruthTiers: ["candidate", "review_assessment"],
    allowedTools: ["read_document"],
    timeoutMs: 100,
    validateInput: (input) => input?.schema_version === "fixture_input_v1",
    validateOutput: (output) => output?.result_status === "assessment_ready",
})

function buildRegistry(handler) {
    return createSpecialistRegistry([
        {
            contract: CONTRACT,
            handler,
        },
    ])
}

function buildRepository({ reusable = null, active = null } = {}) {
    const calls = {
        findReusableRun: [],
        findActiveRun: [],
        insertRun: [],
        updateRun: [],
    }
    let storedActive = active

    return {
        calls,
        async findReusableRun(args) {
            calls.findReusableRun.push(args)
            return reusable
        },
        async findActiveRun(args) {
            calls.findActiveRun.push(args)
            return storedActive
        },
        async insertRun(run) {
            calls.insertRun.push(run)
            storedActive = {
                ...run,
                id: "run-1",
                updated_at: "2026-08-18T16:00:00.000Z",
            }
            return storedActive
        },
        async updateRun(args) {
            calls.updateRun.push(args)
            storedActive = {
                ...storedActive,
                ...args.patch,
                updated_at: "2026-08-18T16:00:01.000Z",
            }
            return storedActive
        },
    }
}

function coordinate({ repository, registry, force = false }) {
    return coordinateTomoSpecialist({
        intent: "document_verification_review",
        petId: "pet-1",
        workflowType: "verification_intelligence_review",
        contextFingerprint: "context-fingerprint",
        specialistInput: {
            schema_version: "fixture_input_v1",
            document_id: "document-1",
            candidate_fingerprint: "candidate-fingerprint",
            raw_text: "PRIVATE SOURCE TEXT THAT MUST NOT BE TRACED",
        },
        initialEvidenceIds: ["document-1"],
        repository,
        registry,
        tools: {},
        force,
        now: () => "2026-08-18T16:00:02.000Z",
    })
}

test("selects only allowlisted specialists", () => {
    assert.equal(
        selectSpecialistForIntent("document_verification_review"),
        "verification_intelligence"
    )
    assert.equal(
        selectSpecialistForIntent("home_medication_status"),
        "care_operations"
    )
    assert.equal(selectSpecialistForIntent("medical_judgment_boundary"), null)
    assert.equal(selectSpecialistForIntent("social_response"), null)
    assert.equal(selectSpecialistForIntent("unknown"), null)
})

test("returns no-specialist without creating an orchestration run", async () => {
    const result = await coordinateTomoSpecialist({
        intent: "medical_judgment_boundary",
    })

    assert.equal(result.status, "no_specialist")
    assert.equal(result.trace.manager.decision, "no_specialist")
    assert.equal(result.trace.evidence.count, 0)
})

test("checkpoints a successful specialist handoff and a safe trace", async () => {
    const repository = buildRepository()
    const registry = buildRegistry(async () => ({
        result_status: "assessment_ready",
        evidence_ids: ["document-1", "history-1"],
        pending_human_decision: "review_verification_assessment",
        human_control_boundary:
            "Rosa must review before trusted promotion.",
    }))
    const result = await coordinate({ repository, registry })

    assert.equal(result.status, "completed")
    assert.equal(result.trace.schema_version, TOMO_MANAGER_TRACE_VERSION)
    assert.equal(result.trace.manager.decision, "delegate")
    assert.equal(result.trace.specialist.name, "verification_intelligence")
    assert.equal(result.trace.evidence.count, 2)
    assert.equal(result.trace.pending_human_decision, "review_verification_assessment")
    assert.equal(repository.calls.insertRun.length, 1)
    assert.equal(repository.calls.updateRun.length, 1)
    assert.equal(repository.calls.updateRun[0].patch.status, "complete_no_action")

    const persisted = JSON.stringify(repository.calls)
    assert.doesNotMatch(persisted, /PRIVATE SOURCE TEXT/)
    assert.doesNotMatch(persisted, /raw_text/)
    assert.doesNotMatch(persisted, /prompt/i)
})

test("recovers a matching completed run without repeating specialist work", async () => {
    let specialistCalls = 0
    const reusableTrace = {
        schema_version: TOMO_MANAGER_TRACE_VERSION,
        manager: { decision: "delegate" },
        specialist: { name: "verification_intelligence", status: "completed" },
        evidence: { count: 1, ids: ["document-1"] },
        result_status: "assessment_ready",
    }
    const repository = buildRepository({
        reusable: {
            id: "run-existing",
            result_json: { safe_trace: reusableTrace },
        },
    })
    const registry = buildRegistry(async () => {
        specialistCalls += 1
        return { result_status: "assessment_ready" }
    })
    const result = await coordinate({ repository, registry })

    assert.equal(result.status, "recovered")
    assert.equal(result.trace.recovered, true)
    assert.equal(specialistCalls, 0)
    assert.equal(repository.calls.insertRun.length, 0)
})

test("recovers a concurrently created run instead of duplicating specialist work", async () => {
    let specialistCalls = 0
    let activeReads = 0
    const concurrentRun = {
        id: "run-concurrent",
        workflow_type: "verification_intelligence_review",
        workflow_version: 1,
        context_fingerprint: "context-fingerprint",
        updated_at: "2026-08-18T16:00:00.000Z",
    }
    const duplicateError = new Error("duplicate")
    duplicateError.code = "23505"
    const repository = {
        async findReusableRun() {
            return null
        },
        async findActiveRun() {
            activeReads += 1
            return activeReads === 1 ? null : concurrentRun
        },
        async insertRun() {
            throw duplicateError
        },
        async updateRun() {
            throw new Error("must not update")
        },
    }
    const registry = buildRegistry(async () => {
        specialistCalls += 1
        return { result_status: "assessment_ready" }
    })
    const result = await coordinate({ repository, registry })

    assert.equal(result.status, "in_progress")
    assert.equal(result.run, concurrentRun)
    assert.equal(result.trace.recovered, true)
    assert.equal(specialistCalls, 0)
})

test("persists a typed blocked run when permission enforcement stops a specialist", async () => {
    const repository = buildRepository()
    const registry = buildRegistry(async ({ tools }) => {
        await tools.call("promote_trusted_records", {})
        return { result_status: "assessment_ready" }
    })
    const result = await coordinate({ repository, registry })

    assert.equal(result.status, "failed")
    assert.equal(result.handoff.failure.type, "permission_denied")
    assert.equal(result.trace.result_status, "permission_denied")
    assert.equal(repository.calls.updateRun[0].patch.status, "blocked")
    assert.equal(repository.calls.updateRun[0].patch.external_action_taken, undefined)
})
