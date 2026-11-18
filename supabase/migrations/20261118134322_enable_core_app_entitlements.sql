-- Make the two delivered ASEX applications available to every organization.
-- This migration intentionally does not grant NEXO Finance, and it leaves the
-- entitlement table/RLS model intact so an administrator can revoke an app later.

insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
select organization.id, application.app_key::public.app_key, true, null
from public.organizations as organization
cross join (values ('precifica-plus'), ('proposta-plus')) as application(app_key)
on conflict (organization_id, app_key) do update
set
  enabled = excluded.enabled,
  expires_at = excluded.expires_at;

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
  values
    (new_organization.id, 'precifica-plus', true),
    (new_organization.id, 'proposta-plus', true)
  on conflict (organization_id, app_key) do update
  set enabled = excluded.enabled, expires_at = excluded.expires_at;

  return new_organization;
end;
$$;

revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
