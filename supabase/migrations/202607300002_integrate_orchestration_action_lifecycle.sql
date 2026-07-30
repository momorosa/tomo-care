-- Phase 3C.2C: governed action lifecycle integration
--
-- care_actions remains the authority for approval and execution. A linked
-- orchestration run is a projection of that ledger, updated in the same
-- database transaction whenever the governed action changes state.

begin;

alter table public.care_actions
    add column orchestration_run_id uuid;

alter table public.care_actions
    add constraint care_actions_orchestration_run_id_fkey
        foreign key (orchestration_run_id)
        references public.orchestration_runs(id);

alter table public.care_actions
    add constraint care_actions_orchestration_link_type_check
        check (
            orchestration_run_id is null or
            action_type = 'send_librela_appointment_request'
        );

create unique index care_actions_one_active_per_orchestration_run_idx
    on public.care_actions (orchestration_run_id)
    where orchestration_run_id is not null
      and status <> 'cancelled';

create index care_actions_orchestration_run_id_idx
    on public.care_actions (orchestration_run_id)
    where orchestration_run_id is not null;

alter table public.orchestration_runs
    add column external_action_status text not null default 'not_started';

alter table public.orchestration_runs
    add constraint orchestration_runs_external_action_status_check
        check (
            external_action_status in (
                'not_started',
                'not_sent',
                'in_progress',
                'mock_completed',
                'sent',
                'failed',
                'unknown'
            )
        );

alter table public.orchestration_runs
    drop constraint orchestration_runs_status_check;

alter table public.orchestration_runs
    add constraint orchestration_runs_status_check
        check (
            status in (
                'in_progress',
                'awaiting_human_review',
                'action_succeeded',
                'action_failed',
                'action_outcome_unknown',
                'blocked',
                'complete_no_action',
                'superseded'
            )
        );

alter table public.orchestration_runs
    drop constraint orchestration_runs_current_step_check;

alter table public.orchestration_runs
    add constraint orchestration_runs_current_step_check
        check (
            current_step in (
                'records',
                'care_planning',
                'communication',
                'human_review',
                'governed_action',
                'complete'
            )
        );

drop index public.orchestration_runs_one_active_workflow_idx;

create unique index orchestration_runs_one_active_workflow_idx
    on public.orchestration_runs (pet_id, workflow_type)
    where status in (
        'in_progress',
        'awaiting_human_review',
        'action_succeeded',
        'action_failed',
        'action_outcome_unknown'
    );

create or replace function public.sync_librela_orchestration_from_action()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_run public.orchestration_runs%rowtype;
    v_run_status text;
    v_current_step text;
    v_workflow_state text;
    v_current_owner text;
    v_pending_decision text;
    v_blocked_reason text;
    v_external_action_status text;
    v_external_action_taken boolean;
    v_delivery_status text;
    v_result_status text;
    v_completed_at timestamp with time zone;
    v_result jsonb;
begin
    if new.orchestration_run_id is null then
        return new;
    end if;

    if new.action_type <> 'send_librela_appointment_request' then
        raise exception using
            errcode = '23514',
            message = 'invalid_orchestration_link: only the Librela appointment request may link to this workflow';
    end if;

    select *
      into v_run
      from public.orchestration_runs
     where id = new.orchestration_run_id
     for update;

    if not found then
        raise exception using
            errcode = '23503',
            message = 'orchestration_run_not_found: the linked workflow does not exist';
    end if;

    if v_run.pet_id <> new.pet_id
       or v_run.workflow_type <> 'librela_appointment_request' then
        raise exception using
            errcode = '23514',
            message = 'invalid_orchestration_link: the workflow does not match this pet and action';
    end if;

    case new.status
        when 'proposed' then
            v_run_status := 'awaiting_human_review';
            v_current_step := 'human_review';
            v_workflow_state := 'awaiting_human_approval';
            v_current_owner := 'human';
            v_pending_decision := 'approve_or_edit_message';
            v_blocked_reason := null;
            v_external_action_status := 'not_sent';
            v_delivery_status := 'not_sent';
            v_result_status := 'action_proposed';
            v_completed_at := null;
        when 'approved' then
            v_run_status := 'awaiting_human_review';
            v_current_step := 'governed_action';
            v_workflow_state := 'approved_awaiting_execution';
            v_current_owner := 'coordinator';
            v_pending_decision := 'complete_approved_action';
            v_blocked_reason := null;
            v_external_action_status := 'not_sent';
            v_delivery_status := 'not_sent';
            v_result_status := 'action_approved';
            v_completed_at := null;
        when 'executing' then
            v_run_status := 'awaiting_human_review';
            v_current_step := 'governed_action';
            v_workflow_state := 'execution_in_progress';
            v_current_owner := 'coordinator';
            v_pending_decision := 'confirm_delivery_outcome';
            v_blocked_reason := null;
            v_external_action_status := 'in_progress';
            v_delivery_status := 'outcome_unknown';
            v_result_status := 'action_executing';
            v_completed_at := null;
        when 'succeeded' then
            v_run_status := 'action_succeeded';
            v_current_step := 'complete';
            v_workflow_state := 'complete';
            v_current_owner := 'coordinator';
            v_pending_decision := null;
            v_blocked_reason := null;
            v_external_action_status := case
                when new.result_json ->> 'provider_mode' = 'mock'
                    then 'mock_completed'
                else 'sent'
            end;
            v_delivery_status := coalesce(
                new.result_json ->> 'delivery_status',
                'sent'
            );
            v_result_status := 'action_succeeded';
            v_completed_at := coalesce(new.executed_at, clock_timestamp());
        when 'failed' then
            v_run_status := 'action_failed';
            v_current_step := 'governed_action';
            v_workflow_state := 'blocked';
            v_current_owner := 'human';
            v_pending_decision := 'review_delivery_failure';
            v_blocked_reason := coalesce(
                new.error_json ->> 'reason',
                'delivery_failed'
            );
            v_external_action_status := 'failed';
            v_delivery_status := 'failed';
            v_result_status := 'action_failed';
            v_completed_at := coalesce(new.executed_at, clock_timestamp());
        when 'outcome_unknown' then
            v_run_status := 'action_outcome_unknown';
            v_current_step := 'governed_action';
            v_workflow_state := 'blocked';
            v_current_owner := 'human';
            v_pending_decision := 'review_delivery_outcome';
            v_blocked_reason := coalesce(
                new.error_json ->> 'reason',
                'delivery_outcome_unknown'
            );
            v_external_action_status := 'unknown';
            v_delivery_status := 'outcome_unknown';
            v_result_status := 'action_outcome_unknown';
            v_completed_at := coalesce(new.executed_at, clock_timestamp());
        when 'cancelled' then
            v_run_status := 'awaiting_human_review';
            v_current_step := 'human_review';
            v_workflow_state := 'awaiting_human_review';
            v_current_owner := 'human';
            v_pending_decision := 'review_or_edit_message';
            v_blocked_reason := null;
            v_external_action_status := 'not_sent';
            v_delivery_status := 'not_sent';
            v_result_status := 'prepared';
            v_completed_at := null;
        else
            raise exception using
                errcode = '23514',
                message = 'invalid_action_status: unsupported governed action state';
    end case;

    v_external_action_taken :=
        new.status = 'succeeded'
        and new.result_json ->> 'delivery_status' = 'sent'
        and coalesce(new.result_json ->> 'provider_mode', '') <> 'mock';

    v_result := jsonb_set(
        jsonb_set(
            coalesce(v_run.result_json, '{}'::jsonb) ||
                jsonb_build_object(
                    'status', v_result_status,
                    'governed_action',
                    jsonb_build_object(
                        'id', new.id,
                        'status', new.status
                    )
                ),
            '{workflow}',
            coalesce(v_run.result_json -> 'workflow', '{}'::jsonb) ||
                jsonb_build_object(
                    'state', v_workflow_state,
                    'current_owner', v_current_owner,
                    'pending_decision', v_pending_decision,
                    'blocked_reason', v_blocked_reason,
                    'governed_action_id', new.id,
                    'governed_action_status', new.status,
                    'external_action_status', v_external_action_status,
                    'external_action_taken', v_external_action_taken
                ),
            true
        ),
        '{draft,delivery}',
        coalesce(
            v_run.result_json #> '{draft,delivery}',
            '{}'::jsonb
        ) ||
            jsonb_build_object(
                'status', v_delivery_status,
                'send_available', new.status = 'proposed'
            ),
        true
    );

    update public.orchestration_runs
       set status = v_run_status,
           current_step = v_current_step,
           pending_decision = v_pending_decision,
           blocked_reason = v_blocked_reason,
           result_json = v_result,
           external_action_taken = v_external_action_taken,
           external_action_status = v_external_action_status,
           completed_at = v_completed_at
     where id = v_run.id;

    return new;
end;
$$;

create trigger care_actions_sync_librela_orchestration
    after insert or update of
        orchestration_run_id,
        status,
        result_json,
        error_json,
        approved_at,
        execution_started_at,
        executed_at,
        cancelled_at
    on public.care_actions
    for each row
    when (new.orchestration_run_id is not null)
    execute function public.sync_librela_orchestration_from_action();

revoke all on function public.sync_librela_orchestration_from_action()
    from public;
revoke execute on function public.sync_librela_orchestration_from_action()
    from anon, authenticated;
grant execute on function public.sync_librela_orchestration_from_action()
    to service_role;

comment on column public.care_actions.orchestration_run_id is
    'Originating specialist workflow for this governed action.';

comment on column public.orchestration_runs.external_action_status is
    'Provider-neutral projection of whether an external action was attempted or confirmed.';

commit;
