const TRACE_SCHEMA_VERSION = "tomo_manager_trace_v1"

const SPECIALIST_LABELS = Object.freeze({
    verification_intelligence: "Verification Intelligence",
    care_operations: "Care Operations",
})

const SPECIALIST_STATUS_LABELS = Object.freeze({
    completed: "Completed",
    failed: "Could not complete",
    in_progress: "In progress",
})

const RESULT_LABELS = Object.freeze({
    assessment_ready: "Assessment ready",
    answer_only: "Answer only",
    clarification_required: "Needs details",
    action_prepared: "Proposal ready",
    action_already_prepared: "Existing proposal found",
    existing_action_requires_review: "Existing review required",
    reminder_not_found: "Reminder not found",
    multiple_reminders: "Reminder review required",
    not_eligible: "No action prepared",
    timeout: "Specialist timed out",
    unavailable: "Specialist unavailable",
    malformed_result: "Result unavailable",
    stale_evidence: "Evidence changed",
    partial_result: "Incomplete result",
    permission_denied: "Permission blocked",
    in_progress: "Still working",
    handled_without_specialist: "Handled by Tomo",
})

const RESULT_TONES = Object.freeze({
    assessment_ready: "success",
    answer_only: "success",
    action_prepared: "success",
    action_already_prepared: "success",
    existing_action_requires_review: "warning",
    clarification_required: "warning",
    reminder_not_found: "warning",
    multiple_reminders: "warning",
    not_eligible: "neutral",
    timeout: "warning",
    unavailable: "warning",
    malformed_result: "warning",
    stale_evidence: "warning",
    partial_result: "warning",
    permission_denied: "warning",
    in_progress: "neutral",
    handled_without_specialist: "neutral",
})

const HUMAN_CONTROL_LABELS = Object.freeze({
    review_verification_assessment:
        "You decide whether this assessment can move into verified records.",
    clarify_home_medication_statement:
        "Nothing changes until you provide the missing medication detail.",
    review_proposed_care_action:
        "Nothing changes until you review and approve the proposal.",
    review_existing_care_action:
        "Review the existing proposal before preparing another.",
    review_home_medication_reminders:
        "Review the active reminders before a medication update can be prepared.",
    review_home_medication_request:
        "Review or clarify the medication request before anything changes.",
    retry_after_current_review:
        "The current review must finish before Tomo retries.",
    retry_review:
        "Nothing changed. You can retry the specialist review.",
    rerun_current_review:
        "The evidence changed. Run the current review again before continuing.",
    review_manually:
        "Nothing changed. Continue with manual review.",
})

const RESULT_CONTROL_LABELS = Object.freeze({
    answer_only:
        "The specialist read bounded care evidence only; no care action was prepared.",
    handled_without_specialist:
        "No specialist or consequential action was needed.",
    clarification_required:
        "Nothing changes until the missing detail is clear.",
    assessment_ready:
        "The assessment remains review-only until you verify it.",
})

export function getOrchestrationTracePresentation(trace) {
    if (
        !trace ||
        typeof trace !== "object" ||
        trace.schema_version !== TRACE_SCHEMA_VERSION
    ) {
        return null
    }

    const decision = trace.manager?.decision
    if (decision !== "delegate" && decision !== "no_specialist") {
        return null
    }

    const specialistName = trace.specialist?.name || null
    if (
        decision === "delegate" &&
        !Object.hasOwn(SPECIALIST_LABELS, specialistName)
    ) {
        return null
    }

    if (decision === "no_specialist" && specialistName) return null

    const evidenceCount = trace.evidence?.count
    if (
        !Number.isInteger(evidenceCount) ||
        evidenceCount < 0 ||
        evidenceCount > 20
    ) {
        return null
    }

    const resultLabel =
        RESULT_LABELS[trace.result_status] || "Completed safely"
    const pendingDecision = trace.pending_human_decision || null
    const humanControl =
        HUMAN_CONTROL_LABELS[pendingDecision] ||
        RESULT_CONTROL_LABELS[trace.result_status] ||
        "Tomo did not bypass an established review or approval boundary."
    const specialistVersion = Number.isInteger(
        trace.specialist?.version
    )
        ? trace.specialist.version
        : null

    return {
        managerLabel: "Tomo manager",
        decisionLabel:
            decision === "delegate"
                ? "Selected a bounded specialist"
                : "Handled without a specialist",
        specialistLabel: specialistName
            ? SPECIALIST_LABELS[specialistName]
            : "No specialist needed",
        specialistVersion,
        specialistStatusLabel: specialistName
            ? SPECIALIST_STATUS_LABELS[trace.specialist?.status] ||
              "Status available"
            : null,
        delegated: decision === "delegate",
        evidenceLabel: `${evidenceCount} evidence reference${
            evidenceCount === 1 ? "" : "s"
        } checked`,
        resultLabel,
        resultTone: RESULT_TONES[trace.result_status] || "neutral",
        humanControl,
        recoveryLabel:
            trace.recovered === true
                ? "Reused a matching completed run; specialist work was not repeated."
                : null,
    }
}
