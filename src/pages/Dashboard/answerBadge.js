export function answerBadge(type) {
    const labels = {
        social_response: "Tomo", profile_summary: "Momo’s Profile", attention_summary: "Needs attention",
        message_draft_prepared: "Draft ready", action_prepared: "Ready to review", clarification_needed: "Needs details",
        action_request: "Approval required", grounded_answer: "Grounded answer", governed_action_status: "Action status",
        unsupported_question: "Not supported yet", no_trusted_data: "Missing verified data", safety_boundary: "Care boundary",
    }
    const label = Object.hasOwn(labels, type) ? labels[type] : "Needs attention"
    const warning = !["social_response", "profile_summary", "attention_summary", "message_draft_prepared", "action_prepared", "grounded_answer", "governed_action_status"].includes(type)
    return { label, warning }
}
