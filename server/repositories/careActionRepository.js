import { sbAdmin } from "../supabase.js"

const REMINDER_RETURN_COLUMNS =
    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"

const VERIFIED_DOCUMENT_RETURN_COLUMNS =
    "id, pet_id, title, doc_type, doc_date, source_org, status"

const EVENT_RETURN_COLUMNS =
    "id, pet_id, doc_id, event_type, event_date, status, details_json, created_at, updated_at"

const PROVIDER_CONTACT_RETURN_COLUMNS = [
    "id",
    "organization_name",
    "channel",
    "address",
    "verification_status",
    "verification_source",
    "verified_by",
    "verified_at",
    "is_active",
    "created_at",
    "updated_at",
].join(", ")

const CARE_ACTION_RETURN_COLUMNS = [
    "id",
    "pet_id",
    "orchestration_run_id",
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

const ORCHESTRATION_RUN_VALIDATION_COLUMNS = [
    "id",
    "pet_id",
    "workflow_type",
    "status",
    "current_step",
    "result_json",
    "external_action_taken",
].join(", ")

const PENDING_CARE_ACTION_RETURN_COLUMNS = [
    "id",
    "source_event_id",
    "action_type",
    "status",
    "request_source",
    "preview_json",
    "proposed_at",
    "approved_at",
    "execution_started_at",
].join(", ")

const PENDING_CARE_ACTION_STATUSES = ["proposed", "approved", "executing"]

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

    async findPendingActionsByPetId(petId) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .select(PENDING_CARE_ACTION_RETURN_COLUMNS)
            .eq("pet_id", petId)
            .in("status", PENDING_CARE_ACTION_STATUSES)
            .order("proposed_at", { ascending: false })

        if (error) throw error
        return data || []
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

    async findVerifiedDocument({ petId, documentId }) {
        const { data, error } = await sbAdmin
            .from("documents")
            .select(VERIFIED_DOCUMENT_RETURN_COLUMNS)
            .eq("id", documentId)
            .eq("pet_id", petId)
            .eq("status", "verified")
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async findEvent({ petId, eventId }) {
        const { data, error } = await sbAdmin
            .from("events")
            .select(EVENT_RETURN_COLUMNS)
            .eq("id", eventId)
            .eq("pet_id", petId)
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async findOrchestrationRunById(orchestrationRunId) {
        const { data, error } = await sbAdmin
            .from("orchestration_runs")
            .select(ORCHESTRATION_RUN_VALIDATION_COLUMNS)
            .eq("id", orchestrationRunId)
            .maybeSingle()

        if (error) throw error
        return data || null
    },

    async findVerifiedProviderContacts({ organizationName, channel }) {
        const { data, error } = await sbAdmin
            .from("provider_contacts")
            .select(PROVIDER_CONTACT_RETURN_COLUMNS)
            .eq("organization_name", organizationName)
            .eq("channel", channel)
            .eq("verification_status", "verified")
            .eq("is_active", true)
            .limit(2)

        if (error) throw error
        return data || []
    },

    async findVerifiedProviderContactById(providerContactId) {
        const { data, error } = await sbAdmin
            .from("provider_contacts")
            .select(PROVIDER_CONTACT_RETURN_COLUMNS)
            .eq("id", providerContactId)
            .eq("verification_status", "verified")
            .eq("is_active", true)
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

    async linkActionToOrchestrationRun({
        actionId,
        orchestrationRunId,
    }) {
        const { data, error } = await sbAdmin
            .from("care_actions")
            .update({
                orchestration_run_id: orchestrationRunId,
            })
            .eq("id", actionId)
            .is("orchestration_run_id", null)
            .select(CARE_ACTION_RETURN_COLUMNS)
            .maybeSingle()

        if (error) throw error
        return data || null
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

    async executeMarkInsuranceClaimFiled({ actionId, executedBy, careDate }) {
        const { data, error } = await sbAdmin.rpc(
            "execute_mark_insurance_claim_filed",
            {
                p_action_id: actionId,
                p_executed_by: executedBy,
                p_care_date: careDate,
            }
        )

        if (error) throw error
        return data
    },

    async claimSendLibrelaAppointmentRequest({ actionId, executedBy }) {
        const { data, error } = await sbAdmin.rpc(
            "claim_send_librela_appointment_request",
            {
                p_action_id: actionId,
                p_executed_by: executedBy,
            }
        )

        if (error) throw error
        return data
    },

    async finalizeSendLibrelaAppointmentRequest({
        actionId,
        executedBy,
        deliveryStatus,
        result,
        error: errorJson,
    }) {
        const { data, error } = await sbAdmin.rpc(
            "finalize_send_librela_appointment_request",
            {
                p_action_id: actionId,
                p_executed_by: executedBy,
                p_delivery_status: deliveryStatus,
                p_result: result,
                p_error: errorJson,
            }
        )

        if (error) throw error
        return data
    },
}
