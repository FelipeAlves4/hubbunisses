-- Enable CLIENTA+ by default without overriding an organization's existing
-- decision. Missing rows are granted; an explicit disabled row always wins.
-- This migration does not alter CRM or PROPOSTA+ data, RLS, policies, or ACLs.

insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
select organization.id, 'clienta-plus'::public.app_key, true, null
from public.organizations as organization
on conflict (organization_id, app_key) do nothing;

-- Keep the default close to the organization lifecycle. Direct function calls
-- are prohibited; the trigger is the only execution path.
create or replace function public.provision_clienta_plus_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
  values (new.id, 'clienta-plus'::public.app_key, true, null)
  on conflict (organization_id, app_key) do nothing;

  return new;
end;
$$;

revoke all on function public.provision_clienta_plus_entitlement() from public, anon, authenticated;

drop trigger if exists organizations_provision_clienta_plus on public.organizations;
create trigger organizations_provision_clienta_plus
  after insert on public.organizations
  for each row execute procedure public.provision_clienta_plus_entitlement();
