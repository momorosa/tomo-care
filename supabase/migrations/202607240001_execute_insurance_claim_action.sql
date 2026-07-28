-- Phase 3B: atomic execution for mark_insurance_claim_filed
--
-- This function executes the approved insurance-claim plan in one
-- PostgreSQL transaction:
--   1. create a verified insurance claim submission event
--   2. complete the source reminder
--   3. mark the care action succeeded with an auditable result
--
-- It does not create another reminder or change Google Calendar. Any
-- exception rolls back every write, including the temporary transition to
-- executing. Only the Express backend's service-role client may invoke it.

begin;

create or replace function public.execute_mark_insurance_claim_filed(
    p_action_id uuid,
    p_executed_by text,
    p_care_date date
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_action public.care_actions%rowtype;
    v_source_reminder public.events%rowtype;
    v_source_document public.documents%rowtype;
    v_payload jsonb;
    v_source_reminder_id uuid;
    v_source_document_id uuid;
    v_claim_submission_event_id uuid;
    v_source_reminder_updated_at timestamp with time zone;
    v_treatment_date date;
    v_target_submit_date date;
    v_claim_deadline_date date;
    v_filed_date date;
    v_now timestamp with time zone := clock_timestamp();
    v_result jsonb;
begin
    if p_action_id is null then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: action id is required';
    end if;

    if p_executed_by is null or btrim(p_executed_by) = '' then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: execution actor is required';
    end if;

    if p_care_date is null then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: care date is required';
    end if;

    select *
      into v_action
      from public.care_actions
     where id = p_action_id
     for update;

    if not found then
        raise exception using
            errcode = 'P0002',
            message = 'action_not_found: the care action was not found';
    end if;

    if v_action.action_type <> 'mark_insurance_claim_filed' then
        raise exception using
            errcode = 'P0001',
            message = 'unsupported_action_type: execution is not implemented for this action type';
    end if;

    if v_action.status = 'succeeded' then
        return jsonb_build_object(
            'disposition', 'existing',
            'action_id', v_action.id,
            'status', v_action.status,
            'result', v_action.result_json
        );
    end if;

    if v_action.status <> 'approved' then
        raise exception using
            errcode = 'P0001',
            message = format(
                'action_not_approved: expected approved but found %s',
                v_action.status
            );
    end if;

    v_payload := v_action.payload_json;

    if coalesce(jsonb_typeof(v_payload), 'null') <> 'object'
       or v_payload ->> 'schema_version' <> '1'
       or v_payload ->> 'pet_id' is null
       or v_payload ->> 'source_reminder_id' is null
       or v_payload ->> 'source_reminder_updated_at' is null
       or v_payload ->> 'source_document_id' is null
       or v_payload ->> 'source_document_status' is null
       or v_payload ->> 'source_document_title' is null
       or v_payload ->> 'source_document_date' is null
       or v_payload ->> 'insurance_provider' is null
       or v_payload ->> 'treatment_date' is null
       or v_payload ->> 'target_submit_date' is null
       or v_payload ->> 'claim_deadline_date' is null
       or v_payload ->> 'filed_date' is null
       or v_payload ->> 'filed_by' is null
       or v_payload ->> 'source' is null then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: required execution fields are missing';
    end if;

    begin
        if (v_payload ->> 'pet_id')::uuid <> v_action.pet_id then
            raise exception using
                errcode = 'P0001',
                message = 'invalid_action_contract: pet identity does not match';
        end if;

        v_source_reminder_id :=
            (v_payload ->> 'source_reminder_id')::uuid;
        v_source_reminder_updated_at :=
            (v_payload ->> 'source_reminder_updated_at')::timestamp with time zone;
        v_source_document_id :=
            (v_payload ->> 'source_document_id')::uuid;
        v_treatment_date := (v_payload ->> 'treatment_date')::date;
        v_target_submit_date :=
            (v_payload ->> 'target_submit_date')::date;
        v_claim_deadline_date :=
            (v_payload ->> 'claim_deadline_date')::date;
        v_filed_date := (v_payload ->> 'filed_date')::date;
    exception
        when sqlstate 'P0001' then
            raise;
        when others then
            raise exception using
                errcode = 'P0001',
                message = 'invalid_action_contract: execution fields have invalid types';
    end;

    if v_source_reminder_id <> v_action.source_event_id then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: source reminder identity does not match';
    end if;

    if v_payload ->> 'source_document_status' <> 'verified'
       or v_payload ->> 'source' <> 'owner_confirmation'
       or btrim(v_payload ->> 'source_document_title') = ''
       or btrim(v_payload ->> 'insurance_provider') = ''
       or btrim(v_payload ->> 'filed_by') = '' then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: claim evidence fields are invalid';
    end if;

    if v_filed_date > p_care_date then
        raise exception using
            errcode = 'P0001',
            message = 'action_no_longer_eligible: claim filing date is in the future';
    end if;

    if v_filed_date < v_treatment_date
       or v_target_submit_date < v_treatment_date
       or v_claim_deadline_date < v_target_submit_date then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: claim dates are inconsistent';
    end if;

    if v_action.idempotency_key <> format(
        'mark_insurance_claim_filed:%s:%s:%s',
        v_action.pet_id,
        v_source_reminder_id,
        v_filed_date
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: idempotency key does not match the approved operation';
    end if;

    select *
      into v_source_reminder
      from public.events
     where id = v_source_reminder_id
       and pet_id = v_action.pet_id
     for update;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_missing: the trusted reminder no longer exists';
    end if;

    if v_source_reminder.event_type <> 'reminder'
       or v_source_reminder.status <> 'planned'
       or v_source_reminder.details_json ->> 'subtype' <> 'Insurance claim' then
        raise exception using
            errcode = 'P0001',
            message = 'action_no_longer_eligible: source event is no longer a planned insurance-claim reminder';
    end if;

    if v_source_reminder.updated_at <> v_source_reminder_updated_at then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: the trusted reminder changed after approval';
    end if;

    if (v_source_reminder.details_json ->> 'insurance_provider')
            is distinct from (v_payload ->> 'insurance_provider')
       or (v_source_reminder.details_json ->> 'treatment_date')::date
            is distinct from v_treatment_date
       or (v_source_reminder.details_json ->> 'target_submit_date')::date
            is distinct from v_target_submit_date
       or (v_source_reminder.details_json ->> 'claim_deadline_date')::date
            is distinct from v_claim_deadline_date
       or (
            v_source_reminder.doc_id is null
            and v_source_reminder.details_json ->> 'source_document_id' is null
       )
       or (
            v_source_reminder.doc_id is not null
            and v_source_reminder.doc_id <> v_source_document_id
       )
       or (
            v_source_reminder.details_json ->> 'source_document_id' is not null
            and (v_source_reminder.details_json ->> 'source_document_id')::uuid
                <> v_source_document_id
       ) then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: reminder evidence no longer matches the approved payload';
    end if;

    select *
      into v_source_document
      from public.documents
     where id = v_source_document_id
       and pet_id = v_action.pet_id
     for share;

    if not found or v_source_document.status <> 'verified' then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_missing: the verified source document no longer exists';
    end if;

    if v_source_document.title is distinct from
            (v_payload ->> 'source_document_title')
       or v_source_document.doc_date is distinct from
            (v_payload ->> 'source_document_date')::date
       or v_source_document.source_org is distinct from
            (v_payload ->> 'source_org')
       or v_source_document.doc_date is distinct from v_treatment_date then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: verified document evidence no longer matches the approved payload';
    end if;

    update public.care_actions
       set status = 'executing',
           execution_started_at = v_now,
           error_json = null
     where id = v_action.id;

    insert into public.events (
        pet_id,
        doc_id,
        event_type,
        event_date,
        status,
        details_json
    )
    values (
        v_action.pet_id,
        v_source_document_id,
        'insurance_claim_submission',
        v_filed_date,
        'verified',
        jsonb_strip_nulls(jsonb_build_object(
            'subtype', 'Insurance claim submission',
            'insurance_provider', v_payload ->> 'insurance_provider',
            'treatment_date', v_treatment_date,
            'target_submit_date', v_target_submit_date,
            'claim_deadline_date', v_claim_deadline_date,
            'filed_date', v_filed_date,
            'filed_by', v_payload ->> 'filed_by',
            'source', 'owner_confirmation',
            'source_document_id', v_source_document_id,
            'source_document_title', v_payload ->> 'source_document_title',
            'source_org', v_payload ->> 'source_org',
            'source_reminder_id', v_source_reminder.id,
            'care_action_id', v_action.id,
            'execution_actor', p_executed_by
        ))
    )
    returning id into v_claim_submission_event_id;

    update public.events
       set status = 'completed',
           details_json = details_json || jsonb_build_object(
               'completed_at', v_now,
               'completed_by', p_executed_by,
               'completion_action_id', v_action.id,
               'completion_reason', 'claim_filed',
               'claim_submission_event_id', v_claim_submission_event_id,
               'filed_date', v_filed_date,
               'filed_by', v_payload ->> 'filed_by'
           )
     where id = v_source_reminder.id;

    v_result := jsonb_build_object(
        'schema_version', 1,
        'execution_actor', p_executed_by,
        'claim_submission_event_id', v_claim_submission_event_id,
        'filed_date', v_filed_date,
        'completed_reminder_id', v_source_reminder.id,
        'source_document_id', v_source_document_id,
        'insurance_provider', v_payload ->> 'insurance_provider'
    );

    update public.care_actions
       set status = 'succeeded',
           executed_at = clock_timestamp(),
           result_json = v_result,
           error_json = null
     where id = v_action.id;

    return jsonb_build_object(
        'disposition', 'executed',
        'action_id', v_action.id,
        'status', 'succeeded',
        'result', v_result
    );
end;
$$;

revoke all on function public.execute_mark_insurance_claim_filed(uuid, text, date)
    from public;
revoke execute on function public.execute_mark_insurance_claim_filed(uuid, text, date)
    from anon, authenticated;
grant execute on function public.execute_mark_insurance_claim_filed(uuid, text, date)
    to service_role;

comment on function public.execute_mark_insurance_claim_filed(uuid, text, date) is
    'Atomically executes an approved mark_insurance_claim_filed care action.';

commit;