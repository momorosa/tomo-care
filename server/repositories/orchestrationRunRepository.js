import { sbAdmin } from "../supabase.js"

const ORCHESTRATION_RUN_RETURN_COLUMNS = [
    "id",
    "pet_id",
    "workflow_type",
    "workflow_version",
    "status",
    "current_step",
    "completed_roles",
    "pending_decision",
    "blocked_reason",
    "context_fingerprint",
    "state_json",
    "result_json",
    "external_action_taken",
    "external_action_status",
    "recovery_count",
    "last_resumed_at",
    "completed_at",
    "created_at",
    "updated_at",
].join(", ")

const ACTIVE_STATUSES = [
    "in_progress",
    "awaiting_human_review",
    "action_succeeded",
    "action_failed",
    "action_outcome_unknown",
]

export const orchestrationRunRepository = {
    async findActiveRun({ petId, workflowType }) {
        const { data, error } = await sbAdmin
            .from("orchestration_runs")
            .select(ORCHESTRATION_RUN_RETURN_COLUMNS)
            .eq("pet_id", petId)
            .eq("workflow_type", workflowType)
            .in("status", ACTIVE_STATUSES)
            .order("created_at", { ascending: false })
            .limit(1)

        if (error) throw error
        return data?.[0] || null
    },

    async findRunById(runId) {
        const { data, error } = await sbAdmin
            .from("orchestration_runs")
            .select(ORCHESTRATION_RUN_RETURN_COLUMNS)
            .eq("id", runId)
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async insertRun(run) {
        const { data, error } = await sbAdmin
            .from("orchestration_runs")
            .insert(run)
            .select(ORCHESTRATION_RUN_RETURN_COLUMNS)
            .single()

        if (error) throw error
        return data
    },

    async updateRun({
        runId,
        expectedUpdatedAt,
        patch,
    }) {
        const { data, error } = await sbAdmin
            .from("orchestration_runs")
            .update(patch)
            .eq("id", runId)
            .eq("updated_at", expectedUpdatedAt)
            .select(ORCHESTRATION_RUN_RETURN_COLUMNS)
            .maybeSingle()

        if (error) throw error
        return data || null
    },
}
