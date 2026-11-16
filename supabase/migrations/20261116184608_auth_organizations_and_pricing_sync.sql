-- Phase 4B: Auth-backed organization onboarding and durable PRECIFICA+ history.
-- This file is intentionally local until it has been reviewed and approved.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
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
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'Usuário ASEX'), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute procedure public.set_updated_at();

drop trigger if exists app_entitlements_set_updated_at on public.app_entitlements;
create trigger app_entitlements_set_updated_at
  before update on public.app_entitlements
  for each row execute procedure public.set_updated_at();

alter table public.pricing_simulations
  alter column created_by set default auth.uid(),
  add column if not exists calculation_version text not null default '2026-11-16',
  add column if not exists scenario_inputs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(scenario_inputs) = 'object');

create index if not exists pricing_simulations_organization_updated_idx
  on public.pricing_simulations (organization_id, updated_at desc);

create or replace function public.prevent_pricing_simulation_tenant_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by then
    raise exception 'A organização e o criador de uma simulação não podem ser alterados.';
  end if;
  return new;
end;
$$;

drop trigger if exists pricing_simulations_prevent_tenant_change on public.pricing_simulations;
create trigger pricing_simulations_prevent_tenant_change
  before update on public.pricing_simulations
  for each row execute procedure public.prevent_pricing_simulation_tenant_change();

drop trigger if exists pricing_simulations_set_updated_at on public.pricing_simulations;
create trigger pricing_simulations_set_updated_at
  before update on public.pricing_simulations
  for each row execute procedure public.set_updated_at();

create or replace function public.create_organization(
  organization_name text,
  organization_segment text default null,
  organization_phone text default null,
  organization_logo_url text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
  generated_slug text;
  new_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  normalized_name := trim(organization_name);
  if char_length(normalized_name) not between 2 and 160 then
    raise exception 'Informe um nome de empresa entre 2 e 160 caracteres.' using errcode = '22023';
  end if;

  generated_slug := trim(both '-' from regexp_replace(lower(normalized_name), '[^a-z0-9]+', '-', 'g'));
  generated_slug := left(coalesce(nullif(generated_slug, ''), 'organizacao'), 48)
    || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  insert into public.organizations (name, slug, segment, phone, logo_url)
  values (
    normalized_name,
    generated_slug,
    nullif(trim(coalesce(organization_segment, '')), ''),
    nullif(trim(coalesce(organization_phone, '')), ''),
    nullif(trim(coalesce(organization_logo_url, '')), '')
  )
  returning * into new_organization;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization.id, auth.uid(), 'owner');

  insert into public.app_entitlements (organization_id, app_key, enabled)
  values (new_organization.id, 'precifica-plus', true);

  return new_organization;
end;
$$;

revoke all on function public.create_organization(text, text, text, text) from public;
grant execute on function public.create_organization(text, text, text, text) to authenticated;

drop policy if exists "owners can update their organization" on public.organizations;
create policy "owners can update their organization"
  on public.organizations for update to authenticated
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = id
      and member.user_id = (select auth.uid())
      and member.role = 'owner'
  ))
  with check (exists (
    select 1 from public.organization_members member
    where member.organization_id = id
      and member.user_id = (select auth.uid())
      and member.role = 'owner'
  ));

drop policy if exists "members can update their own simulations" on public.pricing_simulations;
create policy "members can update their own simulations"
  on public.pricing_simulations for update to authenticated
  using (
    created_by = (select auth.uid())
    and public.is_organization_member(organization_id)
  )
  with check (
    created_by = (select auth.uid())
    and public.is_organization_member(organization_id)
  );

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_members, public.app_entitlements to authenticated;
grant select, insert, update, delete on public.pricing_simulations to authenticated;

revoke all on public.organization_members, public.app_entitlements from anon;
revoke insert, update, delete on public.organization_members, public.app_entitlements from authenticated;
