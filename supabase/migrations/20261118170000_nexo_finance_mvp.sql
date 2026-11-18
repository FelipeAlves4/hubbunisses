-- NEXO Finance MVP. This migration is local-only until explicitly approved.
-- Amounts are stored as integer cents; no financial calculation depends on float.

create type public.finance_category_kind as enum ('income', 'expense', 'both');
create type public.finance_transaction_type as enum ('income', 'expense');
create type public.finance_transaction_status as enum ('pending', 'paid');

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 80),
  kind public.finance_category_kind not null default 'both',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  client_mutation_id uuid not null default gen_random_uuid(),
  entry_type public.finance_transaction_type not null,
  description text not null check (char_length(trim(description)) between 2 and 160),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 99999999999999),
  issued_at date not null,
  due_date date not null,
  paid_at date,
  status public.finance_transaction_status not null default 'pending',
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, category_id)
    references public.finance_categories(organization_id, id) on delete restrict,
  unique (organization_id, id),
  unique (organization_id, client_mutation_id),
  check (
    (status = 'paid' and paid_at is not null)
    or (status = 'pending' and paid_at is null)
  )
);

create index finance_categories_organization_name_idx
  on public.finance_categories (organization_id, name);
create index finance_transactions_organization_issued_idx
  on public.finance_transactions (organization_id, issued_at desc, created_at desc);
create index finance_transactions_organization_due_pending_idx
  on public.finance_transactions (organization_id, due_date)
  where status = 'pending';
create index finance_transactions_organization_paid_idx
  on public.finance_transactions (organization_id, paid_at desc)
  where status = 'paid';

create or replace function public.prevent_finance_tenant_or_creator_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Organização e criador não podem ser alterados.' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;

revoke all on public.finance_categories, public.finance_transactions from anon, authenticated;
revoke all on function public.prevent_finance_tenant_or_creator_change() from public, anon, authenticated;

create policy "entitled members read finance categories"
on public.finance_categories for select to authenticated
using (
  public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_categories.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);
create policy "members create finance categories"
on public.finance_categories for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_categories.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);
create policy "creators update finance categories"
on public.finance_categories for update to authenticated
using (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_categories.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
)
with check (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_categories.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);
create policy "creators delete finance categories"
on public.finance_categories for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_categories.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);

create policy "entitled members read finance transactions"
on public.finance_transactions for select to authenticated
using (
  public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_transactions.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);
create policy "creators create finance transactions"
on public.finance_transactions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_transactions.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);
create policy "creators update finance transactions"
on public.finance_transactions for update to authenticated
using (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_transactions.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
)
with check (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_transactions.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);
create policy "creators delete finance transactions"
on public.finance_transactions for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_organization_member(organization_id)
  and exists (
    select 1 from public.app_entitlements entitlement
    where entitlement.organization_id = finance_transactions.organization_id
      and entitlement.app_key = 'nexo-finance'
      and entitlement.enabled
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);

grant select, insert, update, delete on public.finance_categories, public.finance_transactions to authenticated;

create trigger finance_categories_set_updated_at
before update on public.finance_categories
for each row execute procedure public.set_updated_at();
create trigger finance_transactions_set_updated_at
before update on public.finance_transactions
for each row execute procedure public.set_updated_at();
create trigger finance_categories_prevent_tenant_change
before update on public.finance_categories
for each row execute procedure public.prevent_finance_tenant_or_creator_change();
create trigger finance_transactions_prevent_tenant_change
before update on public.finance_transactions
for each row execute procedure public.prevent_finance_tenant_or_creator_change();
