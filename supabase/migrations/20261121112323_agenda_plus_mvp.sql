-- This migration adds the feature key without granting any organization access.
alter type public.app_key add value if not exists 'agenda-plus';
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions, pg_catalog;
create schema agenda_private;
revoke all on schema agenda_private from public, anon, authenticated, service_role;

create table public.agenda_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  public_name text not null check (length(trim(public_name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  timezone text not null default 'America/Sao_Paulo',
  public_enabled boolean not null default false,
  min_notice_minutes integer not null default 60 check (min_notice_minutes between 0 and 10080),
  max_days integer not null default 30 check (max_days between 1 and 180),
  cancellation_policy text check (length(cancellation_policy) <= 1200),
  show_prices boolean not null default false,
  auto_confirm boolean not null default false,
  contact_mode text not null default 'either' check (contact_mode in ('email','phone','either')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agenda_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  description text check (length(description) <= 1000),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer check (price_cents between 0 and 100000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.agenda_professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  description text check (length(description) <= 1000),
  member_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, member_id) references public.organization_members(organization_id, user_id) on delete set null (member_id)
);

create table public.agenda_professional_services (
  organization_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, professional_id, service_id),
  foreign key (organization_id, professional_id) references public.agenda_professionals(organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.agenda_services(organization_id, id) on delete cascade
);

-- Separate rows on one weekday represent a split shift. Dated shifts replace that weekday.
create table public.agenda_working_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  professional_id uuid not null,
  weekday smallint check (weekday between 0 and 6),
  local_date date check (isfinite(local_date)),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(weekday, local_date) = 1 and end_time > start_time),
  check (extract(second from start_time) = 0 and extract(second from end_time) = 0),
  foreign key (organization_id, professional_id) references public.agenda_professionals(organization_id, id) on delete cascade
);
create index agenda_shifts_lookup on public.agenda_working_hours (organization_id, professional_id, local_date, weekday);

create table public.agenda_time_off (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (length(reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at),
  foreign key (organization_id, professional_id) references public.agenda_professionals(organization_id, id) on delete cascade
);
create index agenda_time_off_lookup on public.agenda_time_off (organization_id, professional_id, starts_at);

create table public.agenda_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  service_id uuid not null,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in ('pending','confirmed','in_service','completed','cancelled','no_show')),
  origin text not null check (origin in ('internal','public')),
  created_by uuid references auth.users(id) on delete set null,
  guest_name text check (length(guest_name) between 2 and 120),
  guest_contact text check (length(guest_contact) <= 254),
  notes text check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at),
  foreign key (organization_id, client_id) references public.proposal_clients(organization_id, id) on delete set null (client_id),
  foreign key (organization_id, service_id) references public.agenda_services(organization_id, id),
  foreign key (organization_id, professional_id) references public.agenda_professionals(organization_id, id),
  exclude using gist (organization_id with =, professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status in ('pending','confirmed','in_service','completed','no_show'))
);
create index agenda_appointments_range on public.agenda_appointments (organization_id, starts_at, id);
create index agenda_appointments_client on public.agenda_appointments (organization_id, client_id, starts_at);

create table public.agenda_appointment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  appointment_id uuid not null,
  kind text not null,
  actor_id uuid references auth.users(id) on delete set null,
  origin text not null check (origin in ('internal','public')),
  details jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  foreign key (organization_id, appointment_id) references public.agenda_appointments(organization_id, id) on delete cascade
);
create index agenda_events_lookup on public.agenda_appointment_events (organization_id, appointment_id, created_at);

create table agenda_private.rate_limits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('read','book')),
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (organization_id, kind)
);
revoke all on agenda_private.rate_limits from public, anon, authenticated, service_role;

create function public.agenda_can_access(org uuid, managers_only boolean default false)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m join public.app_entitlements e using (organization_id)
    where m.organization_id = org and m.user_id = (select auth.uid())
      and (not managers_only or m.role in ('owner','admin'))
      and e.app_key::text = 'agenda-plus' and e.enabled and (e.expires_at is null or e.expires_at > now())
  );
$$;
revoke all on function public.agenda_can_access(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.agenda_can_access(uuid,boolean) to authenticated;

-- Configuration writes and bookings in an organization share a transaction lock.
create function agenda_private.lock_org(org uuid) returns void language sql set search_path = ''
as $$ select pg_advisory_xact_lock(hashtextextended('agenda:' || org::text, 0)); $$;

create function agenda_private.configure() returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform agenda_private.lock_org(old.organization_id);
    return old;
  end if;
  perform agenda_private.lock_org(new.organization_id);
  new.updated_at := now();
  if tg_table_name = 'agenda_settings' then
    if new.timezone !~ '^[A-Za-z_]+([/+_-][A-Za-z0-9_-]+)*$' or not exists
      (select 1 from pg_timezone_names where name = new.timezone and name not like 'posix/%' and name not like 'right/%') then
      raise exception 'Fuso horário IANA inválido' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
-- Trigger functions run with the migration owner, with no direct RPC privilege.
alter function agenda_private.configure() security definer;

do $$
declare
  rel text;
  writable text;
begin
  foreach rel in array array['agenda_settings','agenda_services','agenda_professionals','agenda_professional_services',
    'agenda_working_hours','agenda_time_off','agenda_appointments','agenda_appointment_events'] loop
    execute format('alter table public.%I enable row level security',rel);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',rel);
    execute format('grant select on public.%I to authenticated',rel);
    execute format('create policy agenda_read on public.%I for select to authenticated using (public.agenda_can_access(organization_id))',rel);
    if rel in ('agenda_appointments','agenda_appointment_events') then continue; end if;
    execute format('create policy agenda_manage on public.%I for all to authenticated using (public.agenda_can_access(organization_id,true)) with check (public.agenda_can_access(organization_id,true))',rel);
    select string_agg(quote_ident(column_name), ', ') into writable from information_schema.columns
      where table_schema = 'public' and table_name = rel and column_name not in ('organization_id','id','created_at','updated_at');
    execute format('grant insert (organization_id,%s) on public.%I to authenticated',writable,rel);
    if rel in ('agenda_professional_services','agenda_working_hours','agenda_time_off') then
      execute format('grant delete on public.%I to authenticated',rel);
    end if;
    if rel <> 'agenda_professional_services' then
      execute format('grant update (%s) on public.%I to authenticated',writable,rel);
    end if;
    execute format('create trigger agenda_configure before insert or update or delete on public.%I for each row execute function agenda_private.configure()',rel);
  end loop;
end;
$$;

create function agenda_private.record_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.agenda_appointment_events (organization_id, appointment_id, kind, actor_id, origin, details)
    values (new.organization_id, new.id, 'created', new.created_by, new.origin,
      jsonb_build_object('status',new.status,'starts_at',new.starts_at,'professional_id',new.professional_id));
  else
    insert into public.agenda_appointment_events (organization_id, appointment_id, kind, actor_id, origin, details)
    values (new.organization_id,new.id,
      case when new.status <> old.status then new.status when new.starts_at <> old.starts_at
        or new.professional_id <> old.professional_id then 'rescheduled' else 'client_link_changed' end,
      auth.uid(),'internal',jsonb_build_object('from_status',old.status,'to_status',new.status,
        'from_start',old.starts_at,'to_start',new.starts_at,'from_professional',old.professional_id,'to_professional',new.professional_id));
  end if;
  return new;
end;
$$;
create trigger agenda_record_event after insert or update on public.agenda_appointments
  for each row execute function agenda_private.record_event();

-- The UI requests these same slots that booking revalidates. DST folds use
-- distinct UTC instants. Slots crossing an offset transition are excluded.
create function agenda_private.slots(org uuid, service uuid, professional uuid, day date, ignore_id uuid default null)
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
    where slot >= now() + make_interval(mins=>min_notice_minutes)
  )
  select c.slot,c.finish from candidates c
  where c.wall_start::date=day and c.wall_end-c.wall_start=make_interval(mins=>c.duration_minutes)
    and exists (select 1 from shifts h where c.wall_start >= day+h.start_time and c.wall_end <= day+h.end_time
      and extract(epoch from (c.wall_start - (day+h.start_time)))::integer % 900 = 0)
    and not exists (select 1 from public.agenda_time_off b where b.organization_id=org and b.professional_id=professional
      and b.starts_at<c.finish and b.ends_at>c.slot)
    and not exists (select 1 from public.agenda_appointments a where a.organization_id=org and a.professional_id=professional
      and a.id is distinct from ignore_id and a.status<>'cancelled' and a.starts_at<c.finish and a.ends_at>c.slot)
  order by c.slot;
$$;

create function public.agenda_available_slots(org uuid, service uuid, professional uuid, day date, ignore_id uuid default null)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  if ignore_id is not null and not exists (select 1 from public.agenda_appointments a
    where a.organization_id=org and a.id=ignore_id and (a.created_by=auth.uid() or public.agenda_can_access(org,true))) then
    raise insufficient_privilege;
  end if;
  return query select s.starts_at,s.ends_at from agenda_private.slots(org,service,professional,day,ignore_id) s;
end;
$$;

create function public.agenda_calendar_bounds(org uuid, start_day date, end_day date)
returns table (range_start timestamptz, range_end timestamptz)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  if end_day-start_day not between 1 and 42 then raise exception 'Período inválido' using errcode='22023'; end if;
  return query select start_day::timestamp at time zone coalesce(s.timezone,'America/Sao_Paulo'),
    end_day::timestamp at time zone coalesce(s.timezone,'America/Sao_Paulo')
    from (values (org)) v(id) left join public.agenda_settings s on s.organization_id=v.id;
end;
$$;

create function agenda_private.reserve(org uuid, service uuid, professional uuid, start_at timestamptz,
  client uuid, guest text, contact text, internal_notes text, source text, booking_id uuid default null)
returns uuid language plpgsql set search_path = ''
as $$
declare
  config public.agenda_settings%rowtype;
  finish timestamptz;
  result uuid;
begin
  perform agenda_private.lock_org(org);
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

create function public.agenda_book_internal(org uuid, service uuid, professional uuid, start_at timestamptz,
  client uuid, notes text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  if not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  if client is null then raise exception 'Selecione um cliente' using errcode='22023'; end if;
  return agenda_private.reserve(org,service,professional,start_at,client,null,null,notes,'internal');
end;
$$;

create function public.agenda_change(org uuid, appointment uuid, action text, new_start timestamptz default null,
  new_professional uuid default null, new_client uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare item public.agenda_appointments%rowtype;
begin
  if not public.agenda_can_access(org) then raise insufficient_privilege; end if;
  perform agenda_private.lock_org(org);
  select * into item from public.agenda_appointments a where a.organization_id=org and a.id=appointment for update;
  if not found or not (coalesce(item.created_by=auth.uid(),false) or public.agenda_can_access(org,true)) then
    raise insufficient_privilege;
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

-- Database-backed fixed windows apply equally to direct calls and all app instances.
-- Buckets are bounded to two rows per existing organization.
create function agenda_private.allow_public(org uuid, action_kind text, ceiling integer)
returns boolean language plpgsql set search_path = ''
as $$
declare
  current_window timestamptz := date_trunc('minute', clock_timestamp());
  allowed integer;
begin
  insert into agenda_private.rate_limits as r (organization_id,kind,window_start,hits)
  values (org,action_kind,current_window,1)
  on conflict (organization_id,kind) do update set
    window_start=greatest(r.window_start,excluded.window_start),
    hits=case when r.window_start<excluded.window_start then 1 else r.hits+1 end
  where r.window_start<excluded.window_start or r.hits<ceiling
  returning hits into allowed;
  return allowed is not null;
end;
$$;

create function agenda_private.public_config(public_slug text)
returns public.agenda_settings language sql stable set search_path = ''
as $$
  select s from public.agenda_settings s join public.app_entitlements e using (organization_id)
  where s.slug=public_slug and s.public_enabled and e.app_key::text='agenda-plus' and e.enabled
    and (e.expires_at is null or e.expires_at>now())
$$;

create function public.agenda_public_catalog(public_slug text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c public.agenda_settings := agenda_private.public_config(public_slug);
begin
  if c.organization_id is null then return null; end if;
  if not agenda_private.allow_public(c.organization_id,'read',240) then return jsonb_build_object('error','rate_limit'); end if;
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

create function public.agenda_public_slots(public_slug text, service uuid, professional uuid, day date)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c public.agenda_settings := agenda_private.public_config(public_slug);
begin
  if c.organization_id is null then return null; end if;
  if not agenda_private.allow_public(c.organization_id,'read',240) then return jsonb_build_object('error','rate_limit'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at)
    from agenda_private.slots(c.organization_id,service,professional,day) s),'[]');
end;
$$;

create function public.agenda_public_book(public_slug text, service uuid, professional uuid, start_at timestamptz,
  guest text, contact text, channel text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.agenda_settings := agenda_private.public_config(public_slug);
  result uuid;
begin
  if c.organization_id is null then return jsonb_build_object('error','unavailable'); end if;
  if not agenda_private.allow_public(c.organization_id,'book',12) then return jsonb_build_object('error','rate_limit'); end if;
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
  return (select jsonb_build_object('reference',a.id,'status',a.status) from public.agenda_appointments a where a.id=result);
end;
$$;

revoke all on all functions in schema agenda_private from public, anon, authenticated, service_role;
revoke all on function public.agenda_available_slots(uuid,uuid,uuid,date,uuid), public.agenda_calendar_bounds(uuid,date,date),
  public.agenda_book_internal(uuid,uuid,uuid,timestamptz,uuid,text), public.agenda_change(uuid,uuid,text,timestamptz,uuid,uuid),
  public.agenda_public_catalog(text), public.agenda_public_slots(text,uuid,uuid,date),
  public.agenda_public_book(text,uuid,uuid,timestamptz,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.agenda_available_slots(uuid,uuid,uuid,date,uuid), public.agenda_calendar_bounds(uuid,date,date),
  public.agenda_book_internal(uuid,uuid,uuid,timestamptz,uuid,text), public.agenda_change(uuid,uuid,text,timestamptz,uuid,uuid) to authenticated;
grant execute on function public.agenda_public_catalog(text), public.agenda_public_slots(text,uuid,uuid,date),
  public.agenda_public_book(text,uuid,uuid,timestamptz,text,text,text) to anon, authenticated;

-- Occupancy is measured in scheduled professional-minutes, excluding blocks.
create function public.agenda_capacity(org uuid, day date)
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
      where a.organization_id=org and a.professional_id=p.id and a.status<>'cancelled'
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
revoke all on function public.agenda_capacity(uuid,date) from public, anon, authenticated, service_role;
grant execute on function public.agenda_capacity(uuid,date) to authenticated;
