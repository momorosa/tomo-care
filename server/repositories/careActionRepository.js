import { sbAdmin } from "../supabase.js"

const REMINDER_RETURN_COLUMNS =
    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"

const CARE_ACTION_RETURN_COLUMNS = [
    "id",
    "pet_id",
    "source_event_id",
    "action_type",
    "status",
    "request_source",
    "requested_by",
    "idempotency_key",
    "preview_json",
    "payload_json",
    "evidence_json",
    "proposed_at",
    "approved_at",
    "approved_by",
    "execution_started_at",
    "executed_at",
    "result_json",
    "error_json",
    "cancelled_at",
    "created_at",
    "updated_at",
].join(", ")

export const careActionRepository = {
    async findActionById(actionId) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .select(CARE_ACTION_RETURN_COLUMNS)
            .eq("id", actionId)
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async findReminder({ petId, reminderId }) {
        const { data, error } = await sbAdmin
            .from("events")
            .select(REMINDER_RETURN_COLUMNS)
            .eq("id", reminderId)
            .eq("pet_id", petId)
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async findActiveActionByIdempotencyKey(idempotencyKey) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .select(CARE_ACTION_RETURN_COLUMNS)
            .eq("idempotency_key", idempotencyKey)
            .neq("status", "cancelled")
            .limit(1)

        if (error) throw error
        return data?.[0] || null
    },

    async insertProposedAction(proposal) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .insert(proposal)
            .select(CARE_ACTION_RETURN_COLUMNS)
            .single()

        if (error) throw error
        return data
    },

    async approveProposedAction({
        actionId,
        approvedBy,
        approvedAt,
        expectedUpdatedAt,
    }) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .update({
                status: "approved",
                approved_by: approvedBy,
                approved_at: approvedAt,
            })
            .eq("id", actionId)
            .eq("status", "proposed")
            .eq("updated_at", expectedUpdatedAt)
            .select(CARE_ACTION_RETURN_COLUMNS)
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async cancelProposedAction({
        actionId,
        cancelledAt,
        expectedUpdatedAt,
    }) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .update({
                status: "cancelled",
                cancelled_at: cancelledAt,
            })
            .eq("id", actionId)
            .eq("status", "proposed")
            .eq("updated_at", expectedUpdatedAt)
            .select(CARE_ACTION_RETURN_COLUMNS)
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async executeMarkHomeMedicationGiven({ actionId, executedBy, careDate }) {
        const { data, error } = await sbAdmin.rpc(
            "execute_mark_home_medication_given",
            {
                p_action_id: actionId,
                p_executed_by: executedBy,
                p_care_date: careDate,
            }
        )

        if (error) throw error
        return data
    },
}
