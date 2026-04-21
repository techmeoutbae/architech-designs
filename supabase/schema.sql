create extension if not exists "pgcrypto";

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'client' check (role in ('admin', 'client')),
    email text unique,
    full_name text,
    phone text,
    title text,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references public.profiles(id) on delete cascade,
    company_name text not null,
    slug text not null unique,
    billing_email text,
    status text not null default 'active' check (status in ('active', 'inactive')),
    notes text,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    name text not null,
    slug text not null unique,
    service_line text,
    description text,
    status text not null default 'active' check (status in ('planning', 'active', 'review', 'complete', 'on_hold')),
    current_phase text,
    progress integer not null default 0 check (progress >= 0 and progress <= 100),
    start_date date,
    target_launch_date date,
    next_review_at timestamptz,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.project_memberships (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    membership_role text not null check (membership_role in ('admin', 'client')),
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),
    unique (project_id, user_id)
);

create table if not exists public.project_updates (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    body text not null,
    status text not null default 'update' check (status in ('update', 'decision', 'review')),
    published_at timestamptz not null default now()
);

create table if not exists public.milestones (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    title text not null,
    description text,
    status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'review', 'approved', 'complete')),
    due_at date,
    sort_order integer not null default 0,
    requires_approval boolean not null default false,
    approved_at timestamptz,
    approved_by uuid references public.profiles(id)
);

create table if not exists public.documents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    uploaded_by uuid not null references public.profiles(id) on delete cascade,
    file_name text not null,
    storage_path text not null unique,
    mime_type text,
    file_size bigint,
    category text,
    created_at timestamptz not null default now()
);

create table if not exists public.invoices (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    created_by uuid not null references public.profiles(id) on delete cascade,
    invoice_number text not null unique,
    title text not null,
    description text,
    amount numeric(12,2) not null check (amount >= 0),
    currency text not null default 'USD',
    status text not null default 'issued' check (status in ('issued', 'paid', 'overdue', 'void')),
    issued_at timestamptz not null default now(),
    due_at timestamptz,
    paid_at timestamptz,
    payment_url text
);

create table if not exists public.payment_records (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references public.invoices(id) on delete cascade,
    recorded_by uuid not null references public.profiles(id) on delete cascade,
    amount numeric(12,2) not null check (amount >= 0),
    method text,
    reference text,
    notes text,
    paid_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    sender_id uuid not null references public.profiles(id) on delete cascade,
    body text not null,
    is_internal boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.consultations (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null,
    phone text,
    company_name text not null,
    requested_service text,
    budget_range text,
    timeline text,
    preferred_date date not null,
    preferred_time text not null,
    preferred_iso timestamptz,
    timezone text,
    project_details text not null,
    status text not null default 'new' check (status in ('new', 'confirmed', 'completed', 'archived')),
    notes text,
    assigned_project_id uuid references public.projects(id) on delete set null,
    source text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.consultation_slot_overrides (
    id uuid primary key default gen_random_uuid(),
    slot_date date not null,
    slot_time text not null,
    is_available boolean not null default true,
    note text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (slot_date, slot_time)
);

alter table public.invoices add column if not exists stripe_checkout_session_id text;
alter table public.invoices add column if not exists stripe_payment_intent_id text;
alter table public.invoices add column if not exists stripe_payment_link_id text;
alter table public.invoices add column if not exists stripe_customer_id text;

alter table public.payment_records add column if not exists provider text not null default 'manual';
alter table public.payment_records add column if not exists provider_payment_id text;
alter table public.payment_records add column if not exists provider_status text;
alter table public.payment_records add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_clients_profile_id on public.clients(profile_id);
create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_projects_updated_at on public.projects(updated_at desc);
create index if not exists idx_project_memberships_user_id on public.project_memberships(user_id);
create index if not exists idx_project_memberships_project_id on public.project_memberships(project_id);
create index if not exists idx_project_updates_project_id on public.project_updates(project_id);
create index if not exists idx_project_updates_published_at on public.project_updates(published_at desc);
create index if not exists idx_milestones_project_id on public.milestones(project_id);
create index if not exists idx_milestones_project_sort on public.milestones(project_id, sort_order, due_at);
create index if not exists idx_documents_project_id on public.documents(project_id);
create index if not exists idx_documents_created_at on public.documents(created_at desc);
create index if not exists idx_invoices_project_id on public.invoices(project_id);
create index if not exists idx_invoices_status on public.invoices(status);
create unique index if not exists idx_invoices_stripe_checkout_session_id on public.invoices(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists idx_invoices_stripe_payment_intent_id on public.invoices(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists idx_payment_records_invoice_id on public.payment_records(invoice_id);
create unique index if not exists idx_payment_records_provider_payment_id on public.payment_records(provider_payment_id) where provider_payment_id is not null;
create index if not exists idx_messages_project_id on public.messages(project_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
create index if not exists idx_consultations_status_date on public.consultations(status, preferred_date, preferred_time);
create unique index if not exists idx_consultations_active_slot_unique on public.consultations(preferred_date, preferred_time) where status in ('new', 'confirmed');
create index if not exists idx_consultation_slot_overrides_slot_date on public.consultation_slot_overrides(slot_date, slot_time);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.is_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = target_user
          and role = 'admin'
    );
$$;

create or replace function public.has_project_access(target_project uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_admin(target_user)
        or exists (
            select 1
            from public.project_memberships
            where project_id = target_project
              and user_id = target_user
        );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
    on conflict (id) do update
    set email = excluded.email,
        full_name = case
            when coalesce(profiles.full_name, '') = '' then excluded.full_name
            else profiles.full_name
        end;

    return new;
end;
$$;

create or replace function public.guard_profile_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    privileged_session boolean := session_user in ('postgres', 'supabase_admin');
begin
    if tg_op = 'INSERT' then
        if new.role is null then
            new.role = 'client';
        end if;

        if new.role <> 'client'
            and not privileged_session
            and coalesce(auth.role(), '') <> 'service_role'
            and not public.is_admin(auth.uid()) then
            new.role = 'client';
        end if;

        return new;
    end if;

    if new.role is distinct from old.role
        and not privileged_session
        and coalesce(auth.role(), '') <> 'service_role'
        and not public.is_admin(auth.uid()) then
        raise exception 'Only admin accounts can change profile roles.';
    end if;

    return new;
end;
$$;

create or replace function public.project_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
    if object_name is null or split_part(object_name, '/', 1) = '' then
        return null;
    end if;

    return split_part(object_name, '/', 1)::uuid;
exception
    when others then
        return null;
end;
$$;

create or replace function public.can_upload_document_object(object_name text, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.project_id_from_storage_path(object_name) is not null
       and split_part(coalesce(object_name, ''), '/', 2) <> ''
       and public.has_project_access(public.project_id_from_storage_path(object_name), target_user);
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before insert or update on public.profiles for each row execute function public.guard_profile_role_changes();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists consultations_set_updated_at on public.consultations;
create trigger consultations_set_updated_at before update on public.consultations for each row execute function public.set_updated_at();

drop trigger if exists consultation_slot_overrides_set_updated_at on public.consultation_slot_overrides;
create trigger consultation_slot_overrides_set_updated_at before update on public.consultation_slot_overrides for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name)
select
    users.id,
    users.email,
    coalesce(users.raw_user_meta_data ->> 'full_name', '')
from auth.users as users
on conflict (id) do update
set email = excluded.email,
    full_name = case
        when coalesce(profiles.full_name, '') = '' then excluded.full_name
        else profiles.full_name
    end;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.project_updates enable row level security;
alter table public.milestones enable row level security;
alter table public.documents enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_records enable row level security;
alter table public.messages enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_slot_overrides enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
drop policy if exists "clients_select_self_or_admin" on public.clients;
drop policy if exists "clients_admin_insert" on public.clients;
drop policy if exists "clients_admin_update" on public.clients;
drop policy if exists "clients_admin_delete" on public.clients;
drop policy if exists "projects_select_by_membership" on public.projects;
drop policy if exists "projects_admin_insert" on public.projects;
drop policy if exists "projects_admin_update" on public.projects;
drop policy if exists "projects_admin_delete" on public.projects;
drop policy if exists "memberships_select_visible" on public.project_memberships;
drop policy if exists "memberships_admin_insert" on public.project_memberships;
drop policy if exists "memberships_admin_update" on public.project_memberships;
drop policy if exists "memberships_admin_delete" on public.project_memberships;
drop policy if exists "project_updates_select_by_membership" on public.project_updates;
drop policy if exists "project_updates_admin_manage" on public.project_updates;
drop policy if exists "milestones_select_by_membership" on public.milestones;
drop policy if exists "milestones_admin_manage" on public.milestones;
drop policy if exists "documents_select_by_membership" on public.documents;
drop policy if exists "documents_admin_manage" on public.documents;
drop policy if exists "documents_insert_by_membership" on public.documents;
drop policy if exists "documents_admin_update" on public.documents;
drop policy if exists "documents_admin_delete" on public.documents;
drop policy if exists "invoices_select_by_membership" on public.invoices;
drop policy if exists "invoices_admin_manage" on public.invoices;
drop policy if exists "payment_records_select_by_membership" on public.payment_records;
drop policy if exists "payment_records_admin_manage" on public.payment_records;
drop policy if exists "messages_select_visible" on public.messages;
drop policy if exists "messages_insert_visible" on public.messages;
drop policy if exists "messages_admin_update" on public.messages;
drop policy if exists "messages_admin_delete" on public.messages;
drop policy if exists "consultations_admin_select" on public.consultations;
drop policy if exists "consultations_admin_insert" on public.consultations;
drop policy if exists "consultations_admin_update" on public.consultations;
drop policy if exists "consultations_admin_delete" on public.consultations;
drop policy if exists "consultation_slot_overrides_admin_select" on public.consultation_slot_overrides;
drop policy if exists "consultation_slot_overrides_admin_insert" on public.consultation_slot_overrides;
drop policy if exists "consultation_slot_overrides_admin_update" on public.consultation_slot_overrides;
drop policy if exists "consultation_slot_overrides_admin_delete" on public.consultation_slot_overrides;

create policy "profiles_select_self_or_admin" on public.profiles for select
using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_self_or_admin" on public.profiles for insert
with check (auth.uid() = id or public.is_admin());

create policy "profiles_update_self_or_admin" on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "clients_select_self_or_admin" on public.clients for select
using (profile_id = auth.uid() or public.is_admin());

create policy "clients_admin_insert" on public.clients for insert
with check (public.is_admin());

create policy "clients_admin_update" on public.clients for update
using (public.is_admin())
with check (public.is_admin());

create policy "clients_admin_delete" on public.clients for delete
using (public.is_admin());

create policy "projects_select_by_membership" on public.projects for select
using (public.has_project_access(id));

create policy "projects_admin_insert" on public.projects for insert
with check (public.is_admin());

create policy "projects_admin_update" on public.projects for update
using (public.is_admin())
with check (public.is_admin());

create policy "projects_admin_delete" on public.projects for delete
using (public.is_admin());

create policy "memberships_select_visible" on public.project_memberships for select
using (public.is_admin() or user_id = auth.uid() or public.has_project_access(project_id));

create policy "memberships_admin_insert" on public.project_memberships for insert
with check (public.is_admin());

create policy "memberships_admin_update" on public.project_memberships for update
using (public.is_admin())
with check (public.is_admin());

create policy "memberships_admin_delete" on public.project_memberships for delete
using (public.is_admin());

create policy "project_updates_select_by_membership" on public.project_updates for select
using (public.has_project_access(project_id));

create policy "project_updates_admin_manage" on public.project_updates for all
using (public.is_admin())
with check (public.is_admin());

create policy "milestones_select_by_membership" on public.milestones for select
using (public.has_project_access(project_id));

create policy "milestones_admin_manage" on public.milestones for all
using (public.is_admin())
with check (public.is_admin());

create policy "documents_select_by_membership" on public.documents for select
using (public.has_project_access(project_id));

create policy "documents_insert_by_membership" on public.documents for insert
with check (public.has_project_access(project_id) and uploaded_by = auth.uid());

create policy "documents_admin_update" on public.documents for update
using (public.is_admin())
with check (public.is_admin());

create policy "documents_admin_delete" on public.documents for delete
using (public.is_admin());

create policy "invoices_select_by_membership" on public.invoices for select
using (public.has_project_access(project_id));

create policy "invoices_admin_manage" on public.invoices for all
using (public.is_admin())
with check (public.is_admin());

create policy "payment_records_select_by_membership" on public.payment_records for select
using (
    public.is_admin()
    or exists (
        select 1
        from public.invoices
        where invoices.id = payment_records.invoice_id
          and public.has_project_access(invoices.project_id)
    )
);

create policy "payment_records_admin_manage" on public.payment_records for all
using (public.is_admin())
with check (public.is_admin());

create policy "messages_select_visible" on public.messages for select
using (
    public.is_admin()
    or (public.has_project_access(project_id) and is_internal = false)
);

create policy "messages_insert_visible" on public.messages for insert
with check (
    public.is_admin()
    or (public.has_project_access(project_id) and sender_id = auth.uid() and is_internal = false)
);

create policy "messages_admin_update" on public.messages for update
using (public.is_admin())
with check (public.is_admin());

create policy "messages_admin_delete" on public.messages for delete
using (public.is_admin());

create policy "consultations_admin_select" on public.consultations for select
using (public.is_admin());

create policy "consultations_admin_insert" on public.consultations for insert
with check (public.is_admin());

create policy "consultations_admin_update" on public.consultations for update
using (public.is_admin())
with check (public.is_admin());

create policy "consultations_admin_delete" on public.consultations for delete
using (public.is_admin());

create policy "consultation_slot_overrides_admin_select" on public.consultation_slot_overrides for select
using (public.is_admin());

create policy "consultation_slot_overrides_admin_insert" on public.consultation_slot_overrides for insert
with check (public.is_admin());

create policy "consultation_slot_overrides_admin_update" on public.consultation_slot_overrides for update
using (public.is_admin())
with check (public.is_admin());

create policy "consultation_slot_overrides_admin_delete" on public.consultation_slot_overrides for delete
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "storage_client_documents_select" on storage.objects;
drop policy if exists "storage_client_documents_insert" on storage.objects;
drop policy if exists "storage_client_documents_update" on storage.objects;
drop policy if exists "storage_client_documents_delete" on storage.objects;

create policy "storage_client_documents_select" on storage.objects for select
using (
    bucket_id = 'client-documents'
    and exists (
        select 1
        from public.documents
        where documents.storage_path = storage.objects.name
          and public.has_project_access(documents.project_id)
    )
);

create policy "storage_client_documents_insert" on storage.objects for insert
with check (
    bucket_id = 'client-documents'
    and public.can_upload_document_object(name)
);

create policy "storage_client_documents_update" on storage.objects for update
using (
    bucket_id = 'client-documents'
    and public.is_admin()
)
with check (
    bucket_id = 'client-documents'
    and public.is_admin()
);

create policy "storage_client_documents_delete" on storage.objects for delete
using (
    bucket_id = 'client-documents'
    and public.is_admin()
);

alter table public.messages replica identity full;
alter table public.project_updates replica identity full;
alter table public.milestones replica identity full;
alter table public.documents replica identity full;
alter table public.invoices replica identity full;
alter table public.payment_records replica identity full;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'messages'
        ) then
            execute 'alter publication supabase_realtime add table public.messages';
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'project_updates'
        ) then
            execute 'alter publication supabase_realtime add table public.project_updates';
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'milestones'
        ) then
            execute 'alter publication supabase_realtime add table public.milestones';
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'documents'
        ) then
            execute 'alter publication supabase_realtime add table public.documents';
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'invoices'
        ) then
            execute 'alter publication supabase_realtime add table public.invoices';
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'payment_records'
        ) then
            execute 'alter publication supabase_realtime add table public.payment_records';
        end if;
    end if;
end $$;

-- After running this file, promote your own admin profile if needed:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
