-- Execute after the CLIENTA+ migration in a controlled Supabase environment.
-- Mirrors the existing transaction/rollback RLS test convention.
begin;

-- This fixture is self-contained and leaves no data behind after ROLLBACK.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clienta-rls-a@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS CLIENTA A"}', now(), now()),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clienta-rls-b@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS CLIENTA B"}', now(), now()),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clienta-rls-member@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS CLIENTA Member"}', now(), now());

insert into public.organizations (id, name, slug) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'TESTE CLIENTA+ RLS A', 'teste-clienta-rls-a'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'TESTE CLIENTA+ RLS B', 'teste-clienta-rls-b');
insert into public.organization_members (organization_id, user_id, role) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333333', 'owner'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '55555555-5555-4555-8555-555555555555', 'member'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', '44444444-4444-4444-8444-444444444444', 'owner');
insert into public.app_entitlements (organization_id, app_key, enabled) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'clienta-plus', true)
on conflict (organization_id, app_key) do update
set enabled = excluded.enabled, expires_at = null;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

insert into public.proposal_clients (id, organization_id, created_by, name, type)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333333', 'TESTE Cliente CLIENTA', 'company');
insert into public.proposals (id, organization_id, client_id, created_by, title)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '33333333-3333-4333-8333-333333333333', 'TESTE Proposta CLIENTA');

insert into public.crm_opportunities (id, organization_id, client_id, created_by, title, estimated_value_cents)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc8', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '33333333-3333-4333-8333-333333333333', 'TESTE oportunidade CRM', 125000);
insert into public.crm_activities (organization_id, opportunity_id, created_by, activity_type, body, due_date)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8', '33333333-3333-4333-8333-333333333333', 'follow_up', 'Retornar contato', current_date - 1);
insert into public.crm_opportunity_proposals (organization_id, opportunity_id, proposal_id, linked_by)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4', '33333333-3333-4333-8333-333333333333');
update public.crm_opportunities set stage = 'qualification' where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8';

do $$
begin
  if (select count(*) from public.crm_activities where opportunity_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8' and activity_type = 'stage_changed') <> 1 then
    raise exception 'stage history was not recorded';
  end if;
  if (select count(*) from public.crm_activities where opportunity_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8' and activity_type = 'follow_up' and completed_at is null and due_date < current_date) <> 1 then
    raise exception 'overdue follow-up calculation fixture failed';
  end if;
  if (select count(*) from public.crm_opportunity_proposals where opportunity_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8' and proposal_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4') <> 1 then
    raise exception 'proposal link failed';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
do $$
begin
  update public.proposal_clients set name = 'TESTE forbidden author' where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
  if found then raise exception 'non-author client update accepted'; end if;
end $$;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
do $$
begin
  if (select count(*) from public.crm_opportunities) <> 0 then raise exception 'cross-tenant opportunities exposed'; end if;
  if (select count(*) from public.crm_activities) <> 0 then raise exception 'cross-tenant activities exposed'; end if;
  if (select count(*) from public.crm_opportunity_proposals) <> 0 then raise exception 'cross-tenant proposal links exposed'; end if;
  update public.crm_opportunities set title = 'TESTE forbidden' where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8';
  if found then raise exception 'cross-tenant opportunity update accepted'; end if;
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
