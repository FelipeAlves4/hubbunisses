-- Pending holds expire after 15 minutes or at the appointment start, whichever comes first.
alter table public.agenda_appointments add column expires_at timestamptz;
alter table public.agenda_appointments drop constraint agenda_appointments_status_check;
alter table public.agenda_appointments add constraint agenda_appointments_status_check
  check (status in ('pending','confirmed','in_service','completed','cancelled','no_show','expired'));
create or replace function agenda_private.record_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.agenda_appointment_events (organization_id, appointment_id, kind, actor_id, origin, details)
    values (new.organization_id, new.id, 'created', new.created_by, new.origin,
      jsonb_build_object('status',new.status,'starts_at',new.starts_at,'professional_id',new.professional_id));
  elsif (new.status,new.starts_at,new.professional_id,new.client_id)
    is distinct from (old.status,old.starts_at,old.professional_id,old.client_id) then
    insert into public.agenda_appointment_events (organization_id, appointment_id, kind, actor_id, origin, details)
    values (new.organization_id,new.id,
      case when new.status <> old.status then new.status when new.starts_at <> old.starts_at
        or new.professional_id <> old.professional_id then 'rescheduled' else 'client_link_changed' end,
      case when new.status='expired' then null else auth.uid() end,'internal',jsonb_build_object('from_status',old.status,'to_status',new.status,
        'from_start',old.starts_at,'to_start',new.starts_at,'from_professional',old.professional_id,'to_professional',new.professional_id));
  end if;
  return new;
end;
$$;

update public.agenda_appointments set expires_at=least(created_at+interval '15 minutes',starts_at)
where status='pending';
alter table public.agenda_appointments add constraint agenda_pending_requires_expiration
  check (status<>'pending' or (expires_at is not null and isfinite(expires_at) and expires_at<=starts_at));
create index agenda_pending_expiration on public.agenda_appointments(organization_id,professional_id,expires_at)
  where status='pending';

create function agenda_private.pending_hold() returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op='INSERT' and new.status='pending' then
    new.expires_at := least(clock_timestamp()+interval '15 minutes',new.starts_at);
  elsif tg_op='UPDATE' and old.status='pending' then
    if (new.status='confirmed' or (new.status='pending' and
        (new.starts_at<>old.starts_at or new.professional_id<>old.professional_id)))
      and old.expires_at<=clock_timestamp() then
      raise exception 'O prazo para confirmar esta reserva expirou' using errcode='55000';
    end if;
    if new.status='pending' then new.expires_at := least(old.expires_at,new.expires_at,new.starts_at); end if;
  end if;
  return new;
end;
$$;
revoke all on function agenda_private.pending_hold() from public, anon, authenticated, service_role;
create trigger agenda_pending_hold before insert or update on public.agenda_appointments
for each row execute function agenda_private.pending_hold();

-- SQL availability ignores expired holds immediately. The writer materializes
-- expiration before inserting so the static GiST exclusion still protects
-- every live hold and every confirmed appointment.
create or replace function agenda_private.slots(org uuid, service uuid, professional uuid, day date, ignore_id uuid default null)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable set search_path = ''
as $$
  with config as (
    select s.timezone tz, s.min_notice_minutes, s.max_days, a.duration_minutes
    from public.agenda_settings s
    join public.agenda_services a on a.organization_id=s.organization_id and a.id=service and a.active
    join public.agenda_professionals p on p.organization_id=s.organization_id and p.id=professional and p.active
    join public.agenda_professional_services x on x.organization_id=s.organization_id and x.service_id=a.id and x.professional_id=p.id
    where s.organization_id=org and day between (now() at time zone s.timezone)::date
      and (now() at time zone s.timezone)::date + s.max_days
  ), shifts as (
    select h.start_time, h.end_time from public.agenda_working_hours h
    where h.organization_id=org and h.professional_id=professional and (
      h.local_date=day or (h.local_date is null and h.weekday=extract(dow from day) and not exists (
        select 1 from public.agenda_working_hours d where d.organization_id=org and d.professional_id=professional and d.local_date=day
      ))
    )
  ), candidates as (
    select slot, slot + make_interval(mins=>duration_minutes) finish,
      timezone(tz,slot) wall_start, timezone(tz,slot + make_interval(mins=>duration_minutes)) wall_end,
      duration_minutes
    from config cross join lateral generate_series(
      (day::timestamp at time zone tz) - interval '3 hours',
      ((day+1)::timestamp at time zone tz) + interval '3 hours', interval '1 minute'
    ) slot
    where slot >= clock_timestamp() + make_interval(mins=>min_notice_minutes)
  )
  select c.slot,c.finish from candidates c
  where c.wall_start::date=day and c.wall_end-c.wall_start=make_interval(mins=>c.duration_minutes)
    and exists (select 1 from shifts h where c.wall_start >= day+h.start_time and c.wall_end <= day+h.end_time
      and extract(epoch from (c.wall_start - (day+h.start_time)))::integer % 900 = 0)
    and not exists (select 1 from public.agenda_time_off b where b.organization_id=org and b.professional_id=professional
      and b.starts_at<c.finish and b.ends_at>c.slot)
    and not exists (select 1 from public.agenda_appointments a where a.organization_id=org and a.professional_id=professional
      and a.id is distinct from ignore_id and a.status not in ('cancelled','expired')
      and (a.status<>'pending' or a.expires_at>clock_timestamp()) and a.starts_at<c.finish and a.ends_at>c.slot)
  order by c.slot;
$$;

create or replace function agenda_private.reserve(org uuid, service uuid, professional uuid, start_at timestamptz,
  client uuid, guest text, contact text, internal_notes text, source text, booking_id uuid default null)
returns uuid language plpgsql set search_path = ''
as $$
declare
  config public.agenda_settings%rowtype;
  finish timestamptz;
  result uuid;
begin
  perform agenda_private.lock_org(org);
  if source='internal' and not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  update public.agenda_appointments a set status='expired',updated_at=clock_timestamp()
    where a.organization_id=org and a.professional_id=professional and a.status='pending'
      and a.expires_at<=clock_timestamp() and a.id is distinct from booking_id;
  select * into config from public.agenda_settings s where s.organization_id=org;
  if not found then raise exception 'Configure a agenda primeiro' using errcode='22023'; end if;
  if source='public' and not (config.public_enabled and exists (
    select 1 from public.app_entitlements e where e.organization_id=org and e.app_key::text='agenda-plus'
      and e.enabled and (e.expires_at is null or e.expires_at>now())
  )) then raise insufficient_privilege; end if;
  select sl.ends_at into finish from agenda_private.slots(org,service,professional,(start_at at time zone config.timezone)::date,booking_id) sl
    where sl.starts_at=start_at;
  if finish is null then raise exception 'Horário indisponível' using errcode='23P01'; end if;
  if booking_id is null then
    insert into public.agenda_appointments (organization_id,service_id,professional_id,client_id,starts_at,ends_at,status,
      origin,created_by,guest_name,guest_contact,notes)
    values (org,service,professional,client,start_at,finish,
      case when source='public' and not config.auto_confirm then 'pending' else 'confirmed' end,
      source,case when source='internal' then auth.uid() end,guest,contact,internal_notes) returning id into result;
  else
    update public.agenda_appointments a set professional_id=professional,starts_at=start_at,ends_at=finish,updated_at=now()
      where a.organization_id=org and a.id=booking_id returning id into result;
  end if;
  return result;
end;
$$;

create or replace function public.agenda_change(org uuid, appointment uuid, action text, new_start timestamptz default null,
  new_professional uuid default null, new_client uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare item public.agenda_appointments%rowtype;
begin
  if not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  perform agenda_private.lock_org(org);
  if not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  select * into item from public.agenda_appointments a where a.organization_id=org and a.id=appointment for update;
  if not found or not (coalesce(item.created_by=auth.uid(),false) or public.agenda_can_access(org,true)) then
    raise insufficient_privilege;
  end if;
  if item.status='pending' and item.expires_at<=clock_timestamp() and action in ('confirmed','reschedule') then
    raise exception 'O prazo para confirmar esta reserva expirou' using errcode='55000';
  end if;
  if action='reschedule' and item.status in ('pending','confirmed') then
    perform agenda_private.reserve(org,item.service_id,coalesce(new_professional,item.professional_id),
      new_start,null,null,null,null,'internal',item.id);
  elsif action='link' and new_client is not null then
    update public.agenda_appointments set client_id=new_client,updated_at=now() where id=item.id and client_id is distinct from new_client;
  elsif (item.status='pending' and action in ('confirmed','cancelled'))
    or (item.status='confirmed' and action in ('in_service','cancelled','no_show'))
    or (item.status='in_service' and action='completed') then
    if action in ('in_service','no_show') and item.starts_at>now() then
      raise exception 'O horário do atendimento ainda não chegou' using errcode='22023';
    end if;
    update public.agenda_appointments set status=action,updated_at=now() where id=item.id;
  else
    raise exception 'Transição de agendamento inválida' using errcode='22023';
  end if;
end;
$$;

create or replace function public.agenda_capacity(org uuid, day date)
returns table (work_minutes bigint, occupied_minutes bigint)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  if day is null or not isfinite(day) then raise exception 'Data inválida' using errcode='22023'; end if;
  return query
    with minutes as (
      select m.tick, timezone(s.timezone,m.tick) wall_time
      from public.agenda_settings s cross join lateral generate_series(
        (day::timestamp at time zone s.timezone)-interval '3 hours',
        ((day+1)::timestamp at time zone s.timezone)+interval '3 hours',interval '1 minute'
      ) m(tick)
      where s.organization_id=org and timezone(s.timezone,m.tick)::date=day
    )
    select count(*), count(*) filter (where exists (select 1 from public.agenda_appointments a
      where a.organization_id=org and a.professional_id=p.id and a.status not in ('cancelled','expired')
        and (a.status<>'pending' or a.expires_at>clock_timestamp())
        and m.tick>=a.starts_at and m.tick<a.ends_at))
    from minutes m cross join public.agenda_professionals p
    where p.organization_id=org and p.active
      and exists (select 1 from public.agenda_professional_services l join public.agenda_services s
        on s.organization_id=l.organization_id and s.id=l.service_id and s.active
        where l.organization_id=org and l.professional_id=p.id)
      and exists (select 1 from public.agenda_working_hours h where h.organization_id=org and h.professional_id=p.id
        and m.wall_time>=day+h.start_time and m.wall_time<day+h.end_time
        and (h.local_date=day or (h.weekday=extract(dow from day) and not exists (
          select 1 from public.agenda_working_hours d where d.organization_id=org and d.professional_id=p.id and d.local_date=day))))
      and not exists (select 1 from public.agenda_time_off b where b.organization_id=org and b.professional_id=p.id
        and b.starts_at<m.tick+interval '1 minute' and b.ends_at>m.tick);
end;
$$;


-- Provision the same secret in this private singleton and in the Portal's
-- server-only AGENDA_ORIGIN_SECRET. There is deliberately no default secret.
create table agenda_private.origin_secret (
  singleton boolean primary key default true check (singleton),
  secret text not null check (secret ~ '^[0-9a-f]{64}$')
);
create table agenda_private.origin_limits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('read','book')),
  origin_key text not null check (origin_key ~ '^[0-9a-f]{64}$'),
  hits integer not null check (hits>0),
  primary key (organization_id,kind,origin_key)
);
revoke all on agenda_private.origin_secret, agenda_private.origin_limits from public, anon, authenticated, service_role;

-- pgcrypto can be installed in public or extensions depending on the stack.
do $$
declare crypto_schema text;
begin
  select n.nspname into strict crypto_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pgcrypto';
  execute format('create function agenda_private.origin_mac(value text, secret text)
    returns bytea language sql immutable strict set search_path = ''''
    as %L', format('select %I.hmac(value,secret,''sha256'')',crypto_schema));
end;
$$;

create function agenda_private.verify_origin(public_slug text, action_name text, origin_key text, issued_at bigint, proof text)
returns boolean language plpgsql set search_path = ''
as $$
declare
  secret text;
  now_epoch bigint := extract(epoch from clock_timestamp())::bigint;
  expected bytea;
  supplied bytea;
  diff integer := 0;
begin
  if public_slug is null or public_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
    or origin_key is null or origin_key !~ '^[0-9a-f]{64}$' or proof is null or proof !~ '^[0-9a-f]{64}$'
    or issued_at is null or issued_at < now_epoch-60 or issued_at > now_epoch+5 then return false; end if;
  select s.secret into secret from agenda_private.origin_secret s where s.singleton;
  if secret is null then return false; end if;
  expected := agenda_private.origin_mac('agenda-v1|'||action_name||'|'||public_slug||'|'||origin_key||'|'||issued_at,secret);
  supplied := decode(proof,'hex');
  for i in 0..31 loop
    diff := diff | (get_byte(expected,i) # get_byte(supplied,i));
  end loop;
  return coalesce(diff=0,false);
end;
$$;

-- Rejected origins do not consume the collective budget. The collective
-- bucket bounds the number of origin rows admitted in the current window.
create function agenda_private.allow_origin(org uuid, action_kind text, origin text, total integer, per_origin integer)
returns boolean language plpgsql set search_path = ''
as $$
declare
  minute_start timestamptz;
  previous_window timestamptz;
  admitted integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('agenda-public:'||org::text||':'||action_kind,0));
  minute_start := date_trunc('minute',clock_timestamp());
  select window_start into previous_window from agenda_private.rate_limits
    where organization_id=org and kind=action_kind;
  if previous_window is null or previous_window<minute_start then
    delete from agenda_private.origin_limits where organization_id=org and kind=action_kind;
  end if;
  if exists(select 1 from agenda_private.origin_limits where organization_id=org and kind=action_kind
    and origin_key=origin and hits>=per_origin) then return false; end if;
  insert into agenda_private.rate_limits as r(organization_id,kind,window_start,hits)
    values(org,action_kind,minute_start,1) on conflict(organization_id,kind) do update set
      window_start=excluded.window_start,
      hits=case when r.window_start<excluded.window_start then 1 else r.hits+1 end
    where r.window_start<excluded.window_start or r.hits<total returning hits into admitted;
  if admitted is null then return false; end if;
  insert into agenda_private.origin_limits as r(organization_id,kind,origin_key,hits)
    values(org,action_kind,origin,1) on conflict(organization_id,kind,origin_key) do update set hits=r.hits+1;
  return true;
end;
$$;

-- Remove the unsigned entry points so callers cannot bypass the origin gate.
drop function public.agenda_public_catalog(text);
drop function public.agenda_public_slots(text,uuid,uuid,date);
drop function public.agenda_public_book(text,uuid,uuid,timestamptz,text,text,text);

create function public.agenda_public_catalog(public_slug text, origin_key text, issued_at bigint, proof text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c public.agenda_settings := agenda_private.public_config(public_slug);
begin
  if not agenda_private.verify_origin(public_slug,'catalog',origin_key,issued_at,proof) then
    return jsonb_build_object('error','unavailable');
  end if;
  if c.organization_id is null then return null; end if;
  if not agenda_private.allow_origin(c.organization_id,'read',origin_key,240,30) then return jsonb_build_object('error','rate_limit'); end if;
  return jsonb_build_object('name',c.public_name,'timezone',c.timezone,'maxDays',c.max_days,
    'policy',c.cancellation_policy,'contactMode',c.contact_mode,
    'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,
      'duration',s.duration_minutes,'price',case when c.show_prices then s.price_cents end) order by s.name,s.id)
      from public.agenda_services s where s.organization_id=c.organization_id and s.active),'[]'),
    'professionals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'services',
      array(select x.service_id from public.agenda_professional_services x where x.organization_id=c.organization_id and x.professional_id=p.id))
      order by p.name,p.id) from public.agenda_professionals p where p.organization_id=c.organization_id and p.active),'[]'));
end;
$$;

create function public.agenda_public_slots(public_slug text, service uuid, professional uuid, day date, origin_key text, issued_at bigint, proof text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c public.agenda_settings := agenda_private.public_config(public_slug);
begin
  if not agenda_private.verify_origin(public_slug,'slots',origin_key,issued_at,proof) then
    return jsonb_build_object('error','unavailable');
  end if;
  if c.organization_id is null then return null; end if;
  if not agenda_private.allow_origin(c.organization_id,'read',origin_key,240,30) then return jsonb_build_object('error','rate_limit'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at)
    from agenda_private.slots(c.organization_id,service,professional,day) s),'[]');
end;
$$;

create function public.agenda_public_book(public_slug text, service uuid, professional uuid, start_at timestamptz,
  guest text, contact text, channel text, origin_key text, issued_at bigint, proof text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.agenda_settings := agenda_private.public_config(public_slug);
  result uuid;
begin
  if not agenda_private.verify_origin(public_slug,'book',origin_key,issued_at,proof) then
    return jsonb_build_object('error','unavailable');
  end if;
  if c.organization_id is null then return jsonb_build_object('error','unavailable'); end if;
  if not agenda_private.allow_origin(c.organization_id,'book',origin_key,12,3) then return jsonb_build_object('error','rate_limit'); end if;
  if guest is null or length(trim(guest)) not between 2 and 120 or contact is null
    or channel is null or channel not in ('email','phone') or c.contact_mode not in ('either',channel)
    or (channel='email' and (length(contact)>254 or contact !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    or (channel='phone' and (length(contact)>30 or contact !~ '^[+0-9 ()-]+$'
      or length(regexp_replace(contact,'[^0-9]','','g')) not between 8 and 15)) then
    return jsonb_build_object('error','invalid_contact');
  end if;
  begin
    result := agenda_private.reserve(c.organization_id,service,professional,start_at,null,trim(guest),trim(contact),null,'public');
  exception when exclusion_violation or insufficient_privilege then
    return jsonb_build_object('error','unavailable');
  end;
  return (select jsonb_build_object('reference',a.id,'status',a.status,'expires_at',a.expires_at) from public.agenda_appointments a where a.id=result);
end;
$$;

revoke all on function agenda_private.origin_mac(text,text), agenda_private.verify_origin(text,text,text,bigint,text),
  agenda_private.allow_origin(uuid,text,text,integer,integer) from public, anon, authenticated, service_role;
revoke all on function public.agenda_public_catalog(text,text,bigint,text),
  public.agenda_public_slots(text,uuid,uuid,date,text,bigint,text),
  public.agenda_public_book(text,uuid,uuid,timestamptz,text,text,text,text,bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.agenda_public_catalog(text,text,bigint,text),
  public.agenda_public_slots(text,uuid,uuid,date,text,bigint,text),
  public.agenda_public_book(text,uuid,uuid,timestamptz,text,text,text,text,bigint,text) to anon, authenticated;
