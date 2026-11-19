-- Run after 20261119131230_enable_nexo_finance_for_all_organizations.sql
-- against a disposable Supabase database.
-- The whole fixture is rolled back: no user, organization, entitlement or finance data persists.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nexo-rls-a@example.test', 'not-used', now(), '{}', '{}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nexo-rls-b@example.test', 'not-used', now(), '{}', '{}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nexo-rls-no-entitlement@example.test', 'not-used', now(), '{}', '{}', now(), now()),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nexo-rls-admin@example.test', 'not-used', now(), '{}', '{}', now(), now()),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nexo-rls-member@example.test', 'not-used', now(), '{}', '{}', now(), now()),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nexo-rls-no-membership@example.test', 'not-used', now(), '{}', '{}', now(), now());

insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'TESTE NEXO A', 'teste-nexo-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'TESTE NEXO B', 'teste-nexo-b'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'TESTE NEXO sem entitlement', 'teste-nexo-sem-entitlement');
insert into public.organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'owner'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '33333333-3333-4333-8333-333333333333', 'owner'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '44444444-4444-4444-8444-444444444444', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '55555555-5555-4555-8555-555555555555', 'member');
insert into public.app_entitlements (organization_id, app_key, enabled) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'nexo-finance', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'nexo-finance', true),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'nexo-finance', false)
on conflict (organization_id, app_key) do update
set enabled = excluded.enabled, expires_at = excluded.expires_at;

-- User A creates both categories and both transaction types, then pays a pending income.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into public.finance_categories (id, organization_id, created_by, name, kind) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'TESTE Vendas', 'income'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'TESTE Operação', 'expense');
insert into public.finance_transactions (id, organization_id, category_id, created_by, client_mutation_id, entry_type, description, amount_cents, issued_at, due_date, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'income', 'TESTE Receita', 125050, '2026-11-02', '2026-11-10', 'pending'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', 'expense', 'TESTE Despesa', 19990, '2026-11-03', '2026-11-12', 'pending');
update public.finance_transactions
set status = 'paid', paid_at = '2026-11-08', description = 'TESTE Receita paga'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';

do $$
begin
  if (select amount_cents from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 125050 then
    raise exception 'integer cents integrity failed';
  end if;
  if (select status from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 'paid'
    or (select paid_at from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> date '2026-11-08' then
    raise exception 'pending-to-paid transition failed';
  end if;
  begin
    insert into public.finance_transactions (organization_id, category_id, created_by, client_mutation_id, entry_type, description, amount_cents, issued_at, due_date, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'income', 'TESTE Duplicada', 1, '2026-11-02', '2026-11-10', 'pending');
    raise exception 'duplicate mutation id was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.finance_transactions (organization_id, category_id, created_by, client_mutation_id, entry_type, description, amount_cents, issued_at, due_date, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8', 'income', 'TESTE Valor inválido', 0, '2026-11-02', '2026-11-10', 'pending');
    raise exception 'zero cents was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.finance_transactions set status = 'paid', paid_at = null where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
    raise exception 'paid transaction without payment date was accepted';
  exception when check_violation then null;
  end;
end;
$$;
reset role;

-- Seed a category in B as the database owner, then prove the composite FK rejects it for A.
insert into public.finance_categories (id, organization_id, created_by, name, kind) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'TESTE Categoria B', 'income');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.finance_transactions (organization_id, category_id, created_by, client_mutation_id, entry_type, description, amount_cents, issued_at, due_date, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', 'income', 'TESTE Categoria cruzada', 1, '2026-11-02', '2026-11-10', 'pending');
    raise exception 'cross-organization category was accepted';
  exception when foreign_key_violation then null;
  end;
end;
$$;
delete from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
do $$
begin
  if exists (select 1 from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6') then
    raise exception 'creator could not delete own transaction';
  end if;
end;
$$;
reset role;

-- Active admins and members can use NEXO in their organization, but neither
-- role can modify a record authored by another member.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') then
    raise exception 'admin cannot read same-organization finance data';
  end if;
  insert into public.finance_categories (organization_id, created_by, name, kind)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '44444444-4444-4444-8444-444444444444', 'TESTE Admin', 'income');
  update public.finance_transactions set description = 'TESTE admin indevido' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  if found then raise exception 'admin modified another author transaction'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.finance_categories where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then
    raise exception 'member cannot read same-organization finance data';
  end if;
  insert into public.finance_categories (organization_id, created_by, name, kind)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '55555555-5555-4555-8555-555555555555', 'TESTE Membro', 'expense');
  delete from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  if found then raise exception 'member deleted another author transaction'; end if;
end;
$$;
reset role;

-- User B has a valid entitlement but cannot read, update or delete A's finance data.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.finance_categories where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then
    raise exception 'cross-tenant categories exposed';
  end if;
  if exists (select 1 from public.finance_transactions where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then
    raise exception 'cross-tenant transactions exposed';
  end if;
  update public.finance_transactions set description = 'TESTE acesso indevido' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  if found then raise exception 'cross-tenant update accepted'; end if;
  delete from public.finance_transactions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  if found then raise exception 'cross-tenant delete accepted'; end if;
end;
$$;
reset role;

-- An explicitly disabled entitlement is denied by RLS, not just by the route guard.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.finance_categories) or exists (select 1 from public.finance_transactions) then
    raise exception 'member without entitlement can read finance data';
  end if;
  begin
    insert into public.finance_categories (organization_id, created_by, name, kind)
    values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '33333333-3333-4333-8333-333333333333', 'TESTE bloqueada', 'income');
    raise exception 'member without entitlement can create a category';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- A signed-in user without any organization membership cannot read or write.
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.finance_categories) or exists (select 1 from public.finance_transactions) then
    raise exception 'user without membership can read finance data';
  end if;
  begin
    insert into public.finance_categories (organization_id, created_by, name, kind)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '66666666-6666-4666-8666-666666666666', 'TESTE sem associação', 'income');
    raise exception 'user without membership can create a category';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- anon has no table privileges and no rows.
set local role anon;
do $$
begin
  begin
    perform 1 from public.finance_transactions;
    raise exception 'anon select was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.finance_categories (organization_id, created_by, name, kind)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'TESTE anônima', 'income');
    raise exception 'anon insert was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
