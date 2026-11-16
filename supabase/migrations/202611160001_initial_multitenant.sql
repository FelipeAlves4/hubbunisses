-- ASEX Business foundation. Apply through the Supabase CLI only after reviewing the target project.
create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'member');
create type public.app_key as enum ('nexo-finance', 'proposta-plus', 'precifica-plus');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  document_number text,
  logo_url text,
  segment text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members(user_id);

create table public.app_entitlements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_key public.app_key not null,
  enabled boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, app_key),
  check (expires_at is null or expires_at > created_at)
);

create table public.pricing_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('product', 'service')),
  name text not null check (char_length(trim(name)) between 1 and 160),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pricing_simulations_organization_created_idx on public.pricing_simulations(organization_id, created_at desc);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m where m.organization_id = target_organization_id and m.user_id = auth.uid());
$$;
revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.app_entitlements enable row level security;
alter table public.pricing_simulations enable row level security;

create policy "profiles are owned by the authenticated user" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "members can read their organization" on public.organizations for select to authenticated using (public.is_organization_member(id));
create policy "members can read memberships in their organization" on public.organization_members for select to authenticated using (public.is_organization_member(organization_id));
create policy "members can read enabled applications for their organization" on public.app_entitlements for select to authenticated using (public.is_organization_member(organization_id));
create policy "members can read their organization simulations" on public.pricing_simulations for select to authenticated using (public.is_organization_member(organization_id));
create policy "members can insert simulations into their organization" on public.pricing_simulations for insert to authenticated with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "members can update their own simulations" on public.pricing_simulations for update to authenticated using (public.is_organization_member(organization_id) and created_by = auth.uid()) with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "members can delete their own simulations" on public.pricing_simulations for delete to authenticated using (public.is_organization_member(organization_id) and created_by = auth.uid());

-- Membership and entitlement mutation is intentionally absent from client policies.
-- Create audited server-side/admin RPCs after global-admin governance is defined.
