import { sbAdmin } from "../supabase.js"

const REMINDER_COLUMNS = [
    "id",
    "pet_id",
    "doc_id",
    "event_type",
    "event_date",
    "status",
    "details_json",
    "created_at",
    "updated_at",
].join(", ")

const CARE_ACTION_COLUMNS = [
    "id",
    "pet_id",
    "source_event_id",
    "action_type",
    "status",
    "preview_json",
    "proposed_at",
    "approved_at",
    "execution_started_at",
    "created_at",
    "updated_at",
].join(", ")

const REVIEW_DOCUMENT_COLUMNS = [
    "id",
    "pet_id",
    "title",
    "doc_type",
    "doc_date",
    "source_org",
    "status",
    "created_at",
    "updated_at",
].join(", ")

const ATTENTION_ACTION_STATUSES = [
    "proposed",
    "approved",
    "executing",
    "outcome_unknown",
]

export const attentionRepository = {
    async findPlannedRemindersByPetId(petId) {
        const { data, error } = await sbAdmin
            .from("events")
            .select(REMINDER_COLUMNS)
            .eq("pet_id", petId)
            .eq("event_type", "reminder")
            .eq("status", "planned")
            .order("event_date", { ascending: true })

        if (error) throw error
        return data || []
    },

    async findAttentionCareActionsByPetId(petId) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .select(CARE_ACTION_COLUMNS)
            .eq("pet_id", petId)
            .in("status", ATTENTION_ACTION_STATUSES)
            .order("proposed_at", { ascending: true })

        if (error) throw error
        return data || []
    },

    async findReviewDocumentsByPetId(petId) {
        const { data, error } = await sbAdmin
            .from("documents")
            .select(REVIEW_DOCUMENT_COLUMNS)
            .eq("pet_id", petId)
            .eq("status", "needs_review")
            .order("created_at", { ascending: true })

        if (error) throw error
        return data || []
    },
}
