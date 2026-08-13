-- Phase 3F.1: truthful human resolution of Apple Messages handoffs
--
-- The native Messages app provides no callback. These states record only what
-- Rosa explicitly reports after the handoff. They are not provider delivery,
-- receipt, clinic-response, or appointment-booking evidence.

begin;

alter table public.apple_messages_handoffs
    drop constraint apple_messages_handoffs_state_check;

alter table public.apple_messages_handoffs
    add constraint apple_messages_handoffs_state_check
        check (
            state in (
                'messages_handoff_requested',
                'user_reported_sent',
                'user_confirmed_not_sent'
            )
        );

alter table public.apple_messages_handoffs
    add column resolved_by text,
    add column resolved_at timestamp with time zone;

alter table public.apple_messages_handoffs
    add constraint apple_messages_handoffs_resolution_fields_check
        check (
            (
                state = 'messages_handoff_requested'
                and resolved_by is null
                and resolved_at is null
            )
            or (
                state in ('user_reported_sent', 'user_confirmed_not_sent')
                and resolved_by is not null
                and btrim(resolved_by) <> ''
                and resolved_at is not null
            )
        );

alter table public.orchestration_runs
    drop constraint orchestration_runs_external_action_status_check;

alter table public.orchestration_runs
    add constraint orchestration_runs_external_action_status_check
        check (
            external_action_status in (
                'not_started',
                'not_sent',
                'in_progress',
                'mock_completed',
                'sent',
                'user_reported_sent',
                'failed',
                'unknown'
            )
        );

create or replace function public.resolve_librela_apple_messages_handoff(
    p_action_id uuid,
    p_resolution text,
    p_resolved_by text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_action public.care_actions%rowtype;
    v_handoff public.apple_messages_handoffs%rowtype;
    v_target_state text;
    v_action_status text;
    v_now timestamp with time zone := clock_timestamp();
begin
    if p_action_id is null
       or p_resolution not in ('user_reported_sent', 'user_confirmed_not_sent')
       or p_resolved_by is null
       or btrim(p_resolved_by) = '' then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: action, resolution, and actor are required';
    end if;

    v_target_state := p_resolution;

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

    if v_action.action_type <> 'send_librela_appointment_request' then
        raise exception using
            errcode = 'P0001',
            message = 'unsupported_action_type: handoff resolution is not available for this action type';
    end if;

    select *
      into v_handoff
      from public.apple_messages_handoffs
     where care_action_id = v_action.id
     for update;

    if not found then
        raise exception using
            errcode = 'P0002',
            message = 'handoff_not_found: no Messages handoff exists for this action';
    end if;

    if v_handoff.state = v_target_state then
        return jsonb_build_object(
            'disposition', 'existing',
            'action_id', v_action.id,
            'action_status', v_action.status,
            'handoff_id', v_handoff.id,
            'state', v_handoff.state,
            'target_app', v_handoff.target_app,
            'contract_version', v_handoff.contract_version,
            'resolved_at', v_handoff.resolved_at
        );
    end if;

    if v_handoff.state <> 'messages_handoff_requested' then
        raise exception using
            errcode = 'P0001',
            message = 'handoff_resolution_conflict: this handoff already has a different human-reported resolution';
    end if;

    if v_action.status <> 'approved' then
        raise exception using
            errcode = 'P0001',
            message = format(
                'action_not_approved: expected approved but found %s',
                v_action.status
            );
    end if;

    update public.apple_messages_handoffs
       set state = v_target_state,
           resolved_by = p_resolved_by,
           resolved_at = v_now
     where id = v_handoff.id
     returning * into v_handoff;

    if v_target_state = 'user_reported_sent' then
        update public.care_actions
           set status = 'succeeded',
               executed_at = v_now,
               result_json = jsonb_build_object(
                   'schema_version', 1,
                   'delivery_status', 'user_reported_sent',
                   'provider_mode', 'native_handoff',
                   'target_app', 'apple_messages',
                   'handoff_id', v_handoff.id,
                   'reported_by', p_resolved_by,
                   'reported_at', v_now,
                   'delivery_verified', false,
                   'appointment_booked', false
               ),
               error_json = null
         where id = v_action.id
         returning status into v_action_status;

        update public.orchestration_runs
           set external_action_status = 'user_reported_sent',
               external_action_taken = false,
               result_json = jsonb_set(
                   jsonb_set(
                       coalesce(result_json, '{}'::jsonb) || jsonb_build_object(
                           'status', 'action_user_reported_sent'
                       ),
                       '{workflow,external_action_status}',
                       to_jsonb('user_reported_sent'::text),
                       true
                   ),
                   '{workflow,external_action_taken}',
                   'false'::jsonb,
                   true
               )
         where id = v_action.orchestration_run_id;
    else
        update public.care_actions
           set status = 'cancelled',
               cancelled_at = v_now,
               result_json = null,
               error_json = null
         where id = v_action.id
         returning status into v_action_status;
    end if;

    return jsonb_build_object(
        'disposition', 'resolved',
        'action_id', v_action.id,
        'action_status', v_action_status,
        'handoff_id', v_handoff.id,
        'state', v_handoff.state,
        'target_app', v_handoff.target_app,
        'contract_version', v_handoff.contract_version,
        'resolved_at', v_handoff.resolved_at
    );
end;
$$;

revoke all on function public.resolve_librela_apple_messages_handoff(
    uuid,
    text,
    text
) from public;
revoke execute on function public.resolve_librela_apple_messages_handoff(
    uuid,
    text,
    text
) from anon, authenticated;
grant execute on function public.resolve_librela_apple_messages_handoff(
    uuid,
    text,
    text
) to service_role;

comment on column public.apple_messages_handoffs.resolved_by is
    'Human who reported the native draft outcome; not provider evidence.';

comment on function public.resolve_librela_apple_messages_handoff(
    uuid,
    text,
    text
) is
    'Idempotently records Rosa-reported sent or confirmed-not-sent without claiming delivery, receipt, or booking.';

commit;
