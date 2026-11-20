-- Run after 20261119202123_enable_clienta_plus_for_all_organizations.sql in a controlled
-- environment. Every record below is rolled back.
begin;

do $$
declare
  owner_id uuid := '11111111-aaaa-4111-8111-111111111111';
  other_user_id uuid := '22222222-bbbb-4222-8222-222222222222';
  target_organization_id uuid := 'aaaaaaaa-cccc-4aaa-8aaa-aaaaaaaaaaa1';
  other_organization_id uuid := 'bbbbbbbb-dddd-4bbb-8bbb-bbbbbbbbbbb2';
  future_organization_id uuid;
  expected_apps constant public.app_key[] := array[
    'clienta-plus', 'nexo-finance', 'precifica-plus', 'proposta-plus'
  ]::public.app_key[];
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'entitlement-owner@example.test', 'not-used', now(), '{}', '{}', now(), now()),
    (other_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'entitlement-other@example.test', 'not-used', now(), '{}', '{}', now(), now());

  insert into public.organizations (id, name, slug) values
    (target_organization_id, 'TESTE Entitlements A', 'teste-entitlements-a'),
    (other_organization_id, 'TESTE Entitlements B', 'teste-entitlements-b');
  insert into public.organization_members (organization_id, user_id, role) values
    (target_organization_id, owner_id, 'owner'),
    (other_organization_id, other_user_id, 'owner');

  insert into public.app_entitlements (organization_id, app_key, enabled)
  values (target_organization_id, 'precifica-plus', false);

  insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
  select organization.id, application.app_key::public.app_key, true, null
  from public.organizations as organization
  cross join (values ('precifica-plus'), ('proposta-plus')) as application(app_key)
  where organization.id in (target_organization_id, other_organization_id)
  on conflict (organization_id, app_key) do update
  set enabled = excluded.enabled, expires_at = excluded.expires_at;

  if (select count(*) from public.app_entitlements where organization_id = target_organization_id and app_key in ('precifica-plus', 'proposta-plus') and enabled) <> 2 then
    raise exception 'core entitlements were not enabled for organization A';
  end if;
  if (select count(*) from public.app_entitlements where organization_id = other_organization_id and app_key in ('precifica-plus', 'proposta-plus') and enabled) <> 2 then
    raise exception 'core entitlements were not enabled for organization B';
  end if;
  if (select count(*) from public.app_entitlements where organization_id in (target_organization_id, other_organization_id) and app_key = 'nexo-finance' and enabled) <> 2 then
    raise exception 'NEXO Finance was not granted to existing organizations';
  end if;

  if (select count(*) from public.app_entitlements where organization_id in (target_organization_id, other_organization_id) and app_key = 'clienta-plus' and enabled and expires_at is null) <> 2 then
    raise exception 'CLIENTA+ was not provisioned without expiration for both organizations';
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  if (select array_agg(app_key order by app_key::text)
      from public.app_entitlements where organization_id = target_organization_id and enabled)
      is distinct from expected_apps then
    raise exception 'owner cannot read all enabled entitlements';
  end if;
  begin
    update public.app_entitlements
    set enabled = false
    where organization_id = target_organization_id and app_key = 'proposta-plus';
    raise exception 'client-side entitlement mutation was accepted';
  exception
    when insufficient_privilege then null;
  end;

  select (public.create_organization('TESTE Entitlements Futura')).id
  into future_organization_id;
  if (select array_agg(app_key order by app_key::text)
      from public.app_entitlements where organization_id = future_organization_id and enabled)
      is distinct from expected_apps then
    raise exception 'new organization did not receive all core entitlements';
  end if;
  reset role;

  -- The backfill is intentionally idempotent: never overwrite a local
  -- revocation when the migration or provisioning is evaluated again.
  update public.app_entitlements
  set enabled = false
  where organization_id = target_organization_id
    and app_key = 'nexo-finance';
  insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
  values (target_organization_id, 'nexo-finance', true, null)
  on conflict (organization_id, app_key) do nothing;
  if (select enabled from public.app_entitlements where organization_id = target_organization_id and app_key = 'nexo-finance') then
    raise exception 'explicit NEXO Finance revocation was overwritten';
  end if;

  perform set_config('request.jwt.claim.sub', other_user_id::text, true);
  set local role authenticated;
  if exists (select 1 from public.app_entitlements where organization_id = target_organization_id) then
    raise exception 'cross-organization entitlement access was accepted';
  end if;
  reset role;
end;
$$;

rollback;
