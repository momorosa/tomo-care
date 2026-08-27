-- Phase 3E.7a: materialize reviewed Rabies evidence without conflating
-- administration, clinic-reported next due, or product/vial expiration.

create unique index if not exists events_one_verified_vaccine_per_document_item_idx
    on public.events (doc_id, (lower(details_json ->> 'care_item')))
    where event_type = 'vaccine'
      and status = 'verified'
      and doc_id is not null;

create unique index if not exists facts_one_verified_preventive_status_per_pet_item_idx
    on public.facts (pet_id, (lower(value_json ->> 'care_item')))
    where fact_type = 'preventive_care_status'
      and status = 'verified';

create or replace function public.materialize_verified_vaccine_evidence(
    p_doc_id uuid,
    p_evidence jsonb,
    p_verified_by text default 'rosa'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_doc public.documents%rowtype;
    v_assertion jsonb;
    v_assertion_type text;
    v_source_type text;
    v_admin_date date;
    v_admin_context text;
    v_next_due date;
    v_due_context text;
    v_status text;
    v_status_date date;
    v_status_context text;
    v_existing_event public.events%rowtype;
    v_event public.events%rowtype;
    v_existing_fact public.facts%rowtype;
    v_fact public.facts%rowtype;
    v_source_ids jsonb;
    v_evidence_types jsonb;
    v_value_json jsonb;
    v_now timestamptz := now();
begin
    select * into v_doc
      from public.documents
     where id = p_doc_id
     for update;

    if not found then
        raise exception 'Document not found';
    end if;
    if v_doc.status <> 'verified' then
        raise exception 'Document must be verified before materializing vaccine evidence';
    end if;
    if p_evidence is null or jsonb_typeof(p_evidence) <> 'object' then
        raise exception 'Structured vaccine evidence is required';
    end if;
    if coalesce((p_evidence ->> 'schema_version')::integer, 0) <> 1
       or lower(coalesce(p_evidence ->> 'care_kind', '')) <> 'vaccine'
       or lower(coalesce(p_evidence ->> 'care_item', '')) <> 'rabies' then
        raise exception 'Phase 3E.7a only supports Rabies vaccine evidence schema version 1';
    end if;

    v_source_type := lower(coalesce(p_evidence ->> 'source_record_type', ''));
    if v_source_type not in ('vaccination_certificate', 'receipt') then
        raise exception 'Unsupported vaccine evidence source type';
    end if;
    if jsonb_typeof(p_evidence -> 'assertions') <> 'array'
       or jsonb_array_length(p_evidence -> 'assertions') = 0 then
        raise exception 'At least one vaccine assertion is required';
    end if;
    if (
        select count(*) <> count(distinct value ->> 'assertion_type')
          from jsonb_array_elements(p_evidence -> 'assertions')
    ) then
        raise exception 'Each vaccine assertion type may appear only once';
    end if;

    for v_assertion in select value from jsonb_array_elements(p_evidence -> 'assertions')
    loop
        v_assertion_type := lower(coalesce(v_assertion ->> 'assertion_type', ''));

        if v_assertion_type = 'administration' then
            if v_source_type <> 'vaccination_certificate'
               or v_assertion ->> 'date_meaning' <> 'administered_on'
               or coalesce(v_assertion ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
                raise exception 'Only a certificate may establish a Rabies administration date';
            end if;
            v_admin_date := (v_assertion ->> 'date')::date;
            v_admin_context := left(v_assertion ->> 'source_context', 500);
        elsif v_assertion_type = 'next_due' then
            if v_assertion ->> 'date_meaning' <> 'clinic_reported_next_due'
               or coalesce(v_assertion ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
                raise exception 'Clinic-reported next due is invalid';
            end if;
            v_next_due := (v_assertion ->> 'date')::date;
            v_due_context := left(v_assertion ->> 'source_context', 500);
        elsif v_assertion_type = 'clinic_reported_status' then
            v_status := lower(coalesce(v_assertion ->> 'status', ''));
            if v_status not in ('current', 'due', 'overdue', 'unknown') then
                raise exception 'Clinic-reported status is invalid';
            end if;
            if coalesce(v_assertion ->> 'as_of_date', '') <> '' then
                if (v_assertion ->> 'as_of_date') !~ '^\d{4}-\d{2}-\d{2}$' then
                    raise exception 'Clinic-reported status date is invalid';
                end if;
                v_status_date := (v_assertion ->> 'as_of_date')::date;
            end if;
            v_status_context := left(v_assertion ->> 'source_context', 500);
        else
            raise exception 'Unsupported vaccine assertion type';
        end if;
    end loop;

    if v_admin_date is not null
       and v_next_due is not null
       and v_next_due < v_admin_date then
        raise exception 'Clinic-reported next due cannot predate administration';
    end if;

    if coalesce(p_evidence #>> '{product_details,product_expiration_date}', '') <> '' then
        if (p_evidence #>> '{product_details,product_expiration_date}') !~ '^\d{4}-\d{2}-\d{2}$' then
            raise exception 'Product expiration date is invalid';
        end if;
        perform (p_evidence #>> '{product_details,product_expiration_date}')::date;
    end if;

    if v_admin_date is not null then
        select * into v_existing_event
          from public.events
         where doc_id = v_doc.id
           and event_type = 'vaccine'
           and status = 'verified'
           and lower(coalesce(details_json ->> 'care_item', '')) = 'rabies'
         limit 1
         for update;

        if found and v_existing_event.event_date <> v_admin_date then
            raise exception 'Conflicting Rabies administration date for this certificate';
        elsif found then
            v_event := v_existing_event;
        else
            insert into public.events (
                pet_id, doc_id, event_type, event_date, status, details_json
            ) values (
                v_doc.pet_id,
                v_doc.id,
                'vaccine',
                v_admin_date,
                'verified',
                jsonb_strip_nulls(jsonb_build_object(
                    'care_kind', 'vaccine',
                    'care_item', 'rabies',
                    'description', 'Rabies vaccine administration',
                    'evidence_type', 'official_vaccination_certificate',
                    'source_record_type', v_source_type,
                    'source_context', v_admin_context,
                    'product_name', p_evidence #>> '{product_details,product_name}',
                    'manufacturer', p_evidence #>> '{product_details,manufacturer}',
                    'batch_number', p_evidence #>> '{product_details,batch_number}',
                    'product_expiration_date', p_evidence #>> '{product_details,product_expiration_date}',
                    'verified_at', v_now,
                    'verified_by', p_verified_by,
                    'schema_version', 1,
                    'rule_version', 'verified_vaccine_evidence_v1'
                ))
            ) returning * into v_event;
        end if;
    end if;

    if v_next_due is not null or v_status is not null then
        select * into v_existing_fact
          from public.facts
         where pet_id = v_doc.pet_id
           and fact_type = 'preventive_care_status'
           and status = 'verified'
           and lower(coalesce(value_json ->> 'care_item', '')) = 'rabies'
         limit 1
         for update;

        if found
           and v_next_due is not null
           and coalesce(v_existing_fact.value_json ->> 'clinic_reported_next_due', '') <> ''
           and (v_existing_fact.value_json ->> 'clinic_reported_next_due')::date <> v_next_due then
            raise exception 'Conflicting trusted Rabies next-due date requires review';
        end if;

        v_source_ids := coalesce(v_existing_fact.value_json -> 'source_document_ids', '[]'::jsonb);
        if not v_source_ids @> jsonb_build_array(v_doc.id::text) then
            v_source_ids := v_source_ids || jsonb_build_array(v_doc.id::text);
        end if;
        v_evidence_types := coalesce(v_existing_fact.value_json -> 'evidence_types', '[]'::jsonb);
        if not v_evidence_types @> jsonb_build_array(v_source_type) then
            v_evidence_types := v_evidence_types || jsonb_build_array(v_source_type);
        end if;

        v_value_json := jsonb_strip_nulls(jsonb_build_object(
            'care_kind', 'vaccine',
            'care_item', 'rabies',
            'clinic_reported_next_due', coalesce(v_next_due::text, v_existing_fact.value_json ->> 'clinic_reported_next_due'),
            'clinic_reported_status', coalesce(v_status, v_existing_fact.value_json ->> 'clinic_reported_status'),
            'clinic_reported_status_as_of', coalesce(v_status_date::text, case when v_status is not null then v_doc.doc_date::text end, v_existing_fact.value_json ->> 'clinic_reported_status_as_of'),
            'source_document_ids', v_source_ids,
            'evidence_types', v_evidence_types,
            'date_meaning', 'clinic_reported_next_due',
            'source_context', case
                when v_source_type = 'vaccination_certificate' then coalesce(v_due_context, v_status_context)
                else coalesce(v_existing_fact.value_json ->> 'source_context', v_due_context, v_status_context)
            end,
            'schema_version', 1,
            'rule_version', 'verified_vaccine_evidence_v1'
        ));

        if found then
            update public.facts
               set doc_id = case
                       when v_source_type = 'vaccination_certificate' then v_doc.id
                       else v_existing_fact.doc_id
                   end,
                   fact_date = coalesce(v_next_due, v_existing_fact.fact_date, v_status_date, v_doc.doc_date),
                   value_json = v_value_json,
                   confidence = 1.0,
                   verified_at = v_now,
                   verified_by = p_verified_by
             where id = v_existing_fact.id
             returning * into v_fact;
        else
            insert into public.facts (
                pet_id, doc_id, fact_type, fact_date, value_json,
                status, confidence, verified_at, verified_by
            ) values (
                v_doc.pet_id,
                v_doc.id,
                'preventive_care_status',
                coalesce(v_next_due, v_status_date, v_doc.doc_date),
                v_value_json,
                'verified',
                1.0,
                v_now,
                p_verified_by
            ) returning * into v_fact;
        end if;
    end if;

    update public.documents
       set doc_type = case
               when v_source_type = 'vaccination_certificate' then 'vaccination_certificate'
               else doc_type
           end,
           updated_at = v_now
     where id = v_doc.id;

    return jsonb_build_object(
        'schema_version', 1,
        'care_item', 'rabies',
        'administration_event_id', v_event.id,
        'preventive_status_fact_id', v_fact.id,
        'source_document_id', v_doc.id
    );
end;
$$;

revoke all on function public.materialize_verified_vaccine_evidence(uuid, jsonb, text) from public;
revoke all on function public.materialize_verified_vaccine_evidence(uuid, jsonb, text) from anon;
revoke all on function public.materialize_verified_vaccine_evidence(uuid, jsonb, text) from authenticated;
grant execute on function public.materialize_verified_vaccine_evidence(uuid, jsonb, text) to service_role;
