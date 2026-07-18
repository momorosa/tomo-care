-- Phase 3B: governed action ledger
--
-- care_actions stores action proposals and their lifecycle. It does not replace
-- trusted care events. An approved action may later create or update events
-- through the Express backend.

begin;

create table public.care_actions (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null,
    source_event_id uuid,

    action_type text not null,
    status text not null default 'proposed',
    request_source text not null,
    requested_by text not null,
    idempotency_key text not null,

    preview_json jsonb not null default '{}'::jsonb,
    payload_json jsonb not null default '{}'::jsonb,
    evidence_json jsonb not null default '[]'::jsonb,
    result_json jsonb,
    error_json jsonb,

    proposed_at timestamp with time zone not null default now(),
    approved_at timestamp with time zone,
    approved_by text,
    execution_started_at timestamp with time zone,
    executed_at timestamp with time zone,
    cancelled_at timestamp with time zone,

    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint care_actions_pet_id_fkey
        foreign key (pet_id) references public.pets(id),

    constraint care_actions_source_event_id_fkey
        foreign key (source_event_id) references public.events(id)
        on delete set null,

    constraint care_actions_status_check
        check (
            status in (
                'proposed',
                'approved',
                'executing',
                'succeeded',
                'failed',
                'cancelled'
            )
        ),

    constraint care_actions_request_source_check
        check (request_source in ('dashboard', 'assistant', 'system')),

    constraint care_actions_action_type_not_blank_check
        check (btrim(action_type) <> ''),

    constraint care_actions_requested_by_not_blank_check
        check (btrim(requested_by) <> ''),

    constraint care_actions_idempotency_key_not_blank_check
        check (btrim(idempotency_key) <> ''),

    constraint care_actions_preview_json_object_check
        check (jsonb_typeof(preview_json) = 'object'),

    constraint care_actions_payload_json_object_check
        check (jsonb_typeof(payload_json) = 'object'),

    constraint care_actions_evidence_json_array_check
        check (jsonb_typeof(evidence_json) = 'array'),

    constraint care_actions_result_json_object_check
        check (result_json is null or jsonb_typeof(result_json) = 'object'),

    constraint care_actions_error_json_object_check
        check (error_json is null or jsonb_typeof(error_json) = 'object')
);

-- Only one non-cancelled action may exist for a semantic operation. A
-- cancelled proposal can be prepared again later with the same key. Failed
-- actions retain the key so they are retried rather than duplicated.
create unique index care_actions_active_idempotency_key_idx
    on public.care_actions (idempotency_key)
    where status <> 'cancelled';

create index care_actions_pet_status_created_at_idx
    on public.care_actions (pet_id, status, created_at desc);

create index care_actions_source_event_id_idx
    on public.care_actions (source_event_id)
    where source_event_id is not null;

create trigger care_actions_set_updated_at
    before update on public.care_actions
    for each row
    execute function public.set_updated_at();

-- The browser should not read or mutate action state directly. TomoCare's
-- Express backend uses the Supabase service-role client and enforces the
-- prepare -> approve -> execute lifecycle.
alter table public.care_actions enable row level security;

comment on table public.care_actions is
    'Governed TomoCare action proposals, approvals, execution state, and results.';

commit;