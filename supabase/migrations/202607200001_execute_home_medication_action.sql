-- Phase 3B: atomic execution for mark_home_medication_given
--
-- This function is the trusted write boundary for the first governed action.
-- It executes the approved plan in one PostgreSQL transaction:
--   1. create a verified medication administration
--   2. complete the source reminder
--   3. create or update the next planned reminder
--   4. mark the care action succeeded with an auditable result
--
-- Any exception rolls back every change, including the temporary transition
-- to executing. Only the Express backend's service-role client may invoke it.

begin;

create or replace function public.execute_mark_home_medication_given(
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
    v_payload jsonb;
    v_source_reminder_id uuid;
    v_administration_event_id uuid;
    v_next_reminder_id uuid;
    v_next_reminder_candidate_ids uuid[];
    v_administered_date date;
    v_previous_administered_date date;
    v_next_due_date date;
    v_next_target_admin_date date;
    v_next_reminder_date date;
    v_cadence_days integer;
    v_reminder_days_before integer;
    v_preferred_weekday integer;
    v_now timestamp with time zone := clock_timestamp();
    v_next_details jsonb;
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

    if v_action.action_type <> 'mark_home_medication_given' then
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

    if jsonb_typeof(v_payload) <> 'object'
       or v_payload ->> 'schema_version' <> '1'
       or v_payload ->> 'source_reminder_id' is null
       or v_payload ->> 'source_reminder_updated_at' is null
       or v_payload ->> 'administered_date' is null
       or v_payload ->> 'next_due_date' is null
       or v_payload ->> 'next_target_admin_date' is null
       or v_payload ->> 'next_reminder_date' is null
       or v_payload ->> 'care_item' is null
       or v_payload ->> 'care_category' is null
       or v_payload ->> 'cadence_days' is null
       or v_payload ->> 'preferred_admin_day' is null
       or v_payload ->> 'reminder_days_before' is null then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: required execution fields are missing';
    end if;

    begin
        v_source_reminder_id := (v_payload ->> 'source_reminder_id')::uuid;
        v_administered_date := (v_payload ->> 'administered_date')::date;
        v_previous_administered_date :=
            (v_payload ->> 'previous_administered_date')::date;
        v_next_due_date := (v_payload ->> 'next_due_date')::date;
        v_next_target_admin_date :=
            (v_payload ->> 'next_target_admin_date')::date;
        v_next_reminder_date := (v_payload ->> 'next_reminder_date')::date;
        v_cadence_days := (v_payload ->> 'cadence_days')::integer;
        v_reminder_days_before :=
            (v_payload ->> 'reminder_days_before')::integer;
    exception
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

    if v_cadence_days <= 0 or v_reminder_days_before < 0 then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: scheduling intervals are invalid';
    end if;

    if v_administered_date > p_care_date then
        raise exception using
            errcode = 'P0001',
            message = 'action_no_longer_eligible: administration date is in the future';
    end if;

    if v_previous_administered_date is null
       or v_administered_date <= v_previous_administered_date then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: administration date does not follow the previous administration';
    end if;

    if v_next_due_date <> v_administered_date + v_cadence_days then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: next due date does not match the cadence';
    end if;

    v_preferred_weekday := case lower(v_payload ->> 'preferred_admin_day')
        when 'sunday' then 0
        when 'monday' then 1
        when 'tuesday' then 2
        when 'wednesday' then 3
        when 'thursday' then 4
        when 'friday' then 5
        when 'saturday' then 6
        else null
    end;

    if v_preferred_weekday is null
       or extract(dow from v_next_target_admin_date)::integer <>
            v_preferred_weekday
       or v_next_target_admin_date > v_next_due_date
       or (v_next_due_date - v_next_target_admin_date) >= 7 then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: target date does not match the preferred weekday rule';
    end if;

    if v_next_reminder_date <> v_next_target_admin_date - v_reminder_days_before
       or v_next_reminder_date < v_administered_date
       or v_next_reminder_date < p_care_date then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: next reminder date does not match the reminder rule';
    end if;

    if v_action.idempotency_key <> format(
        'mark_home_medication_given:%s:%s:%s',
        v_action.pet_id,
        v_source_reminder_id,
        v_administered_date
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
       or v_source_reminder.details_json ->> 'reminder_type' <> 'home_medication'
       or coalesce(
            (v_source_reminder.details_json ->> 'requires_appointment')::boolean,
            true
       ) <> false then
        raise exception using
            errcode = 'P0001',
            message = 'action_no_longer_eligible: source event is no longer a planned home-medication reminder';
    end if;

    if v_source_reminder.updated_at <>
       (v_payload ->> 'source_reminder_updated_at')::timestamp with time zone then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: the trusted reminder changed after approval';
    end if;

    if (v_source_reminder.details_json ->> 'care_item') is distinct from
            (v_payload ->> 'care_item')
       or (v_source_reminder.details_json ->> 'care_category') is distinct from
            (v_payload ->> 'care_category')
       or (v_source_reminder.details_json ->> 'cadence_days')::integer
            is distinct from v_cadence_days
       or (v_source_reminder.details_json ->> 'preferred_admin_day')
            is distinct from (v_payload ->> 'preferred_admin_day')
       or (v_source_reminder.details_json ->> 'reminder_days_before')::integer
            is distinct from v_reminder_days_before then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: scheduling evidence no longer matches the approved payload';
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
        null,
        'medication_administration',
        v_administered_date,
        'verified',
        jsonb_strip_nulls(jsonb_build_object(
            'care_item', v_payload ->> 'care_item',
            'care_category', v_payload ->> 'care_category',
            'cadence_days', v_cadence_days,
            'requires_appointment', false,
            'route', v_payload ->> 'route',
            'administered_by', v_payload ->> 'administered_by',
            'source', 'owner_confirmation',
            'preferred_admin_day', v_payload ->> 'preferred_admin_day',
            'reminder_days_before', v_reminder_days_before,
            'care_action_id', v_action.id,
            'execution_actor', p_executed_by
        ))
    )
    returning id into v_administration_event_id;

    update public.events
       set status = 'completed',
           details_json = details_json || jsonb_build_object(
               'completed_at', v_now,
               'completed_by', p_executed_by,
               'completion_action_id', v_action.id,
               'administration_event_id', v_administration_event_id
           )
     where id = v_source_reminder.id;

    select array_agg(candidate.id order by candidate.event_date, candidate.id)
      into v_next_reminder_candidate_ids
      from (
          select id, event_date
            from public.events
           where pet_id = v_action.pet_id
             and event_type = 'reminder'
             and status = 'planned'
             and details_json ->> 'reminder_type' = 'home_medication'
             and lower(details_json ->> 'care_item') =
                 lower(v_payload ->> 'care_item')
           order by event_date, id
           limit 2
           for update
      ) as candidate;

    if coalesce(cardinality(v_next_reminder_candidate_ids), 0) > 1 then
        raise exception using
            errcode = 'P0001',
            message = 'ambiguous_next_reminder: multiple planned reminders already exist';
    end if;

    v_next_details :=
        (
            v_source_reminder.details_json
            - 'external_refs'
            - 'completed_at'
            - 'completed_by'
            - 'completion_action_id'
            - 'administration_event_id'
        ) || jsonb_build_object(
            'last_administered_date', v_administered_date,
            'due_date', v_next_due_date,
            'target_admin_date', v_next_target_admin_date,
            'source', 'approved_action',
            'source_action_id', v_action.id,
            'created_from', 'mark_home_medication_given',
            'calendar_sync_status', 'not_synced',
            'timing_state', case
                when v_next_reminder_date <= p_care_date then 'due_now'
                else 'upcoming'
            end
        );

    if coalesce(cardinality(v_next_reminder_candidate_ids), 0) = 1 then
        v_next_reminder_id := v_next_reminder_candidate_ids[1];

        update public.events
           set doc_id = null,
               event_date = v_next_reminder_date,
               event_start = null,
               event_end = null,
               status = 'planned',
               details_json = v_next_details
         where id = v_next_reminder_id;
    else
        insert into public.events (
            pet_id,
            doc_id,
            event_type,
            event_date,
            event_start,
            event_end,
            status,
            details_json
        )
        values (
            v_action.pet_id,
            null,
            'reminder',
            v_next_reminder_date,
            null,
            null,
            'planned',
            v_next_details
        )
        returning id into v_next_reminder_id;
    end if;

    v_result := jsonb_build_object(
        'schema_version', 1,
        'execution_actor', p_executed_by,
        'administration_event_id', v_administration_event_id,
        'administration_date', v_administered_date,
        'completed_reminder_id', v_source_reminder.id,
        'next_reminder_id', v_next_reminder_id,
        'next_reminder_date', v_next_reminder_date,
        'next_target_admin_date', v_next_target_admin_date,
        'next_due_date', v_next_due_date
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

revoke all on function public.execute_mark_home_medication_given(uuid, text, date)
    from public;
revoke execute on function public.execute_mark_home_medication_given(uuid, text, date)
    from anon, authenticated;
grant execute on function public.execute_mark_home_medication_given(uuid, text, date)
    to service_role;

comment on function public.execute_mark_home_medication_given(uuid, text, date) is
    'Atomically executes an approved mark_home_medication_given care action.';

commit;