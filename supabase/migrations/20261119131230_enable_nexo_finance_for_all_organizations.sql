-- Enable NEXO Finance by default without changing an organization's existing
-- decision. Missing rows are granted; an explicit disabled row always wins.

insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
select organization.id, 'nexo-finance'::public.app_key, true, null
from public.organizations as organization
on conflict (organization_id, app_key) do nothing;

-- Organization creation currently happens through the SECURITY DEFINER
-- create_organization RPC. An AFTER INSERT trigger keeps this default close to
-- the organization lifecycle while the trigger function itself stays INVOKER.
create or replace function public.provision_nexo_finance_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
  values (new.id, 'nexo-finance'::public.app_key, true, null)
  on conflict (organization_id, app_key) do nothing;

  return new;
end;
$$;

revoke all on function public.provision_nexo_finance_entitlement() from public, anon, authenticated;

drop trigger if exists organizations_provision_nexo_finance on public.organizations;
create trigger organizations_provision_nexo_finance
  after insert on public.organizations
  for each row execute procedure public.provision_nexo_finance_entitlement();
