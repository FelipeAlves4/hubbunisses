-- Run on a disposable Supabase database after the migrations.
begin;

-- Allow the authenticated probe to create a table in an isolated test schema.
-- A foreign key must still fail for lack of REFERENCES on each OPERA+ table.
create schema opera_acl_probe;
grant usage, create on schema opera_acl_probe to authenticated;
create function opera_acl_probe.marker() returns trigger language plpgsql as $$
begin return new; end;
$$;
grant execute on function opera_acl_probe.marker() to authenticated;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('f1000000-0000-4000-8000-000000000001', 'opera-member@example.test', '{"full_name":"Operador"}'),
  ('f1000000-0000-4000-8000-000000000002', 'opera-admin@example.test', '{"full_name":"Admin OPERA"}'),
  ('f1000000-0000-4000-8000-000000000003', 'opera-outsider@example.test', '{"full_name":"Outra organização"}'),
  ('f1000000-0000-4000-8000-000000000004', 'opera-peer@example.test', '{"full_name":"Colega OPERA"}'),
  ('f1000000-0000-4000-8000-000000000005', 'opera-no-org@example.test', '{"full_name":"Sem organização"}');

insert into public.organizations (id, name, slug) values
  ('f2000000-0000-4000-8000-000000000001', 'Operações A', 'opera-tests-a'),
  ('f2000000-0000-4000-8000-000000000002', 'Operações B', 'opera-tests-b');

insert into public.organization_members (organization_id, user_id, role) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'member'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'admin'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000004', 'member'),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'owner');

insert into public.app_entitlements (organization_id, app_key, enabled) values
  ('f2000000-0000-4000-8000-000000000001', 'opera-plus', true),
  ('f2000000-0000-4000-8000-000000000002', 'opera-plus', false),
  ('f2000000-0000-4000-8000-000000000001', 'proposta-plus', true)
on conflict (organization_id, app_key) do update set enabled = excluded.enabled, expires_at = null;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
insert into public.proposal_clients (id, organization_id, name)
values ('f3000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000002', 'Cliente B');
insert into public.proposals (id, organization_id, client_id, title, status)
values ('f4000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000002',
  'f3000000-0000-4000-8000-000000000003', 'Proposta B', 'approved');

do $$
begin
  begin
    insert into public.service_orders (organization_id, client_id, title)
    values ('f2000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000003', 'Sem entitlement');
    raise exception 'write allowed with disabled entitlement';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
insert into public.proposal_clients (id, organization_id, name) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Cliente A'),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'Outro Cliente A');
insert into public.proposals (id, organization_id, client_id, title, status, client_snapshot) values
  ('f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001',
   'f3000000-0000-4000-8000-000000000001', 'Proposta aprovada', 'approved', '{"name":"Snapshot original"}'),
  ('f4000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001',
   'f3000000-0000-4000-8000-000000000001', 'Proposta em rascunho', 'draft', '{}');

do $$
declare
  org constant uuid := 'f2000000-0000-4000-8000-000000000001';
  client constant uuid := 'f3000000-0000-4000-8000-000000000001';
  os constant uuid := 'f5000000-0000-4000-8000-000000000001';
  proposal constant uuid := 'f4000000-0000-4000-8000-000000000001';
  task constant uuid := 'f6000000-0000-4000-8000-000000000001';
  peer constant uuid := 'f1000000-0000-4000-8000-000000000004';
  original_proposal jsonb;
begin
  select to_jsonb(p) into strict original_proposal from public.proposals p where p.id = proposal;
  insert into public.service_orders (id, organization_id, client_id, title, proposal_id, estimated_value)
    values (os, org, client, 'Instalação', proposal, 1250.47);
  if not exists (select 1 from public.service_orders where id = os and number = 1 and created_by = auth.uid() and estimated_value = 1250.47) then
    raise exception 'invalid first order';
  end if;

  begin
    insert into public.service_orders (id, organization_id, client_id, title) values (os, org, client, 'Mesmo envio');
    raise exception 'duplicate request accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.service_orders (organization_id, client_id, title, proposal_id) values (org, client, 'Outra conversão', proposal);
    raise exception 'duplicate conversion accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.service_orders (organization_id, client_id, title, proposal_id)
      values (org, client, 'Rascunho', 'f4000000-0000-4000-8000-000000000002');
    raise exception 'draft proposal accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.service_orders (organization_id, client_id, title, proposal_id)
      values (org, client, 'Proposta externa', 'f4000000-0000-4000-8000-000000000003');
    raise exception 'foreign proposal accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.service_orders (organization_id, client_id, title, proposal_id)
      values (org, 'f3000000-0000-4000-8000-000000000002', 'Cliente divergente', proposal);
    raise exception 'proposal with mismatched client accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.service_orders (organization_id, client_id, title)
      values (org, 'f3000000-0000-4000-8000-000000000003', 'Cliente externo');
    raise exception 'foreign client accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.service_orders set responsible_user_id = 'f1000000-0000-4000-8000-000000000003' where id = os;
    raise exception 'foreign assignee accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.service_orders set start_date = current_date + 1, due_date = current_date where id = os;
    raise exception 'invalid deadline accepted';
  exception when check_violation then null;
  end;

  insert into public.service_orders (organization_id, client_id, title) values (org, client, 'Manutenção');
  if (select max(number) from public.service_orders) <> 2 then raise exception 'sequence skipped number'; end if;

  update public.service_orders set status = 'in_progress', responsible_user_id = peer, due_date = current_date + 2, notes = 'Cliente avisado' where id = os;
  update public.service_orders set status = 'completed' where id = os;
  if not exists (select 1 from public.service_orders where id = os and completed_at is not null) then raise exception 'completion missing'; end if;
  update public.service_orders set status = 'pending' where id = os;
  if not exists (select 1 from public.service_orders where id = os and completed_at is null) then raise exception 'reopening failed'; end if;

  insert into public.service_order_tasks (id, organization_id, order_id, description, responsible_user_id)
    values (task, org, os, 'Conferir instalação', peer);
  update public.service_order_tasks set done = true where id = task;
  if not exists (select 1 from public.service_order_tasks where id = task and done and completed_at is not null and created_by = auth.uid()) then
    raise exception 'invalid task completion';
  end if;
  update public.service_order_tasks set done = false where id = task;
  if not exists (select 1 from public.service_order_tasks where id = task and not done and completed_at is null) then raise exception 'task reopening failed'; end if;

  if (select count(*) from public.service_order_events where order_id = os and actor_id = auth.uid()) <> 10 then
    raise exception 'wrong history transitions or author';
  end if;
  if not exists (select 1 from public.service_order_events where order_id = os and event_type = 'notes_changed' and details->>'notes' = 'Cliente avisado') then
    raise exception 'note event missing';
  end if;
  if not exists (select 1 from public.proposals p where p.id = proposal and to_jsonb(p) = original_proposal) then
    raise exception 'existing proposal data changed';
  end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000004', true);
do $$
begin
  if (select count(*) from public.service_orders) <> 2 then raise exception 'peer read denied'; end if;
  update public.service_orders set title = 'Mudança proibida';
  if found then raise exception 'peer edited order'; end if;
  update public.service_order_tasks set done = true;
  if found then raise exception 'peer edited task'; end if;
  delete from public.service_order_tasks;
  if found then raise exception 'peer deleted task'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
do $$
declare
  relation text;
  statement text;
begin
  update public.service_orders set title = 'Revista pelo admin' where number = 1;
  if not found then raise exception 'admin cannot edit'; end if;

  foreach relation in array array['service_orders', 'service_order_tasks', 'service_order_events', 'service_order_sequences'] loop
    if has_table_privilege(current_user, 'public.' || relation, 'REFERENCES,TRIGGER,MAINTAIN,TRUNCATE') then
      raise exception 'administrative grant detected on %', relation;
    end if;
    foreach statement in array array[
      format('truncate table public.%I cascade', relation),
      format('create trigger test_injected before update on public.%I for each row execute function opera_acl_probe.marker()', relation),
      format('create table opera_acl_probe.parent_reference (target uuid references public.%I (%I))',
        relation, case when relation = 'service_order_sequences' then 'organization_id' else 'id' end)
    ] loop
      begin
        execute statement;
        raise exception 'administrative operation allowed: %', statement;
      exception when insufficient_privilege then null;
      end;
    end loop;
    -- PostgreSQL reports an unprivileged ANALYZE as a warning. It must not
    -- have MAINTAIN implicitly or through any inherited role.
    execute format('analyze public.%I', relation);
  end loop;

  foreach statement in array array[
    'insert into public.service_order_events default values',
    'update public.service_order_events set details = ''{}''',
    'delete from public.service_order_events',
    'update public.service_orders set created_by = auth.uid()',
    'update public.service_orders set number = 100',
    'update public.service_order_tasks set created_by = auth.uid()',
    'delete from public.service_orders',
    'select * from public.service_order_sequences'
  ] loop
    begin
      execute statement;
      raise exception 'unauthorized operation allowed: %', statement;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

reset role;
update public.app_entitlements set enabled = true
where app_key = 'opera-plus' and organization_id = 'f2000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.service_orders) or exists (select 1 from public.service_order_events)
    or exists (select 1 from public.service_order_tasks) then
    raise exception 'tenant data leaked';
  end if;
  if exists (select 1 from public.opera_team('f2000000-0000-4000-8000-000000000001')) then raise exception 'foreign team leaked'; end if;
  insert into public.service_orders (organization_id, client_id, title)
    values ('f2000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000003', 'Primeira do outro tenant');
  if (select number from public.service_orders) <> 1 then raise exception 'tenant sequence not independent'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000005', true);
do $$
begin
  if exists (select 1 from public.service_orders) then raise exception 'orders visible without membership'; end if;
  begin
    insert into public.service_orders (organization_id, client_id, title)
      values ('f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'Sem organização');
    raise exception 'write allowed without membership';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
do $$
begin
  delete from public.service_order_tasks;
  if not found then raise exception 'admin cannot delete tasks'; end if;
  if not exists (select 1 from public.service_order_events where event_type = 'task_completed') then raise exception 'task history removed'; end if;
end $$;

reset role;
update public.app_entitlements set created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where app_key = 'opera-plus' and organization_id = 'f2000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
begin
  if exists (select 1 from public.service_orders) then raise exception 'expired entitlement gave access'; end if;
end $$;

set local role anon;
do $$
declare relation text;
begin
  foreach relation in array array['service_orders', 'service_order_tasks', 'service_order_events', 'service_order_sequences'] loop
    begin
      execute format('select * from public.%I', relation);
      raise exception 'anonymous access allowed: %', relation;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

rollback;
