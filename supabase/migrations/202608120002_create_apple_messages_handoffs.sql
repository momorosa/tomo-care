-- Phase 3F: governed Apple Messages native handoff
--
-- This migration records only that TomoCare requested a native draft handoff.
-- It never records or implies send, delivery, receipt, or appointment status.
-- The recipient address and message body are returned only to the service-role
-- backend after one atomic fresh-state validation and are not persisted here.

begin;

create table public.apple_messages_handoffs (
    id uuid primary key default gen_random_uuid(),
    care_action_id uuid not null,
    provider_contact_id uuid not null,
    state text not null default 'messages_handoff_requested',
    target_app text not null default 'apple_messages',
    recipient_fingerprint_sha256 text not null,
    message_sha256 text not null,
    idempotency_key text not null,
    contract_version integer not null default 1,
    requested_by text not null,
    requested_at timestamp with time zone not null default now(),
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint apple_messages_handoffs_care_action_id_fkey
        foreign key (care_action_id) references public.care_actions(id),

    constraint apple_messages_handoffs_provider_contact_id_fkey
        foreign key (provider_contact_id) references public.provider_contacts(id),

    constraint apple_messages_handoffs_state_check
        check (state = 'messages_handoff_requested'),

    constraint apple_messages_handoffs_target_app_check
        check (target_app = 'apple_messages'),

    constraint apple_messages_handoffs_recipient_hash_check
        check (recipient_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),

    constraint apple_messages_handoffs_message_hash_check
        check (message_sha256 ~ '^[0-9a-f]{64}$'),

    constraint apple_messages_handoffs_idempotency_key_not_blank_check
        check (btrim(idempotency_key) <> ''),

    constraint apple_messages_handoffs_contract_version_check
        check (contract_version = 1),

    constraint apple_messages_handoffs_requested_by_not_blank_check
        check (btrim(requested_by) <> '')
);

create unique index apple_messages_handoffs_one_per_action_idx
    on public.apple_messages_handoffs (care_action_id);

create unique index apple_messages_handoffs_idempotency_key_idx
    on public.apple_messages_handoffs (idempotency_key);

create trigger apple_messages_handoffs_set_updated_at
    before update on public.apple_messages_handoffs
    for each row
    execute function public.set_updated_at();

alter table public.apple_messages_handoffs enable row level security;

create or replace function public.prepare_librela_apple_messages_handoff(
    p_action_id uuid,
    p_requested_by text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_action public.care_actions%rowtype;
    v_reminder public.events%rowtype;
    v_injection public.events%rowtype;
    v_recipient public.provider_contacts%rowtype;
    v_run public.orchestration_runs%rowtype;
    v_handoff public.apple_messages_handoffs%rowtype;
    v_payload jsonb;
    v_reminder_id uuid;
    v_injection_id uuid;
    v_recipient_id uuid;
    v_run_id uuid;
    v_reminder_updated_at timestamp with time zone;
    v_injection_updated_at timestamp with time zone;
    v_recipient_updated_at timestamp with time zone;
    v_due_date date;
    v_message_sha256 text;
    v_recipient_fingerprint text;
    v_handoff_idempotency_key text;
    v_disposition text;
begin
    if p_action_id is null
       or p_requested_by is null
       or btrim(p_requested_by) = '' then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: action id and request actor are required';
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

    if v_action.action_type <> 'send_librela_appointment_request' then
        raise exception using
            errcode = 'P0001',
            message = 'unsupported_action_type: native handoff is not available for this action type';
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
       or v_payload ->> 'injection_event_id' is null
       or v_payload ->> 'injection_event_updated_at' is null
       or v_payload ->> 'last_verified_injection_date' is null
       or v_payload ->> 'reminder_date' is null
       or v_payload ->> 'due_date' is null
       or v_payload ->> 'provider_contact_id' is null
       or v_payload ->> 'provider_contact_updated_at' is null
       or v_payload ->> 'recipient_name' is null
       or v_payload ->> 'recipient_channel' is null
       or v_payload ->> 'recipient_fingerprint_sha256' is null
       or v_payload ->> 'message_body' is null
       or v_payload ->> 'message_sha256' is null
       or v_payload ->> 'purpose' is null
       or v_action.orchestration_run_id is null then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: required handoff fields are missing';
    end if;

    begin
        if (v_payload ->> 'pet_id')::uuid <> v_action.pet_id then
            raise exception using
                errcode = 'P0001',
                message = 'invalid_action_contract: pet identity does not match';
        end if;

        v_reminder_id := (v_payload ->> 'source_reminder_id')::uuid;
        v_injection_id := (v_payload ->> 'injection_event_id')::uuid;
        v_recipient_id := (v_payload ->> 'provider_contact_id')::uuid;
        v_run_id := v_action.orchestration_run_id;
        v_reminder_updated_at :=
            (v_payload ->> 'source_reminder_updated_at')::timestamp with time zone;
        v_injection_updated_at :=
            (v_payload ->> 'injection_event_updated_at')::timestamp with time zone;
        v_recipient_updated_at :=
            (v_payload ->> 'provider_contact_updated_at')::timestamp with time zone;
        v_due_date := (v_payload ->> 'due_date')::date;
    exception
        when sqlstate 'P0001' then
            raise;
        when others then
            raise exception using
                errcode = 'P0001',
                message = 'invalid_action_contract: handoff fields have invalid types';
    end;

    v_message_sha256 := encode(
        extensions.digest(v_payload ->> 'message_body', 'sha256'),
        'hex'
    );

    if v_reminder_id <> v_action.source_event_id
       or v_payload ->> 'recipient_channel' <> 'sms'
       or v_payload ->> 'purpose' <> 'schedule_librela_injection'
       or btrim(v_payload ->> 'message_body') = ''
       or char_length(v_payload ->> 'message_body') > 1600
       or v_message_sha256 <> v_payload ->> 'message_sha256'
       or v_action.idempotency_key <> format(
            'send_librela_appointment_request:%s:%s:%s:%s',
            v_action.pet_id,
            v_reminder_id,
            v_recipient_id,
            v_message_sha256
       ) then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: approved message contract is inconsistent';
    end if;

    select *
      into v_reminder
      from public.events
     where id = v_reminder_id
       and pet_id = v_action.pet_id
     for share;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_missing: the Librela reminder no longer exists';
    end if;

    if v_reminder.event_type <> 'reminder'
       or v_reminder.status <> 'planned'
       or lower(concat_ws(
            ' ',
            v_reminder.details_json ->> 'subtype',
            v_reminder.details_json ->> 'target_subtype',
            v_reminder.details_json ->> 'medication',
            v_reminder.details_json ->> 'medication_name'
       )) not like '%librela%'
       or v_reminder.updated_at <> v_reminder_updated_at
       or v_reminder.event_date <> (v_payload ->> 'reminder_date')::date
       or (v_reminder.details_json ->> 'due_date')::date <> v_due_date then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: the Librela reminder changed after approval';
    end if;

    select *
      into v_injection
      from public.events
     where id = v_injection_id
       and pet_id = v_action.pet_id
     for share;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_missing: the verified Librela injection no longer exists';
    end if;

    if v_injection.event_type <> 'injection'
       or v_injection.status <> 'verified'
       or lower(concat_ws(
            ' ',
            v_injection.details_json ->> 'subtype',
            v_injection.details_json ->> 'medication',
            v_injection.details_json ->> 'medication_name'
       )) not like '%librela%'
       or v_injection.updated_at <> v_injection_updated_at
       or v_injection.event_date <>
            (v_payload ->> 'last_verified_injection_date')::date
       or (
            v_reminder.details_json ->> 'anchor_event_id' is not null
            and (v_reminder.details_json ->> 'anchor_event_id')::uuid
                <> v_injection.id
       ) then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: the verified Librela injection changed after approval';
    end if;

    select *
      into v_recipient
      from public.provider_contacts
     where id = v_recipient_id
     for share;

    if not found
       or v_recipient.is_active <> true
       or v_recipient.verification_status <> 'verified'
       or v_recipient.channel <> 'sms'
       or v_recipient.address !~ '^\+1[2-9][0-9]{9}$' then
        raise exception using
            errcode = 'P0001',
            message = 'recipient_not_verified: the clinic SMS recipient is not active and verified';
    end if;

    v_recipient_fingerprint := encode(
        extensions.digest(
            v_recipient.channel || ':' || v_recipient.address,
            'sha256'
        ),
        'hex'
    );

    if v_recipient.updated_at <> v_recipient_updated_at
       or v_recipient.organization_name <> v_payload ->> 'recipient_name'
       or lower(v_recipient.organization_name) <>
            lower(coalesce(
                v_reminder.details_json ->> 'source_org',
                v_reminder.details_json ->> 'provider_name'
            ))
       or v_recipient_fingerprint <>
            v_payload ->> 'recipient_fingerprint_sha256' then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: the clinic recipient changed after approval';
    end if;

    select *
      into v_run
      from public.orchestration_runs
     where id = v_run_id
     for share;

    if not found
       or v_run.pet_id <> v_action.pet_id
       or v_run.workflow_type <> 'librela_appointment_request'
       or v_run.status <> 'awaiting_human_review'
       or v_run.current_step <> 'governed_action'
       or v_run.external_action_taken <> false
       or v_run.external_action_status <> 'not_sent'
       or v_run.result_json #>> '{governed_action,id}' <> v_action.id::text
       or v_run.result_json #>> '{governed_action,status}' <> 'approved'
       or v_run.result_json #>> '{draft,evidence,reminder_event_id}' <>
            v_reminder_id::text
       or v_run.result_json #>> '{draft,evidence,injection_event_id}' <>
            v_injection_id::text then
        raise exception using
            errcode = 'P0001',
            message = 'orchestration_run_changed: the workflow no longer matches the approved request';
    end if;

    v_handoff_idempotency_key := format(
        'apple_messages_handoff:%s:%s:%s',
        v_action.id,
        v_recipient_fingerprint,
        v_message_sha256
    );

    insert into public.apple_messages_handoffs (
        care_action_id,
        provider_contact_id,
        state,
        target_app,
        recipient_fingerprint_sha256,
        message_sha256,
        idempotency_key,
        contract_version,
        requested_by
    )
    values (
        v_action.id,
        v_recipient.id,
        'messages_handoff_requested',
        'apple_messages',
        v_recipient_fingerprint,
        v_message_sha256,
        v_handoff_idempotency_key,
        1,
        p_requested_by
    )
    on conflict (care_action_id) do nothing
    returning * into v_handoff;

    if found then
        v_disposition := 'created';
    else
        select *
          into v_handoff
          from public.apple_messages_handoffs
         where care_action_id = v_action.id
         for share;

        v_disposition := 'existing';
    end if;

    if v_handoff.provider_contact_id <> v_recipient.id
       or v_handoff.state <> 'messages_handoff_requested'
       or v_handoff.target_app <> 'apple_messages'
       or v_handoff.recipient_fingerprint_sha256 <> v_recipient_fingerprint
       or v_handoff.message_sha256 <> v_message_sha256
       or v_handoff.idempotency_key <> v_handoff_idempotency_key
       or v_handoff.contract_version <> 1 then
        raise exception using
            errcode = 'P0001',
            message = 'handoff_contract_changed: the stored handoff no longer matches the approved request';
    end if;

    return jsonb_build_object(
        'disposition', v_disposition,
        'handoff_id', v_handoff.id,
        'state', v_handoff.state,
        'target_app', v_handoff.target_app,
        'contract_version', v_handoff.contract_version,
        'recipient_name', v_recipient.organization_name,
        'recipient_address', v_recipient.address,
        'message_body', v_payload ->> 'message_body'
    );
end;
$$;

revoke all on table public.apple_messages_handoffs
    from public, anon, authenticated;
grant all on table public.apple_messages_handoffs to service_role;

revoke all on function public.prepare_librela_apple_messages_handoff(uuid, text)
    from public;
revoke execute on function public.prepare_librela_apple_messages_handoff(uuid, text)
    from anon, authenticated;
grant execute on function public.prepare_librela_apple_messages_handoff(uuid, text)
    to service_role;

comment on table public.apple_messages_handoffs is
    'Idempotent record that TomoCare requested one Apple Messages draft handoff; not evidence of sending.';

comment on function public.prepare_librela_apple_messages_handoff(uuid, text) is
    'Atomically revalidates one approved Librela action and returns a private native-draft contract to the service-role backend.';

commit;
