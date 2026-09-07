-- Fresh-environment bootstrap for the original TomoCare data foundation.
--
-- This migration contains schema only. It intentionally contains no care
-- rows, source documents, storage objects, provider destinations, or secrets.
-- It is idempotent for the already-existing real-care database and creates
-- the missing base tables when the migration chain is applied to a blank
-- hosted demo project.

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table if not exists public.pets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    species text not null default 'canine',
    breed text,
    sex text,
    spayed_neutered boolean,
    birth_date date,
    microchip_id text,
    patient_external_id text,
    weight_value numeric,
    weight_unit text default 'kg',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.documents (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null,
    doc_type text not null,
    title text,
    doc_date date,
    source_org text,
    source_person text,
    file_url text unique,
    raw_text text,
    text_extracted jsonb,
    triage_result jsonb,
    remarks text,
    external_refs jsonb not null default '{}'::jsonb,
    status text not null default 'ingested',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint documents_pet_id_fkey
        foreign key (pet_id) references public.pets(id)
);

create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null,
    doc_id uuid,
    event_type text not null,
    event_date date not null,
    event_start timestamptz,
    event_end timestamptz,
    status text not null default 'completed',
    details_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint events_pet_id_fkey
        foreign key (pet_id) references public.pets(id),
    constraint events_doc_id_fkey
        foreign key (doc_id) references public.documents(id)
);

create table if not exists public.cost_items (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null,
    doc_id uuid not null,
    service_date date not null,
    category text not null,
    item_name text not null,
    quantity numeric,
    unit text,
    amount numeric not null,
    currency text not null default 'USD',
    tax_amount numeric not null default 0,
    confidence numeric,
    status text not null default 'candidate',
    verified_at timestamptz,
    verified_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint cost_items_pet_id_fkey
        foreign key (pet_id) references public.pets(id),
    constraint cost_items_doc_id_fkey
        foreign key (doc_id) references public.documents(id)
);

create table if not exists public.labs (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null,
    doc_id uuid not null,
    panel text,
    analyte text not null,
    value_text text,
    value_num numeric,
    unit text,
    ref_low numeric,
    ref_high numeric,
    ref_text text,
    flag text,
    lab_date date not null,
    raw_result_text text,
    confidence numeric,
    verified_at timestamptz,
    verified_by text,
    status text not null default 'candidate',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint labs_pet_id_fkey
        foreign key (pet_id) references public.pets(id),
    constraint labs_doc_id_fkey
        foreign key (doc_id) references public.documents(id)
);

create table if not exists public.facts (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null,
    doc_id uuid,
    fact_type text not null,
    value_json jsonb not null default '{}'::jsonb,
    fact_date date,
    confidence numeric,
    verified_at timestamptz,
    verified_by text,
    status text not null default 'candidate',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint facts_pet_id_fkey
        foreign key (pet_id) references public.pets(id),
    constraint facts_doc_id_fkey
        foreign key (doc_id) references public.documents(id)
);

create table if not exists public.field_plan (
    user_id uuid primary key,
    state jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists documents_pet_status_created_idx
    on public.documents (pet_id, status, created_at desc);
create index if not exists events_pet_date_idx
    on public.events (pet_id, event_date desc);
create index if not exists events_document_idx
    on public.events (doc_id) where doc_id is not null;
create index if not exists cost_items_pet_service_date_idx
    on public.cost_items (pet_id, service_date desc);
create index if not exists cost_items_document_idx
    on public.cost_items (doc_id);
create index if not exists labs_pet_lab_date_idx
    on public.labs (pet_id, lab_date desc);
create index if not exists labs_document_idx
    on public.labs (doc_id);
create index if not exists facts_pet_type_date_idx
    on public.facts (pet_id, fact_type, fact_date desc);
create index if not exists facts_document_idx
    on public.facts (doc_id) where doc_id is not null;

drop trigger if exists pets_set_updated_at on public.pets;
create trigger pets_set_updated_at
    before update on public.pets
    for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
    before update on public.documents
    for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
    before update on public.events
    for each row execute function public.set_updated_at();

drop trigger if exists cost_items_set_updated_at on public.cost_items;
create trigger cost_items_set_updated_at
    before update on public.cost_items
    for each row execute function public.set_updated_at();

drop trigger if exists labs_set_updated_at on public.labs;
create trigger labs_set_updated_at
    before update on public.labs
    for each row execute function public.set_updated_at();

drop trigger if exists facts_set_updated_at on public.facts;
create trigger facts_set_updated_at
    before update on public.facts
    for each row execute function public.set_updated_at();

drop trigger if exists field_plan_set_updated_at on public.field_plan;
create trigger field_plan_set_updated_at
    before update on public.field_plan
    for each row execute function public.set_updated_at();

alter table public.pets enable row level security;
alter table public.documents enable row level security;
alter table public.events enable row level security;
alter table public.cost_items enable row level security;
alter table public.labs enable row level security;
alter table public.facts enable row level security;
alter table public.field_plan enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'field_plan'
          and policyname = 'field_plan_select_own'
    ) then
        create policy field_plan_select_own on public.field_plan
            for select using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'field_plan'
          and policyname = 'field_plan_insert_own'
    ) then
        create policy field_plan_insert_own on public.field_plan
            for insert with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'field_plan'
          and policyname = 'field_plan_update_own'
    ) then
        create policy field_plan_update_own on public.field_plan
            for update using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end;
$$;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'tomo-docs',
    'tomo-docs',
    false,
    20971520,
    array['application/pdf']::text[]
)
on conflict (id) do nothing;

comment on table public.pets is
    'Pet profile and current summary fields.';
comment on table public.documents is
    'Source-document metadata, candidate extraction, and verification state.';
comment on table public.events is
    'Trusted and planned care events with explicit care dates.';
comment on table public.facts is
    'Structured candidate or verified facts linked to source evidence.';

commit;
