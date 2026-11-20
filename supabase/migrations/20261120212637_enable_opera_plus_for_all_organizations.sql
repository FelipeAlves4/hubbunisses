-- Provision OPERA+ only when no entitlement exists. To revoke access, keep
-- the row and set enabled = false so a rerun preserves the revocation.
create or replace function public.provision_opera_plus_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
  values (new.id, 'opera-plus'::public.app_key, true, null)
  on conflict (organization_id, app_key) do nothing;

  return new;
end;
$$;

revoke all on function public.provision_opera_plus_entitlement()
from public, anon, authenticated, service_role;

-- Install the trigger before the backfill. Within the migration transaction,
-- inserts cannot slip between provisioning existing and future organizations.
create or replace trigger organizations_provision_opera_plus
  after insert on public.organizations
  for each row execute function public.provision_opera_plus_entitlement();

insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
select organization.id, 'opera-plus'::public.app_key, true, null
from public.organizations as organization
on conflict (organization_id, app_key) do nothing;
