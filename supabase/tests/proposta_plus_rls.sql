-- Run after both PROPOSTA+ migrations in a controlled environment.
-- It executes data operations as the authenticated Postgres role and rolls back
-- all users, organizations and PROPOSTA+ records at the end.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'proposta-rls-a@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Proposta A"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'proposta-rls-b@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Proposta B"}', now(), now());

insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'TESTE PROPOSTA+ RLS A', 'teste-proposta-rls-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'TESTE PROPOSTA+ RLS B', 'teste-proposta-rls-b');
insert into public.organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.proposal_clients (id, organization_id, created_by, name, type, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'TESTE Cliente A', 'company', 'cliente-a@example.test');
update public.proposal_clients set contact_name = 'Contato A' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
insert into public.proposal_catalog_items (id, organization_id, created_by, name, kind, unit, default_price)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'TESTE Serviço', 'service', 'hora', 19.99);
update public.proposal_catalog_items set default_price = 19.99 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

insert into public.proposals (id, organization_id, client_id, created_by, title, additional_total, tax_rate)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'TESTE Proposta RLS', 10, 5);
insert into public.proposal_items (id, organization_id, proposal_id, catalog_item_id, description, quantity, unit, unit_price, discount_amount, total, sort_order)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'TESTE Serviço', 3, 'hora', 19.99, 0.02, 59.95, 0),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', null, 'TESTE Item removível', 1, 'unidade', 50, 0, 50, 1);

do $$
begin
  if (select subtotal from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 109.95 then raise exception 'item insert subtotal failed'; end if;
  if (select discount_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 0.02 then raise exception 'item insert discount failed'; end if;
  if (select tax_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 6.00 then raise exception 'item insert tax failed'; end if;
  if (select grand_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 125.95 then raise exception 'item insert total failed'; end if;
end $$;

update public.proposal_items
set quantity = 2.5, unit_price = 19.99, discount_amount = 0.03, total = 49.95
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
do $$
begin
  if (select subtotal from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 99.95 then raise exception 'item update subtotal failed'; end if;
  if (select discount_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 0.03 then raise exception 'item update discount failed'; end if;
  if (select tax_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 5.50 then raise exception 'item update tax failed'; end if;
  if (select grand_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 115.45 then raise exception 'item update total failed'; end if;
end $$;

delete from public.proposal_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
do $$
begin
  if (select subtotal from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 49.95 then raise exception 'item delete subtotal failed'; end if;
  if (select tax_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 3.00 then raise exception 'item delete tax failed'; end if;
  if (select grand_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 62.95 then raise exception 'item delete total failed'; end if;
end $$;

update public.proposals set status = 'sent', additional_total = 15.50, tax_rate = 7.25 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';

do $$
begin
  if (select count(*) from public.proposal_clients) <> 1 then raise exception 'client scope failed'; end if;
  if (select count(*) from public.proposal_catalog_items) <> 1 then raise exception 'catalog scope failed'; end if;
  if (select count(*) from public.proposals) <> 1 or (select count(*) from public.proposal_items) <> 1 then raise exception 'proposal persistence failed'; end if;
  if (select subtotal from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 49.95 then raise exception 'proposal update subtotal failed'; end if;
  if (select discount_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 0.03 then raise exception 'proposal update discount failed'; end if;
  if (select tax_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 4.75 then raise exception 'proposal update tax failed'; end if;
  if (select grand_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 70.20 then raise exception 'proposal update total failed'; end if;
  if (select status from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 'sent' then raise exception 'status change failed'; end if;
end $$;

insert into public.proposals (id, organization_id, client_id, created_by, title)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'TESTE Exclusão em cascata');
insert into public.proposal_items (organization_id, proposal_id, description, quantity, unit, unit_price, discount_amount, total, sort_order)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', 'TESTE Item em cascata', 1, 'unidade', 1, 0, 1, 0);
delete from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7';
do $$
begin
  if exists (select 1 from public.proposal_items where proposal_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7') then raise exception 'proposal cascade delete left items'; end if;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$
begin
  if (select count(*) from public.proposal_clients) <> 0 then raise exception 'cross-tenant clients exposed'; end if;
  if (select count(*) from public.proposal_catalog_items) <> 0 then raise exception 'cross-tenant catalog exposed'; end if;
  if (select count(*) from public.proposals) <> 0 then raise exception 'cross-tenant proposals exposed'; end if;
  if (select count(*) from public.proposal_items) <> 0 then raise exception 'cross-tenant items exposed'; end if;
  update public.proposals set title = 'TESTE forbidden' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  if found then raise exception 'cross-tenant proposal update accepted'; end if;
  update public.proposal_items set description = 'TESTE forbidden' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  if found then raise exception 'cross-tenant item update accepted'; end if;
end $$;

rollback;
