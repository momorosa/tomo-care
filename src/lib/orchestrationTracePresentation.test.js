import assert from "node:assert/strict"
import test from "node:test"

import { getOrchestrationTracePresentation } from "./orchestrationTracePresentation.js"

function buildTrace(overrides = {}) {
    return {
        schema_version: "tomo_manager_trace_v1",
        run_id: "private-run-id",
        manager: {
            name: "tomo_manager",
            version: 1,
            decision: "delegate",
        },
        specialist: {
            name: "care_operations",
            version: 1,
            status: "completed",
        },
        evidence: {
            count: 2,
            ids: ["private-reminder-id", "private-event-id"],
        },
        result_status: "action_prepared",
        pending_human_decision: "review_proposed_care_action",
        human_control_boundary: "untrusted raw boundary text",
        recovered: false,
        ...overrides,
    }
}

test("presents only the bounded Care Operations trace", () => {
    const presentation = getOrchestrationTracePresentation(buildTrace())

    assert.deepEqual(presentation, {
        managerLabel: "Tomo manager",
        decisionLabel: "Selected a bounded specialist",
        specialistLabel: "Care Operations",
        specialistVersion: 1,
        specialistStatusLabel: "Completed",
        delegated: true,
        evidenceLabel: "2 evidence references checked",
        resultLabel: "Proposal ready",
        resultTone: "success",
        humanControl:
            "Nothing changes until you review and approve the proposal.",
        recoveryLabel: null,
    })

    const visible = JSON.stringify(presentation)
    assert.doesNotMatch(visible, /private-run-id|private-reminder-id/)
    assert.doesNotMatch(visible, /untrusted raw boundary text/)
})

test("presents Verification Intelligence recovery without exposing identifiers", () => {
    const presentation = getOrchestrationTracePresentation(
        buildTrace({
            specialist: {
                name: "verification_intelligence",
                version: 1,
                status: "completed",
            },
            evidence: {
                count: 1,
                ids: ["private-document-id"],
            },
            result_status: "assessment_ready",
            pending_human_decision: "review_verification_assessment",
            recovered: true,
        })
    )

    assert.equal(
        presentation.specialistLabel,
        "Verification Intelligence"
    )
    assert.equal(presentation.evidenceLabel, "1 evidence reference checked")
    assert.equal(presentation.resultTone, "success")
    assert.equal(
        presentation.recoveryLabel,
        "Reused a matching completed run; specialist work was not repeated."
    )
    assert.doesNotMatch(JSON.stringify(presentation), /private-document-id/)
})

test("rejects malformed or unapproved trace shapes", () => {
    assert.equal(getOrchestrationTracePresentation(null), null)
    assert.equal(
        getOrchestrationTracePresentation(
            buildTrace({ schema_version: "future_trace_v2" })
        ),
        null
    )
    assert.equal(
        getOrchestrationTracePresentation(
            buildTrace({
                specialist: {
                    name: "unapproved_specialist",
                    version: 1,
                    status: "completed",
                },
            })
        ),
        null
    )
    assert.equal(
        getOrchestrationTracePresentation(
            buildTrace({ evidence: { count: 21, ids: [] } })
        ),
        null
    )
})
