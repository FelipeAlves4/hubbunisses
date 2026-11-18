-- Controlled RLS regression suite for PROPOSTA+ document settings after 20261118024659.
-- It creates only TESTE records and ends with ROLLBACK.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333331', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-settings-owner-a@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('33333333-3333-4333-8333-333333333332', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-settings-owner-b@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-settings-member-a@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.organizations (id, name, slug) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'TESTE Documento A', 'teste-documento-a'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'TESTE Documento B', 'teste-documento-b'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'TESTE Documento Sem Vinculo', 'teste-documento-sem-vinculo');

insert into public.organization_members (organization_id, user_id, role) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333331', 'owner'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', '33333333-3333-4333-8333-333333333332', 'owner'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333333', 'member');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333331', true);

-- Owner A creates and alters A. The setting can be read back immediately.
insert into public.organization_proposal_document_settings
  (organization_id, trade_name, email, address, accent_color, default_template)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'TESTE Marca A', 'marca-a@example.test', 'Rua de Teste, 10', '#0A6EBD', 'minimal');

update public.organization_proposal_document_settings
set trade_name = 'TESTE Marca A Atualizada', accent_color = '#7C3AED', default_template = 'commercial'
where organization_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';

do $$
begin
  if (select trade_name from public.organization_proposal_document_settings where organization_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1') <> 'TESTE Marca A Atualizada' then
    raise exception 'owner A persistence failed';
  end if;
end $$;

-- Owner A cannot create a setting for B.
do $$
begin
  begin
    insert into public.organization_proposal_document_settings (organization_id, trade_name)
    values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'TESTE acesso cruzado');
    raise exception 'owner A cross-organization insert was accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- Owner B creates B; then owner A cannot see or alter it.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333332', true);
insert into public.organization_proposal_document_settings (organization_id, trade_name)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'TESTE Marca B');

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333331', true);
do $$
begin
  if (select count(*) from public.organization_proposal_document_settings where organization_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2') <> 0 then
    raise exception 'owner A can read B';
  end if;
  update public.organization_proposal_document_settings
  set trade_name = 'TESTE acesso cruzado'
  where organization_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
  if found then
    raise exception 'owner A cross-organization update was accepted';
  end if;
  begin
    update public.organization_proposal_document_settings
    set organization_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'
    where organization_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
    raise exception 'organization_id reassignment was accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- A member reads A, but cannot insert or edit it.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
do $$
begin
  if (select count(*) from public.organization_proposal_document_settings where organization_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1') <> 1 then
    raise exception 'member A cannot read A';
  end if;
  update public.organization_proposal_document_settings
  set trade_name = 'TESTE member update'
  where organization_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  if found then
    raise exception 'member A update was accepted';
  end if;
  begin
    insert into public.organization_proposal_document_settings (organization_id, trade_name)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'TESTE member insert');
    raise exception 'member A insert was accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- Owner B cannot read A.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333332', true);
do $$
begin
  if (select count(*) from public.organization_proposal_document_settings where organization_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1') <> 0 then
    raise exception 'owner B can read A';
  end if;
end $$;

-- The document identity/default template persist into a new proposal snapshot.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333331', true);
insert into public.proposal_clients (id, organization_id, created_by, name, type)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333331', 'TESTE Cliente Documento', 'company');
insert into public.proposals (id, organization_id, client_id, created_by, title)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc5', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4', '33333333-3333-4333-8333-333333333331', 'TESTE Snapshot Comercial');
do $$
begin
  if (select template from public.proposals where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5') <> 'commercial' then
    raise exception 'organization default template was not persisted';
  end if;
  if (select company_snapshot ->> 'trade_name' from public.proposals where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5') <> 'TESTE Marca A Atualizada' then
    raise exception 'document identity snapshot was not persisted';
  end if;
end $$;

-- Anonymous callers have neither table privileges nor RLS access.
set local role anon;
do $$
begin
  begin
    perform 1 from public.organization_proposal_document_settings;
    raise exception 'anonymous select was accepted';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.organization_proposal_document_settings (organization_id, trade_name)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'TESTE anon insert');
    raise exception 'anonymous insert was accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;

rollback;
