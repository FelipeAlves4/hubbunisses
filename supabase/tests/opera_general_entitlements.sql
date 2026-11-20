-- Run after the general OPERA+ entitlement migration.
begin;

do $$
declare
  missing_id constant uuid := 'f7000000-0000-4000-8000-000000000001';
  revoked_id constant uuid := 'f7000000-0000-4000-8000-000000000002';
  expired_id constant uuid := 'f7000000-0000-4000-8000-000000000003';
  before_rows jsonb;
  after_rows jsonb;
begin
  if has_function_privilege('authenticated', 'public.provision_opera_plus_entitlement()', 'EXECUTE')
    or has_function_privilege('anon', 'public.provision_opera_plus_entitlement()', 'EXECUTE') then
    raise exception 'provision function exposed to API roles';
  end if;

  insert into public.organizations (id, name, slug) values
    (missing_id, 'OPERA Teste Existente', 'opera-general-missing'),
    (revoked_id, 'OPERA Teste Revogada', 'opera-general-revoked'),
    (expired_id, 'OPERA Teste Expirada', 'opera-general-expired');

  if (select count(*) from public.app_entitlements
    where organization_id in (missing_id, revoked_id, expired_id)
      and app_key = 'opera-plus' and enabled and expires_at is null) <> 3 then
    raise exception 'new organizations did not receive OPERA+';
  end if;

  delete from public.app_entitlements where organization_id = missing_id and app_key = 'opera-plus';
  update public.app_entitlements set enabled = false
    where organization_id = revoked_id and app_key = 'opera-plus';
  update public.app_entitlements
    set created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
    where organization_id = expired_id and app_key = 'opera-plus';

  select jsonb_agg(to_jsonb(e) order by organization_id, app_key) into before_rows
    from public.app_entitlements e
    where organization_id in (missing_id, revoked_id, expired_id)
      and (organization_id <> missing_id or app_key <> 'opera-plus');

  -- Run the same backfill twice, limited to these fixtures.
  for attempt in 1..2 loop
    insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
    select organization.id, 'opera-plus'::public.app_key, true, null
    from public.organizations as organization
    where organization.id in (missing_id, revoked_id, expired_id)
    on conflict (organization_id, app_key) do nothing;
  end loop;

  if not exists (select 1 from public.app_entitlements
    where organization_id = missing_id and app_key = 'opera-plus' and enabled and expires_at is null) then
    raise exception 'organization missing an entitlement did not receive OPERA+';
  end if;

  select jsonb_agg(to_jsonb(e) order by organization_id, app_key) into after_rows
    from public.app_entitlements e
    where organization_id in (missing_id, revoked_id, expired_id)
      and (organization_id <> missing_id or app_key <> 'opera-plus');
  if before_rows is distinct from after_rows then
    raise exception 'backfill modified an existing entitlement';
  end if;
end;
$$;

rollback;
