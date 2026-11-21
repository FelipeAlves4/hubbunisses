-- Disposable database only. All fixtures are rolled back.
begin;

insert into auth.users (id,email,raw_user_meta_data) values
  ('a9000000-0000-4000-8000-000000000001','agenda-admin@example.test','{"full_name":"Agenda Admin"}'),
  ('a9000000-0000-4000-8000-000000000002','agenda-member@example.test','{"full_name":"Agenda Member"}'),
  ('a9000000-0000-4000-8000-000000000003','agenda-other@example.test','{"full_name":"Agenda Other"}'),
  ('a9000000-0000-4000-8000-000000000004','agenda-no-org@example.test','{"full_name":"Agenda No Org"}');
insert into public.organizations (id,name,slug) values
  ('a9100000-0000-4000-8000-000000000001','Agenda A','agenda-fixture-a'),
  ('a9100000-0000-4000-8000-000000000002','Agenda B','agenda-fixture-b');
insert into public.organization_members (organization_id,user_id,role) values
  ('a9100000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','admin'),
  ('a9100000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002','member'),
  ('a9100000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000003','owner');
insert into public.app_entitlements (organization_id,app_key,enabled) values
  ('a9100000-0000-4000-8000-000000000001','agenda-plus',true),
  ('a9100000-0000-4000-8000-000000000002','agenda-plus',true);
insert into public.proposal_clients (id,organization_id,created_by,name,type) values
  ('a9200000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','Cliente um','individual'),
  ('a9200000-0000-4000-8000-000000000002','a9100000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000003','Cliente dois','individual');
insert into public.agenda_settings (organization_id,public_name,slug,timezone,public_enabled,min_notice_minutes,max_days)
values ('a9100000-0000-4000-8000-000000000001','Agenda A','agenda-fixture-book','UTC',true,0,180);
insert into public.agenda_services (id,organization_id,name,duration_minutes,price_cents,active) values
  ('a9300000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000001','Serviço ativo',30,12500,true),
  ('a9300000-0000-4000-8000-000000000002','a9100000-0000-4000-8000-000000000001','Serviço inativo',30,null,false),
  ('a9300000-0000-4000-8000-000000000003','a9100000-0000-4000-8000-000000000001','Serviço sem vínculo',30,null,true);
insert into public.agenda_professionals (id,organization_id,name,active) values
  ('a9400000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000001','Profissional ativo',true),
  ('a9400000-0000-4000-8000-000000000002','a9100000-0000-4000-8000-000000000001','Profissional inativo',false),
  ('a9400000-0000-4000-8000-000000000003','a9100000-0000-4000-8000-000000000002','Profissional externo',true);
insert into public.agenda_professional_services (organization_id,professional_id,service_id) values
  ('a9100000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001','a9300000-0000-4000-8000-000000000001'),
  ('a9100000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001','a9300000-0000-4000-8000-000000000002'),
  ('a9100000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000002','a9300000-0000-4000-8000-000000000001');
insert into public.agenda_working_hours (organization_id,professional_id,weekday,start_time,end_time)
select 'a9100000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',extract(dow from next_day),
  times.start_time,times.end_time
from (select (now() at time zone 'UTC')::date+1 next_day) d
cross join (values (time '09:00',time '12:00'),(time '13:00',time '17:00')) times(start_time,end_time);
insert into public.agenda_time_off (organization_id,professional_id,starts_at,ends_at) values
  ('a9100000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',
   (timezone('UTC',now())::date+1+time '10:00') at time zone 'UTC',(timezone('UTC',now())::date+1+time '10:30') at time zone 'UTC');

set local role authenticated;
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000002',true);
do $$
declare
  org constant uuid := 'a9100000-0000-4000-8000-000000000001';
  service constant uuid := 'a9300000-0000-4000-8000-000000000001';
  staff constant uuid := 'a9400000-0000-4000-8000-000000000001';
  client constant uuid := 'a9200000-0000-4000-8000-000000000001';
  tomorrow date := timezone('UTC',now())::date+1;
  morning timestamptz := (tomorrow+time '09:00') at time zone 'UTC';
  first_id uuid;
  second_id uuid;
  c uuid;
  rel text;
begin
  -- 11 starts before lunch, 15 after lunch, and 3 blocked starts excluded.
  if (select count(*) from public.agenda_available_slots(org,service,staff,tomorrow)) <> 23 then
    raise exception 'shift, pause, or block calculation failed';
  end if;
  if exists (select 1 from public.agenda_available_slots(org,service,staff,tomorrow) s
    where s.starts_at >= morning+interval '3 hours' and s.starts_at < morning+interval '4 hours'
      or s.starts_at >= morning+interval '45 minutes' and s.starts_at < morning+interval '90 minutes') then
    raise exception 'pause or blocked time displayed';
  end if;
  if exists (select 1 from public.agenda_available_slots(org,service,staff,tomorrow-2)) then raise exception 'past availability'; end if;
  if exists (select 1 from public.agenda_available_slots(org,service,staff,tomorrow+181)) then raise exception 'booking horizon ignored'; end if;
  if exists (select 1 from public.agenda_available_slots(org,'a9300000-0000-4000-8000-000000000002',staff,tomorrow))
    or exists (select 1 from public.agenda_available_slots(org,'a9300000-0000-4000-8000-000000000003',staff,tomorrow))
    or exists (select 1 from public.agenda_available_slots(org,service,'a9400000-0000-4000-8000-000000000002',tomorrow))
    or exists (select 1 from public.agenda_available_slots(org,service,'a9400000-0000-4000-8000-000000000003',tomorrow)) then
    raise exception 'inactive, unassigned, or foreign resource displayed';
  end if;
  begin
    insert into public.agenda_services (organization_id,name,duration_minutes) values (org,'Forbidden service',30);
    raise exception 'member changed configuration';
  exception when insufficient_privilege then null;
  end;
  insert into public.proposal_clients (organization_id,name,type) values (org,'Cliente interno sem documento','individual') returning id into c;
  if not exists (select 1 from public.proposal_clients where id=c and document_number is null and phone is null and email is null) then
    raise exception 'shared client creation failed';
  end if;
  begin
    perform public.agenda_book_internal(org,service,staff,morning,'a9200000-0000-4000-8000-000000000002',null);
    raise exception 'foreign client accepted';
  exception when foreign_key_violation then null;
  end;
  first_id := public.agenda_book_internal(org,service,staff,morning,client,null);
  second_id := public.agenda_book_internal(org,service,staff,morning+interval '30 minutes',c,null);
  if (select ends_at-starts_at from public.agenda_appointments where id=first_id) <> interval '30 minutes' then
    raise exception 'service duration was not applied';
  end if;
  begin
    perform public.agenda_book_internal(org,service,staff,morning+interval '15 minutes',client,null);
    raise exception 'overlap accepted';
  exception when exclusion_violation then null;
  end;
  begin
    perform public.agenda_change(org,first_id,'completed');
    raise exception 'invalid transition accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.agenda_change(org,first_id,'reschedule',morning+interval '2 hours',staff);
  perform public.agenda_change(org,second_id,'cancelled');
  perform public.agenda_book_internal(org,service,staff,morning+interval '30 minutes',client,null);
  if (select count(*) from public.agenda_appointment_events where appointment_id=first_id and actor_id=auth.uid()) <> 2
    or (select status from public.agenda_appointments where id=second_id) <> 'cancelled' then
    raise exception 'history or ownership lost';
  end if;
  if not exists (select 1 from public.agenda_capacity(org,tomorrow) where work_minutes = 390 and occupied_minutes = 60) then
    raise exception 'occupancy calculation failed';
  end if;
  foreach rel in array array['agenda_settings','agenda_services','agenda_professionals','agenda_professional_services',
    'agenda_working_hours','agenda_time_off','agenda_appointments','agenda_appointment_events'] loop
    if has_table_privilege(current_user,'public.'||rel,'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or has_any_column_privilege(current_user,'public.'||rel,'REFERENCES') then raise exception 'excess ACL on %',rel; end if;
    begin
      execute format('truncate public.%I cascade',rel);
      raise exception 'TRUNCATE was permitted for %',rel;
    exception when insufficient_privilege then null;
    end;
  end loop;
  if has_schema_privilege(current_user,'agenda_private','USAGE') then raise exception 'private schema exposed'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000003',true);
do $$
begin
  if exists (select 1 from public.agenda_appointments) then raise exception 'cross tenant appointment read'; end if;
  begin
    perform public.agenda_available_slots('a9100000-0000-4000-8000-000000000001',null,null,current_date);
    raise exception 'foreign private RPC accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000004',true);
do $$
begin
  if public.agenda_can_access('a9100000-0000-4000-8000-000000000001') then raise exception 'access without membership'; end if;
end;
$$;

set local role anon;
do $$
declare
  catalog jsonb;
  booked jsonb;
  start_at timestamptz := (timezone('UTC',now())::date+1+time '13:00') at time zone 'UTC';
  service constant uuid := 'a9300000-0000-4000-8000-000000000001';
  staff constant uuid := 'a9400000-0000-4000-8000-000000000001';
begin
  begin perform 1 from public.proposal_clients; raise exception 'public client data exposed';
    exception when insufficient_privilege then null; end;
  begin perform 1 from public.agenda_appointments; raise exception 'public appointment data exposed';
    exception when insufficient_privilege then null; end;
  begin perform public.agenda_book_internal(null,null,null,null,null,null); raise exception 'private RPC publicly executable';
    exception when insufficient_privilege then null; end;
  catalog := public.agenda_public_catalog('agenda-fixture-book');
  if catalog is null or catalog#>>'{services,0,price}' is not null
    or jsonb_array_length(catalog->'professionals') <> 1 then raise exception 'unexpected public catalog'; end if;
  if public.agenda_public_book('agenda-fixture-book',service,staff,start_at,'Test','bad-contact','email')->>'error'
    <> 'invalid_contact' then raise exception 'public input validation failed'; end if;
  booked := public.agenda_public_book('agenda-fixture-book',service,staff,start_at,'Guest','test@example.test','email');
  if booked->>'status' <> 'pending' or booked->>'reference' is null or booked ? 'contact' then
    raise exception 'invalid public reservation response';
  end if;
  if public.agenda_public_book('agenda-fixture-book',service,staff,start_at,'Guest','test@example.test','email')->>'error'
    <> 'unavailable' then raise exception 'public double booking'; end if;
  for i in 1..9 loop
    perform public.agenda_public_book('agenda-fixture-book',service,staff,start_at,'Test','bad-contact','email');
  end loop;
  if public.agenda_public_book('agenda-fixture-book',service,staff,start_at,'Guest','test@example.test','email')->>'error'
    <> 'rate_limit' then raise exception 'direct RPC bypassed the distributed rate limit'; end if;
end;
$$;

reset role;
do $$
declare
  rel text;
  api_role text;
  org constant uuid := 'a9100000-0000-4000-8000-000000000001';
  service constant uuid := 'a9300000-0000-4000-8000-000000000001';
  staff constant uuid := 'a9400000-0000-4000-8000-000000000001';
  slot timestamptz := (timezone('UTC',now())::date+1+time '09:30') at time zone 'UTC';
begin
  -- Exercise the GiST constraint independently of RPC availability checks.
  begin
    insert into public.agenda_appointments (organization_id,service_id,professional_id,starts_at,ends_at,status,origin)
      values (org,service,staff,slot,slot+interval '30 minutes','confirmed','internal');
    raise exception 'database accepted an overlapping interval';
  exception when exclusion_violation then null;
  end;
  foreach api_role in array array['anon','service_role'] loop
    foreach rel in array array['agenda_settings','agenda_services','agenda_professionals','agenda_professional_services',
      'agenda_working_hours','agenda_time_off','agenda_appointments','agenda_appointment_events'] loop
      if has_table_privilege(api_role,'public.'||rel,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        or has_any_column_privilege(api_role,'public.'||rel,'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'excess ACL for % on %',api_role,rel;
      end if;
    end loop;
  end loop;
end;
$$;

insert into public.agenda_appointments (organization_id,service_id,professional_id,starts_at,ends_at,status,origin) values
  ('a9100000-0000-4000-8000-000000000001','a9300000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',
    now()-interval '2 hours',now()-interval '90 minutes','confirmed','public'),
  ('a9100000-0000-4000-8000-000000000001','a9300000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',
    now()-interval '1 hour',now()-interval '30 minutes','confirmed','public');
set local role authenticated;
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
do $$
declare
  org constant uuid := 'a9100000-0000-4000-8000-000000000001';
  ids uuid[];
  request_id uuid;
begin
  select array_agg(id order by starts_at) into ids from public.agenda_appointments where starts_at<now();
  perform public.agenda_change(org,ids[1],'in_service');
  perform public.agenda_change(org,ids[1],'completed');
  perform public.agenda_change(org,ids[2],'no_show');
  select id into strict request_id from public.agenda_appointments where status='pending' and origin='public';
  if exists (select 1 from public.proposal_clients where name='Guest') then raise exception 'public booking created a CRM client'; end if;
  perform public.agenda_change(org,request_id,'confirmed');
  perform public.agenda_change(org,request_id,'link',null,null,'a9200000-0000-4000-8000-000000000001');
  if not exists (select 1 from public.agenda_appointments where id=request_id and client_id='a9200000-0000-4000-8000-000000000001') then
    raise exception 'CRM link not saved';
  end if;
  if exists (select 1 from public.agenda_appointment_events where details::text like '%example.test%') then raise exception 'contact leaked to audit'; end if;
end;
$$;

reset role;
do $$
declare
  org constant uuid := 'a9100000-0000-4000-8000-000000000001';
  service constant uuid := 'a9300000-0000-4000-8000-000000000001';
  staff constant uuid := 'a9400000-0000-4000-8000-000000000001';
  zone text;
  day date;
  day_hours numeric;
  repeated integer;
  observed integer := 0;
begin
  foreach zone in array array['America/New_York','Australia/Sydney'] loop
    select d, hours into day,day_hours from (
      select d, extract(epoch from (((d+1)::timestamp at time zone zone)-(d::timestamp at time zone zone))) / 3600 hours
      from (select (now() at time zone zone)::date+n d from generate_series(2,180) n) days
    ) transitions where hours <> 24 order by d limit 1;
    if not found then continue; end if;
    observed := observed+1;
    update public.agenda_settings set timezone=zone where organization_id=org;
    insert into public.agenda_working_hours (organization_id,professional_id,local_date,start_time,end_time)
      values (org,staff,day,'00:00','05:00');
    if not exists(select 1 from agenda_private.slots(org,service,staff,day)) then
      raise exception 'DST exception shift did not produce slots';
    end if;
    if exists(select 1 from agenda_private.slots(org,service,staff,day) s
      where (s.ends_at at time zone zone)-(s.starts_at at time zone zone)<>interval '30 minutes') then
      raise exception 'slot crossed a DST transition';
    end if;
    select count(*) into repeated from (select starts_at at time zone zone
      from agenda_private.slots(org,service,staff,day) group by 1 having count(*)>1) ties;
    if (day_hours>24 and repeated=0) or (day_hours<24 and repeated>0) then
      raise exception 'ambiguous local time handling failed';
    end if;
    delete from public.agenda_working_hours where organization_id=org and local_date=day;
  end loop;
  if observed=0 then raise exception 'no upcoming DST transition found for tests'; end if;
end;
$$;

update public.app_entitlements set created_at=now()-interval '2 days',expires_at=now()-interval '1 day'
where organization_id='a9100000-0000-4000-8000-000000000001' and app_key='agenda-plus';
set local role authenticated;
do $$
begin
  if public.agenda_can_access('a9100000-0000-4000-8000-000000000001')
    or public.agenda_public_catalog('agenda-fixture-book') is not null then
    raise exception 'expired entitlement retained private or public access';
  end if;
end;
$$;
reset role;
update public.app_entitlements set enabled=false where organization_id='a9100000-0000-4000-8000-000000000001' and app_key='agenda-plus';
delete from public.app_entitlements where organization_id='a9100000-0000-4000-8000-000000000002' and app_key='agenda-plus';
set local role authenticated;
do $$
begin
  if exists (select 1 from public.agenda_appointments) or public.agenda_public_catalog('agenda-fixture-book') is not null then
    raise exception 'revocation not effective';
  end if;
  perform set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000003',true);
  if public.agenda_can_access('a9100000-0000-4000-8000-000000000002') then raise exception 'access without entitlement'; end if;
end;
$$;
rollback;
