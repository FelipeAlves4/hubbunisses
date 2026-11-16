-- Run only against a disposable linked Supabase environment after applying migrations.
-- The transaction rolls back the temporary auth users, organizations, and simulations.
begin;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  visible_count integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', user_a, 'authenticated', 'authenticated', 'rls-a@example.test', 'not-used', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', user_b, 'authenticated', 'authenticated', 'rls-b@example.test', 'not-used', now(), '{}', '{}', now(), now());

  insert into public.organizations (id, name, slug)
  values (org_a, 'Empresa A', 'empresa-a-test'), (org_b, 'Empresa B', 'empresa-b-test');
  insert into public.organization_members (organization_id, user_id, role)
  values (org_a, user_a, 'owner'), (org_b, user_b, 'owner');
  insert into public.pricing_simulations (organization_id, created_by, kind, name, assumptions, result)
  values
    (org_a, user_a, 'product', 'Somente A', '{"name":"A","acquisitionCost":1,"packagingCost":0,"freightPerUnit":0,"otherDirectCosts":0,"fixedExpensePerUnit":0,"commissionRate":0,"taxRate":0,"paymentFeeRate":0,"desiredMarginRate":0}', '{}'),
    (org_b, user_b, 'product', 'Somente B', '{"name":"B","acquisitionCost":1,"packagingCost":0,"freightPerUnit":0,"otherDirectCosts":0,"fixedExpensePerUnit":0,"commissionRate":0,"taxRate":0,"paymentFeeRate":0,"desiredMarginRate":0}', '{}');

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into visible_count from public.pricing_simulations;
  if visible_count <> 1 then
    raise exception 'RLS isolation failed: user A sees % rows, expected 1', visible_count;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  set local role authenticated;
  select count(*) into visible_count from public.pricing_simulations where organization_id = org_a;
  if visible_count <> 0 then
    raise exception 'RLS isolation failed: user B can read Empresa A';
  end if;
  reset role;
end;
$$;

rollback;
