-- Phase 3C.2B: persisted orchestration workflow state and recovery
--
-- orchestration_runs checkpoints specialist handoffs before a governed care
-- action exists. care_actions remains the authority for proposal, approval,
-- execution, cancellation, and external delivery outcomes.

begin;

create table public.orchestration_runs (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null,

    workflow_type text not null,
    workflow_version integer not null default 1,
    status text not null default 'in_progress',
    current_step text not null default 'records',
    completed_roles text[] not null default '{}'::text[],
    pending_decision text,
    blocked_reason text,

    context_fingerprint text not null,
    state_json jsonb not null default '{}'::jsonb,
    result_json jsonb,
    external_action_taken boolean not null default false,

    recovery_count integer not null default 0,
    last_resumed_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint orchestration_runs_pet_id_fkey
        foreign key (pet_id) references public.pets(id),

    constraint orchestration_runs_status_check
        check (
            status in (
                'in_progress',
                'awaiting_human_review',
                'blocked',
                'complete_no_action',
                'superseded'
            )
        ),

    constraint orchestration_runs_current_step_check
        check (
            current_step in (
                'records',
                'care_planning',
                'communication',
                'human_review',
                'complete'
            )
        ),

    constraint orchestration_runs_workflow_type_not_blank_check
        check (btrim(workflow_type) <> ''),

    constraint orchestration_runs_context_fingerprint_not_blank_check
        check (btrim(context_fingerprint) <> ''),

    constraint orchestration_runs_workflow_version_check
        check (workflow_version > 0),

    constraint orchestration_runs_recovery_count_check
        check (recovery_count >= 0),

    constraint orchestration_runs_state_json_object_check
        check (jsonb_typeof(state_json) = 'object'),

    constraint orchestration_runs_result_json_object_check
        check (
            result_json is null or
            jsonb_typeof(result_json) = 'object'
        )
);

-- Rosa should see one active instance of a workflow for one pet. A trusted
-- context change supersedes that run before a new one is created.
create unique index orchestration_runs_one_active_workflow_idx
    on public.orchestration_runs (pet_id, workflow_type)
    where status in ('in_progress', 'awaiting_human_review');

create index orchestration_runs_pet_created_at_idx
    on public.orchestration_runs (pet_id, created_at desc);

create trigger orchestration_runs_set_updated_at
    before update on public.orchestration_runs
    for each row
    execute function public.set_updated_at();

-- The browser does not read or mutate orchestration checkpoints directly.
-- TomoCare's Express backend owns recovery and returns only the safe workflow
-- summary needed by the visible assistant experience.
alter table public.orchestration_runs enable row level security;

comment on table public.orchestration_runs is
    'Server-owned specialist workflow checkpoints and recovery state before governed action execution.';

commit;
