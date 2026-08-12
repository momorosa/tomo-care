-- Phase 3E.0d: atomically materialize one verified weight per source document
-- and keep pets.weight_value synchronized to the newest verified measurement.

create unique index if not exists facts_one_verified_weight_per_document_idx
    on public.facts (doc_id)
    where fact_type = 'weight' and doc_id is not null;

create or replace function public.materialize_verified_weight_measurement(
    p_doc_id uuid,
    p_measurement jsonb,
    p_verified_by text default 'rosa'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_doc public.documents%rowtype;
    v_existing public.facts%rowtype;
    v_latest public.facts%rowtype;
    v_fact public.facts%rowtype;
    v_value numeric;
    v_value_kg numeric;
    v_value_lb numeric;
    v_unit text;
    v_fact_date date;
    v_now timestamptz := now();
    v_disposition text := 'created';
    v_value_json jsonb;
begin
    select *
      into v_doc
      from public.documents
     where id = p_doc_id
     for update;

    if not found then
        raise exception 'Document not found';
    end if;

    if v_doc.status <> 'verified' then
        raise exception 'Document must be verified before materializing weight';
    end if;

    if p_measurement is null or jsonb_typeof(p_measurement) <> 'object' then
        raise exception 'A structured weight measurement is required';
    end if;

    if coalesce(p_measurement->>'value', '') !~ '^\d{1,2}(\.\d{1,2})?$'
       or coalesce(p_measurement->>'value_kg', '') !~ '^\d{1,2}(\.\d{1,2})?$'
       or coalesce(p_measurement->>'value_lb', '') !~ '^\d{1,2}(\.\d{1,2})?$' then
        raise exception 'Weight values are invalid';
    end if;

    v_value := (p_measurement->>'value')::numeric;
    v_value_kg := (p_measurement->>'value_kg')::numeric;
    v_value_lb := (p_measurement->>'value_lb')::numeric;
    v_unit := lower(p_measurement->>'unit');

    if v_unit not in ('kg', 'lb') or v_value_kg < 8 or v_value_kg > 25 then
        raise exception 'Weight measurement is outside the supported range';
    end if;

    if coalesce(p_measurement->>'measured_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Weight measurement date is invalid';
    end if;

    v_fact_date := (p_measurement->>'measured_date')::date;

    v_value_json := jsonb_build_object(
        'value', v_value,
        'unit', v_unit,
        'value_kg', v_value_kg,
        'value_lb', v_value_lb,
        'source_field', coalesce(p_measurement->>'source_field', 'text_extracted.weight_measurement'),
        'source_label', coalesce(p_measurement->>'source_label', 'Verified weight'),
        'extraction_method', coalesce(p_measurement->>'extraction_method', 'structured_weight_measurement'),
        'source_context', p_measurement->>'source_context',
        'schema_version', 1,
        'rule_version', 'verified_weight_v1'
    );

    select *
      into v_existing
      from public.facts
     where doc_id = p_doc_id
       and fact_type = 'weight'
     limit 1
     for update;

    if found then
        if v_existing.status = 'verified'
           and v_existing.fact_date = v_fact_date
           and abs(coalesce((v_existing.value_json->>'value_kg')::numeric, -1) - v_value_kg) < 0.01 then
            v_disposition := 'existing';
        else
            v_disposition := 'updated';
        end if;

        update public.facts
           set fact_date = v_fact_date,
               value_json = v_value_json,
               status = 'verified',
               confidence = 1.0,
               verified_at = v_now,
               verified_by = p_verified_by
         where id = v_existing.id
         returning * into v_fact;
    else
        insert into public.facts (
            pet_id,
            doc_id,
            fact_type,
            fact_date,
            value_json,
            status,
            confidence,
            verified_at,
            verified_by
        ) values (
            v_doc.pet_id,
            v_doc.id,
            'weight',
            v_fact_date,
            v_value_json,
            'verified',
            1.0,
            v_now,
            p_verified_by
        )
        returning * into v_fact;
    end if;

    -- Preserve the reviewed measurement with the source document so a future
    -- audit does not need to re-derive it from raw OCR text.
    update public.documents
       set text_extracted = jsonb_set(
               coalesce(text_extracted, '{}'::jsonb),
               '{weight_measurement}',
               v_value_json || jsonb_build_object('measured_date', v_fact_date::text),
               true
           ),
           updated_at = v_now
     where id = v_doc.id;

    select *
      into v_latest
      from public.facts
     where pet_id = v_doc.pet_id
       and fact_type = 'weight'
       and status = 'verified'
     order by fact_date desc, verified_at desc nulls last, id desc
     limit 1;

    if found then
        update public.pets
           set weight_value = (v_latest.value_json->>'value_kg')::numeric,
               weight_unit = 'kg'
         where id = v_doc.pet_id;
    end if;

    return jsonb_build_object(
        'schema_version', 1,
        'disposition', v_disposition,
        'fact_id', v_fact.id,
        'fact_date', v_fact.fact_date,
        'value_kg', (v_fact.value_json->>'value_kg')::numeric,
        'value_lb', (v_fact.value_json->>'value_lb')::numeric,
        'source_document_id', v_doc.id,
        'latest_fact_id', v_latest.id,
        'latest_fact_date', v_latest.fact_date,
        'latest_weight_kg', (v_latest.value_json->>'value_kg')::numeric
    );
end;
$$;

revoke all on function public.materialize_verified_weight_measurement(uuid, jsonb, text) from public;
revoke all on function public.materialize_verified_weight_measurement(uuid, jsonb, text) from anon;
revoke all on function public.materialize_verified_weight_measurement(uuid, jsonb, text) from authenticated;
grant execute on function public.materialize_verified_weight_measurement(uuid, jsonb, text) to service_role;
