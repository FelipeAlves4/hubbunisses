-- Execute after the CLIENTA+ general-entitlement migration. The fixture is
-- self-contained and leaves no organizations, users, entitlements, or CRM data.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clienta-general-a@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clienta-general-b@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Simulate an existing organization that lacks CLIENTA+, then apply the same
-- idempotent backfill used by the migration.
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000010', 'TESTE CLIENTA GERAL EXISTENTE', 'teste-clienta-geral-existente'),
  ('bbbbbbbb-0000-4000-8000-000000000020', 'TESTE CLIENTA GERAL REVOGADA', 'teste-clienta-geral-revogada');
delete from public.app_entitlements
where organization_id = 'aaaaaaaa-0000-4000-8000-000000000010'::uuid
  and app_key = 'clienta-plus'::public.app_key;
insert into public.app_entitlements (organization_id, app_key, enabled)
values ('bbbbbbbb-0000-4000-8000-000000000020', 'clienta-plus'::public.app_key, false)
on conflict (organization_id, app_key) do update set enabled = false, expires_at = null;

insert into public.app_entitlements (organization_id, app_key, enabled, expires_at)
select organization.id, 'clienta-plus'::public.app_key, true, null
from public.organizations as organization
where organization.id in ('aaaaaaaa-0000-4000-8000-000000000010'::uuid, 'bbbbbbbb-0000-4000-8000-000000000020'::uuid)
on conflict (organization_id, app_key) do nothing;

do $$
begin
  if not exists (
    select 1 from public.app_entitlements
    where organization_id = 'aaaaaaaa-0000-4000-8000-000000000010'::uuid
      and app_key = 'clienta-plus'::public.app_key
      and enabled
      and expires_at is null
  ) then
    raise exception 'missing existing organization was not enabled for CLIENTA+';
  end if;

  if not exists (
    select 1 from public.app_entitlements
    where organization_id = 'bbbbbbbb-0000-4000-8000-000000000020'::uuid
      and app_key = 'clienta-plus'::public.app_key
      and not enabled
  ) then
    raise exception 'explicitly disabled CLIENTA+ entitlement was overwritten';
  end if;
end $$;

-- A newly inserted organization must receive CLIENTA+ automatically.
insert into public.organizations (id, name, slug)
values ('cccccccc-0000-4000-8000-000000000030', 'TESTE CLIENTA GERAL FUTURA', 'teste-clienta-geral-futura');

do $$
begin
  if not exists (
    select 1 from public.app_entitlements
    where organization_id = 'cccccccc-0000-4000-8000-000000000030'::uuid
      and app_key = 'clienta-plus'::public.app_key
      and enabled
      and expires_at is null
  ) then
    raise exception 'new organization was not provisioned for CLIENTA+';
  end if;
end $$;

insert into public.organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner'),
  ('bbbbbbbb-0000-4000-8000-000000000020', 'bbbbbbbb-0000-4000-8000-000000000002', 'owner'),
  ('cccccccc-0000-4000-8000-000000000030', 'bbbbbbbb-0000-4000-8000-000000000002', 'owner');
insert into public.proposal_clients (id, organization_id, created_by, name, type)
values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000001', 'Cliente A', 'company'),
  ('bbbbbbbb-0000-4000-8000-000000000021', 'bbbbbbbb-0000-4000-8000-000000000020', 'bbbbbbbb-0000-4000-8000-000000000002', 'Cliente B', 'company');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
insert into public.crm_opportunities (organization_id, client_id, created_by, title)
values ('aaaaaaaa-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000001', 'Oportunidade isolada');

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.crm_opportunities where organization_id = 'aaaaaaaa-0000-4000-8000-000000000010'::uuid) <> 0 then
    raise exception 'CRM data crossed organization boundary';
  end if;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.crm_opportunities;
    raise exception 'anonymous CRM access accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
