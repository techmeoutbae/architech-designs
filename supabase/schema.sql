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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
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
    on conflict (id) do update set email = excluded.email;
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

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

create policy "profiles_select_self_or_admin" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles_insert_self_or_admin" on public.profiles for insert with check (auth.uid() = id or public.is_admin());
create policy "profiles_update_self_or_admin" on public.profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

create policy "clients_select_self_or_admin" on public.clients for select using (profile_id = auth.uid() or public.is_admin());
create policy "clients_admin_insert" on public.clients for insert with check (public.is_admin());
create policy "clients_admin_update" on public.clients for update using (public.is_admin()) with check (public.is_admin());
create policy "clients_admin_delete" on public.clients for delete using (public.is_admin());

create policy "projects_select_by_membership" on public.projects for select using (public.has_project_access(id));
create policy "projects_admin_insert" on public.projects for insert with check (public.is_admin());
create policy "projects_admin_update" on public.projects for update using (public.is_admin()) with check (public.is_admin());
create policy "projects_admin_delete" on public.projects for delete using (public.is_admin());

create policy "memberships_select_visible" on public.project_memberships for select using (public.is_admin() or user_id = auth.uid() or public.has_project_access(project_id));
create policy "memberships_admin_insert" on public.project_memberships for insert with check (public.is_admin());
create policy "memberships_admin_update" on public.project_memberships for update using (public.is_admin()) with check (public.is_admin());
create policy "memberships_admin_delete" on public.project_memberships for delete using (public.is_admin());

create policy "project_updates_select_by_membership" on public.project_updates for select using (public.has_project_access(project_id));
create policy "project_updates_admin_manage" on public.project_updates for all using (public.is_admin()) with check (public.is_admin());

create policy "milestones_select_by_membership" on public.milestones for select using (public.has_project_access(project_id));
create policy "milestones_admin_manage" on public.milestones for all using (public.is_admin()) with check (public.is_admin());

create policy "documents_select_by_membership" on public.documents for select using (public.has_project_access(project_id));
create policy "documents_admin_manage" on public.documents for all using (public.is_admin()) with check (public.is_admin());

create policy "invoices_select_by_membership" on public.invoices for select using (public.has_project_access(project_id));
create policy "invoices_admin_manage" on public.invoices for all using (public.is_admin()) with check (public.is_admin());

create policy "payment_records_select_by_membership" on public.payment_records for select using (
    public.is_admin()
    or exists (
        select 1
        from public.invoices
        where invoices.id = payment_records.invoice_id
          and public.has_project_access(invoices.project_id)
    )
);
create policy "payment_records_admin_manage" on public.payment_records for all using (public.is_admin()) with check (public.is_admin());

create policy "messages_select_visible" on public.messages for select using (
    public.is_admin()
    or (public.has_project_access(project_id) and is_internal = false)
);
create policy "messages_insert_visible" on public.messages for insert with check (
    public.is_admin()
    or (public.has_project_access(project_id) and sender_id = auth.uid() and is_internal = false)
);
create policy "messages_admin_update" on public.messages for update using (public.is_admin()) with check (public.is_admin());
create policy "messages_admin_delete" on public.messages for delete using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "storage_client_documents_select" on storage.objects for select using (
    bucket_id = 'client-documents'
    and exists (
        select 1
        from public.documents
        where documents.storage_path = storage.objects.name
          and public.has_project_access(documents.project_id)
    )
);

create policy "storage_client_documents_insert" on storage.objects for insert with check (
    bucket_id = 'client-documents'
    and public.is_admin()
);

create policy "storage_client_documents_update" on storage.objects for update using (
    bucket_id = 'client-documents'
    and public.is_admin()
) with check (
    bucket_id = 'client-documents'
    and public.is_admin()
);

create policy "storage_client_documents_delete" on storage.objects for delete using (
    bucket_id = 'client-documents'
    and public.is_admin()
);
