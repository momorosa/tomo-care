-- Phase 3C.1A-1: trusted provider contacts and mock outbound execution
--
-- Outbound delivery has two database phases because the provider call cannot
-- run inside a PostgreSQL transaction:
--   1. claim_send_librela_appointment_request atomically validates the frozen
--      action and moves it from approved to executing
--   2. the server calls its mock provider exactly once
--   3. finalize_send_librela_appointment_request stores sent, failed, or
--      outcome_unknown without exposing the recipient address to the browser
--
-- An executing or outcome_unknown action is locked. A later request must not
-- contact the provider again automatically.

begin;

create table public.provider_contacts (
    id uuid primary key default gen_random_uuid(),
    organization_name text not null,
    channel text not null,
    address text not null,
    verification_status text not null default 'unverified',
    verification_source text not null,
    verified_by text,
    verified_at timestamp with time zone,
    is_active boolean not null default false,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint provider_contacts_organization_name_not_blank_check
        check (btrim(organization_name) <> ''),

    constraint provider_contacts_channel_check
        check (channel in ('sms')),

    constraint provider_contacts_address_not_blank_check
        check (btrim(address) <> ''),

    constraint provider_contacts_sms_address_format_check
        check (address ~ '^\+[1-9][0-9]{7,14}$'),

    constraint provider_contacts_verification_status_check
        check (verification_status in ('unverified', 'verified', 'revoked')),

    constraint provider_contacts_verification_source_not_blank_check
        check (btrim(verification_source) <> ''),

    constraint provider_contacts_verified_fields_check
        check (
            verification_status <> 'verified'
            or (
                verified_by is not null
                and btrim(verified_by) <> ''
                and verified_at is not null
            )
        ),

    constraint provider_contacts_active_requires_verified_check
        check (
            is_active = false
            or verification_status = 'verified'
        )
);

create unique index provider_contacts_one_active_channel_idx
    on public.provider_contacts (lower(organization_name), channel)
    where is_active = true and verification_status = 'verified';

create trigger provider_contacts_set_updated_at
    before update on public.provider_contacts
    for each row
    execute function public.set_updated_at();

alter table public.provider_contacts enable row level security;

comment on table public.provider_contacts is
    'Server-owned provider destinations with explicit human verification metadata.';

alter table public.care_actions
    drop constraint care_actions_status_check;

alter table public.care_actions
    add constraint care_actions_status_check
        check (
            status in (
                'proposed',
                'approved',
                'executing',
                'succeeded',
                'failed',
                'outcome_unknown',
                'cancelled'
            )
        );

create or replace function public.claim_send_librela_appointment_request(
    p_action_id uuid,
    p_executed_by text
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
    v_payload jsonb;
    v_reminder_id uuid;
    v_injection_id uuid;
    v_recipient_id uuid;
    v_reminder_updated_at timestamp with time zone;
    v_injection_updated_at timestamp with time zone;
    v_recipient_updated_at timestamp with time zone;
    v_due_date date;
    v_now timestamp with time zone := clock_timestamp();
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

    if v_action.status in ('executing', 'failed', 'outcome_unknown') then
        return jsonb_build_object(
            'disposition', 'locked',
            'action_id', v_action.id,
            'status', v_action.status,
            'result', v_action.result_json,
            'error', v_action.error_json
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
       or v_payload ->> 'purpose' is null then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: required outbound fields are missing';
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
                message = 'invalid_action_contract: outbound fields have invalid types';
    end;

    if v_reminder_id <> v_action.source_event_id
       or v_payload ->> 'recipient_channel' <> 'sms'
       or v_payload ->> 'purpose' <> 'schedule_librela_injection'
       or btrim(v_payload ->> 'message_body') = ''
       or char_length(v_payload ->> 'message_body') > 1600
       or char_length(v_payload ->> 'message_sha256') <> 64
       or char_length(v_payload ->> 'recipient_fingerprint_sha256') <> 64 then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: outbound contract is inconsistent';
    end if;

    if v_action.idempotency_key <> format(
        'send_librela_appointment_request:%s:%s:%s:%s',
        v_action.pet_id,
        v_reminder_id,
        v_recipient_id,
        v_payload ->> 'message_sha256'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_action_contract: idempotency key does not match the approved message';
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
       or v_reminder.event_date <>
            (v_payload ->> 'reminder_date')::date
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
       or v_recipient.channel <> 'sms' then
        raise exception using
            errcode = 'P0001',
            message = 'recipient_not_verified: the clinic SMS recipient is not active and verified';
    end if;

    if v_recipient.updated_at <> v_recipient_updated_at
       or v_recipient.organization_name <>
            (v_payload ->> 'recipient_name')
       or lower(v_recipient.organization_name) <>
            lower(coalesce(
                v_reminder.details_json ->> 'source_org',
                v_reminder.details_json ->> 'provider_name'
            )) then
        raise exception using
            errcode = 'P0001',
            message = 'source_evidence_changed: the clinic recipient changed after approval';
    end if;

    update public.care_actions
       set status = 'executing',
           execution_started_at = v_now,
           result_json = null,
           error_json = null
     where id = v_action.id;

    return jsonb_build_object(
        'disposition', 'claimed',
        'action_id', v_action.id,
        'status', 'executing',
        'delivery', jsonb_build_object(
            'recipient_address', v_recipient.address,
            'recipient_name', v_recipient.organization_name,
            'provider_contact_id', v_recipient.id,
            'message_body', v_payload ->> 'message_body',
            'message_sha256', v_payload ->> 'message_sha256',
            'idempotency_key', v_action.idempotency_key
        )
    );
end;
$$;

create or replace function public.finalize_send_librela_appointment_request(
    p_action_id uuid,
    p_executed_by text,
    p_delivery_status text,
    p_result jsonb,
    p_error jsonb default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_action public.care_actions%rowtype;
    v_final_status text;
begin
    if p_action_id is null
       or p_executed_by is null
       or btrim(p_executed_by) = ''
       or p_delivery_status not in ('sent', 'failed', 'outcome_unknown')
       or coalesce(jsonb_typeof(p_result), 'null') <> 'object'
       or p_result ->> 'delivery_status' <> p_delivery_status
       or (p_error is not null and jsonb_typeof(p_error) <> 'object') then
        raise exception using
            errcode = '22023',
            message = 'invalid_request: final delivery result is incomplete';
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
            message = 'unsupported_action_type: finalization is not implemented for this action type';
    end if;

    if v_action.status in ('succeeded', 'failed', 'outcome_unknown') then
        return jsonb_build_object(
            'disposition', 'existing',
            'action_id', v_action.id,
            'status', v_action.status,
            'result', v_action.result_json,
            'error', v_action.error_json
        );
    end if;

    if v_action.status <> 'executing' then
        raise exception using
            errcode = 'P0001',
            message = format(
                'invalid_action_state: expected executing but found %s',
                v_action.status
            );
    end if;

    v_final_status := case p_delivery_status
        when 'sent' then 'succeeded'
        when 'failed' then 'failed'
        else 'outcome_unknown'
    end;

    update public.care_actions
       set status = v_final_status,
           executed_at = clock_timestamp(),
           result_json = p_result,
           error_json = case
               when p_delivery_status = 'sent' then null
               else p_error
           end
     where id = v_action.id;

    return jsonb_build_object(
        'disposition', 'executed',
        'action_id', v_action.id,
        'status', v_final_status,
        'result', p_result,
        'error', case
            when p_delivery_status = 'sent' then null
            else p_error
        end
    );
end;
$$;

revoke all on table public.provider_contacts from public, anon, authenticated;
grant all on table public.provider_contacts to service_role;

revoke all on function public.claim_send_librela_appointment_request(uuid, text)
    from public;
revoke execute on function public.claim_send_librela_appointment_request(uuid, text)
    from anon, authenticated;
grant execute on function public.claim_send_librela_appointment_request(uuid, text)
    to service_role;

revoke all on function public.finalize_send_librela_appointment_request(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) from public;
revoke execute on function public.finalize_send_librela_appointment_request(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) from anon, authenticated;
grant execute on function public.finalize_send_librela_appointment_request(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) to service_role;

comment on function public.claim_send_librela_appointment_request(uuid, text) is
    'Atomically validates and claims one approved outbound Librela request before provider contact.';

comment on function public.finalize_send_librela_appointment_request(
    uuid,
    text,
    text,
    jsonb,
    jsonb
) is
    'Persists the terminal sent, failed, or outcome_unknown result for a claimed outbound request.';

commit;