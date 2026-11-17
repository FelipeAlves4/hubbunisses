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
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'TESTE Serviço', 'service', 'hora', 100);
update public.proposal_catalog_items set default_price = 125 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

insert into public.proposals (id, organization_id, client_id, created_by, title, additional_total, tax_rate)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'TESTE Proposta RLS', 10, 5);
insert into public.proposal_items (id, organization_id, proposal_id, catalog_item_id, description, quantity, unit, unit_price, discount_amount, total, sort_order)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'TESTE Serviço', 2, 'hora', 125, 20, 230, 0),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', null, 'TESTE Item removível', 1, 'unidade', 50, 0, 50, 1);
delete from public.proposal_items where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
update public.proposals set status = 'sent', additional_total = 10, tax_rate = 5 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';

do $$
begin
  if (select count(*) from public.proposal_clients) <> 1 then raise exception 'client scope failed'; end if;
  if (select count(*) from public.proposal_catalog_items) <> 1 then raise exception 'catalog scope failed'; end if;
  if (select count(*) from public.proposals) <> 1 or (select count(*) from public.proposal_items) <> 1 then raise exception 'proposal persistence failed'; end if;
  if (select subtotal from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 230 then raise exception 'subtotal calculation failed'; end if;
  if (select discount_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 20 then raise exception 'discount calculation failed'; end if;
  if (select tax_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 12 then raise exception 'tax calculation failed'; end if;
  if (select grand_total from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 252 then raise exception 'grand total calculation failed'; end if;
  if (select status from public.proposals where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 'sent' then raise exception 'status change failed'; end if;
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
