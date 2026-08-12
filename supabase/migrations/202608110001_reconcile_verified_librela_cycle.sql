-- Phase 3E.0b: atomic reconciliation for an already-verified Librela invoice.
--
-- The Express backend classifies the verified source evidence and requires a
-- human-reviewed preview. This function is the trusted transactional write
-- boundary. It:
--   1. preserves or creates the canonical verified Librela injection
--   2. completes prior planned Librela reminders only
--   3. preserves or creates exactly one reminder anchored to this injection
--   4. never deletes or rewrites appointments, insurance reminders, or costs
--
-- Any exception rolls back the entire reconciliation. Only the service-role
-- backend may invoke the function.

begin;

create unique index if not exists events_librela_reconciliation_key_unique
    on public.events ((details_json ->> 'reconciliation_key'))
    where event_type = 'reminder'
      and details_json ->> 'subtype' = 'Librela'
      and details_json ? 'reconciliation_key';

create or replace function public.reconcile_verified_librela_cycle(
    p_doc_id uuid,
    p_event_date date,
    p_verified_by text,
    p_requested_by text,
    p_evidence_source text,
    p_evidence_path text,
    p_classifier_version text,
    p_care_date date
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_document public.documents%rowtype;
    v_injection public.events%rowtype;
    v_target_reminder public.events%rowtype;
    v_now timestamp with time zone := clock_timestamp();
    v_due_date date;
    v_reminder_date date;
    v_reconciliation_key text;
    v_completed_count integer := 0;
    v_injection_created boolean := false;
    v_reminder_created boolean := false;
    v_disposition text;
begin
    if p_doc_id is null then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: document id is required';
    end if;

    if p_event_date is null then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: Librela event date is required';
    end if;

    if p_care_date is null then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: current care date is required';
    end if;

    if p_verified_by is null or btrim(p_verified_by) = '' then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: verification actor is required';
    end if;

    if p_requested_by is null or btrim(p_requested_by) = '' then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: request actor is required';
    end if;

    if p_evidence_source is null or btrim(p_evidence_source) = ''
       or p_evidence_path is null or btrim(p_evidence_path) = ''
       or p_classifier_version is null or btrim(p_classifier_version) = '' then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: verified evidence trace is required';
    end if;

    select *
      into v_document
      from public.documents
     where id = p_doc_id
     for update;

    if not found then
        raise exception using
            errcode = 'P0002',
            message = 'document_not_found: the source document was not found';
    end if;

    if v_document.status <> 'verified' then
        raise exception using
            errcode = 'P0001',
            message = 'source_not_verified: the source document is no longer verified';
    end if;

    -- Never let an older invoice replace the current cycle.
    if exists (
        select 1
          from public.events event
         where event.pet_id = v_document.pet_id
           and event.event_type = 'injection'
           and event.status = 'verified'
           and event.event_date > p_event_date
           and (
                lower(coalesce(event.details_json ->> 'subtype', '')) = 'librela'
                or lower(coalesce(event.details_json ->> 'medication', '')) = 'librela'
                or lower(coalesce(event.details_json ->> 'description', '')) like '%librela%'
           )
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'newer_verified_injection_exists: review the current care timeline';
    end if;

    select *
      into v_injection
      from public.events event
     where event.doc_id = v_document.id
       and event.pet_id = v_document.pet_id
       and event.event_type = 'injection'
       and event.event_date = p_event_date
       and event.status = 'verified'
       and (
            lower(coalesce(event.details_json ->> 'subtype', '')) = 'librela'
            or lower(coalesce(event.details_json ->> 'medication', '')) = 'librela'
            or lower(coalesce(event.details_json ->> 'description', '')) like '%librela%'
       )
     order by event.created_at asc
     limit 1
     for update;

    if not found then
        insert into public.events (
            pet_id,
            doc_id,
            event_type,
            event_date,
            status,
            details_json
        )
        values (
            v_document.pet_id,
            v_document.id,
            'injection',
            p_event_date,
            'verified',
            jsonb_build_object(
                'subtype', 'Librela',
                'medication', 'Librela',
                'description', 'Librela injection',
                'derived_from', p_evidence_source,
                'source_evidence_path', p_evidence_path,
                'classifier_version', p_classifier_version,
                'verified_at', v_now,
                'verified_by', p_verified_by,
                'reconciliation_version', 'librela_reconciliation_v1'
            )
        )
        returning * into v_injection;

        v_injection_created := true;
    end if;

    v_due_date := p_event_date + 49;
    v_reminder_date := v_due_date - 7;
    v_reconciliation_key := format(
        'librela_v1:%s:%s',
        v_document.id,
        p_event_date
    );

    select *
      into v_target_reminder
      from public.events event
     where event.pet_id = v_document.pet_id
       and event.event_type = 'reminder'
       and event.details_json ->> 'subtype' = 'Librela'
       and (
            event.details_json ->> 'reconciliation_key' = v_reconciliation_key
            or event.details_json ->> 'anchor_event_id' = v_injection.id::text
            or (
                event.details_json ->> 'source_document_id' = v_document.id::text
                and event.details_json ->> 'anchor_event_date' = p_event_date::text
            )
       )
     order by event.created_at asc
     limit 1
     for update;

    -- Complete only other active Librela reminders. Appointment rows and every
    -- other reminder subtype are outside this UPDATE by construction.
    update public.events event
       set status = 'completed',
           details_json = event.details_json || jsonb_build_object(
               'completed_at', v_now,
               'completed_by', p_requested_by,
               'completion_reason', 'superseded_by_verified_librela_injection',
               'completion_event_id', v_injection.id,
               'reconciliation_version', 'librela_reconciliation_v1'
           )
     where event.pet_id = v_document.pet_id
       and event.event_type = 'reminder'
       and event.status = 'planned'
       and event.details_json ->> 'subtype' = 'Librela'
       and (v_target_reminder.id is null or event.id <> v_target_reminder.id);

    get diagnostics v_completed_count = row_count;

    if v_target_reminder.id is null then
        insert into public.events (
            pet_id,
            doc_id,
            event_type,
            event_date,
            status,
            details_json
        )
        values (
            v_document.pet_id,
            v_document.id,
            'reminder',
            v_reminder_date,
            'planned',
            jsonb_build_object(
                'subtype', 'Librela',
                'action_type', 'create_librela_reminder',
                'target_event_type', 'injection',
                'target_subtype', 'Librela',
                'rule_version', 'librela_v1',
                'due_interval_days', 49,
                'remind_before_days', 7,
                'anchor_event_id', v_injection.id,
                'anchor_event_date', p_event_date,
                'due_date', v_due_date,
                'timing_state', case
                    when v_due_date < p_care_date then 'overdue'
                    when v_reminder_date < p_care_date then 'reminder_window_passed'
                    else 'upcoming'
                end,
                'source_document_id', v_document.id,
                'source_document_title', v_document.title,
                'source_org', v_document.source_org,
                'requested_by', p_requested_by,
                'requested_at', v_now,
                'created_from', 'librela_reconciliation',
                'calendar_sync_status', 'not_synced',
                'reconciliation_key', v_reconciliation_key,
                'reconciliation_version', 'librela_reconciliation_v1'
            )
        )
        returning * into v_target_reminder;

        v_reminder_created := true;
    else
        -- Preserve the row and any external Calendar references. Add only the
        -- canonical link and reconciliation trace when the target already exists.
        update public.events
           set event_date = case
                   when v_target_reminder.status = 'planned' then v_reminder_date
                   else v_target_reminder.event_date
               end,
               details_json = v_target_reminder.details_json || jsonb_build_object(
               'anchor_event_id', v_injection.id,
               'anchor_event_date', p_event_date,
               'due_date', v_due_date,
               'source_document_id', v_document.id,
               'reconciliation_key', v_reconciliation_key,
               'reconciliation_version', 'librela_reconciliation_v1',
               'timing_state', case
                   when v_due_date < p_care_date then 'overdue'
                   when v_reminder_date < p_care_date then 'reminder_window_passed'
                   else 'upcoming'
               end
           )
         where id = v_target_reminder.id
        returning * into v_target_reminder;
    end if;

    v_disposition := case
        when v_injection_created or v_reminder_created or v_completed_count > 0
            then 'reconciled'
        else 'existing'
    end;

    return jsonb_build_object(
        'schema_version', 1,
        'disposition', v_disposition,
        'reconciliation_version', 'librela_reconciliation_v1',
        'document_id', v_document.id,
        'injection_event_id', v_injection.id,
        'injection_event_created', v_injection_created,
        'anchor_event_date', p_event_date,
        'completed_prior_reminder_count', v_completed_count,
        'next_reminder_id', v_target_reminder.id,
        'next_reminder_created', v_reminder_created,
        'next_reminder_status', v_target_reminder.status,
        'next_reminder_date', v_reminder_date,
        'next_due_date', v_due_date,
        'timing_state', v_target_reminder.details_json ->> 'timing_state',
        'calendar_sync_status', coalesce(
            v_target_reminder.details_json ->> 'calendar_sync_status',
            'not_synced'
        )
    );
end;
$$;

revoke all on function public.reconcile_verified_librela_cycle(
    uuid, date, text, text, text, text, text, date
) from public;
revoke execute on function public.reconcile_verified_librela_cycle(
    uuid, date, text, text, text, text, text, date
) from anon, authenticated;
grant execute on function public.reconcile_verified_librela_cycle(
    uuid, date, text, text, text, text, text, date
) to service_role;

comment on function public.reconcile_verified_librela_cycle(
    uuid, date, text, text, text, text, text, date
) is 'Atomically repairs a verified Librela event and reconciles its reminder cycle.';

commit;
