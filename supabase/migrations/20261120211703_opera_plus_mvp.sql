-- Adds the OPERA+ schema. Entitlement provisioning is separate.
alter type public.app_key add value if not exists 'opera-plus';
create schema if not exists opera_private;
revoke all on schema opera_private from public, anon, authenticated, service_role;

create type public.service_order_status as enum ('pending', 'planned', 'in_progress', 'waiting', 'completed', 'cancelled');
create type public.service_order_priority as enum ('low', 'medium', 'high', 'urgent');

create function public.has_active_opera_access(target_org uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    join public.app_entitlements e using (organization_id)
    where m.organization_id = target_org and m.user_id = (select auth.uid())
      and e.app_key::text = 'opera-plus' and e.enabled
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

create function public.can_manage_service_order(target_org uuid, creator uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select public.has_active_opera_access(target_org)
    and (creator = (select auth.uid()) or exists (
      select 1 from public.organization_members
      where organization_id = target_org and user_id = (select auth.uid()) and role in ('owner', 'admin')
    ));
$$;

alter table public.proposals add constraint proposals_org_client_id_unique unique (organization_id, client_id, id);

create table public.service_order_sequences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_number bigint not null check (last_number > 0)
);

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number bigint not null check (number > 0),
  title text not null check (char_length(trim(title)) between 1 and 220),
  description text check (char_length(description) <= 8000),
  client_id uuid not null,
  proposal_id uuid,
  responsible_user_id uuid,
  priority public.service_order_priority not null default 'medium',
  status public.service_order_status not null default 'pending',
  start_date date,
  due_date date,
  completed_at timestamptz,
  estimated_value numeric(14,2) check (estimated_value between 0 and 999999999999.99),
  notes text check (char_length(notes) <= 8000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  unique (organization_id, proposal_id),
  foreign key (organization_id, client_id) references public.proposal_clients(organization_id, id),
  foreign key (organization_id, client_id, proposal_id)
    references public.proposals(organization_id, client_id, id) on delete set null (proposal_id),
  foreign key (organization_id, responsible_user_id)
    references public.organization_members(organization_id, user_id) on delete set null (responsible_user_id),
  check (isfinite(start_date)),
  check (isfinite(due_date)),
  check (due_date >= start_date),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.service_order_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  description text not null check (char_length(trim(description)) between 1 and 2000),
  responsible_user_id uuid,
  due_date date,
  done boolean not null default false,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, order_id) references public.service_orders(organization_id, id) on delete cascade,
  foreign key (organization_id, responsible_user_id)
    references public.organization_members(organization_id, user_id) on delete set null (responsible_user_id),
  check (isfinite(due_date)),
  check (done = (completed_at is not null))
);

create table public.service_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  foreign key (organization_id, order_id) references public.service_orders(organization_id, id) on delete cascade
);

create index service_orders_org_created_idx on public.service_orders (organization_id, created_at desc, id);
create index service_orders_org_status_due_idx on public.service_orders (organization_id, status, due_date);
create index service_orders_org_client_idx on public.service_orders (organization_id, client_id);
create index service_orders_org_responsible_idx on public.service_orders (organization_id, responsible_user_id);
create index service_order_tasks_org_order_idx on public.service_order_tasks (organization_id, order_id);
create index service_order_tasks_org_responsible_idx on public.service_order_tasks (organization_id, responsible_user_id);
create index service_order_events_org_order_idx on public.service_order_events (organization_id, order_id, created_at desc, id);

alter table public.service_order_sequences enable row level security;
alter table public.service_orders enable row level security;
alter table public.service_order_tasks enable row level security;
alter table public.service_order_events enable row level security;

revoke all on public.service_order_sequences, public.service_orders, public.service_order_tasks, public.service_order_events
  from public, anon, authenticated, service_role;
grant select on public.service_orders, public.service_order_tasks, public.service_order_events to authenticated;
grant insert (id, organization_id, title, description, client_id, proposal_id, responsible_user_id, priority, status, start_date, due_date, estimated_value, notes),
  update (title, description, client_id, proposal_id, responsible_user_id, priority, status, start_date, due_date, estimated_value, notes)
  on public.service_orders to authenticated;
grant insert (id, organization_id, order_id, description, responsible_user_id, due_date),
  update (description, responsible_user_id, due_date, done), delete on public.service_order_tasks to authenticated;

revoke all on function public.has_active_opera_access(uuid), public.can_manage_service_order(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.has_active_opera_access(uuid), public.can_manage_service_order(uuid, uuid) to authenticated;

create policy opera_orders_read on public.service_orders for select to authenticated
  using (public.has_active_opera_access(organization_id));
create policy opera_orders_create on public.service_orders for insert to authenticated
  with check (public.has_active_opera_access(organization_id) and created_by = (select auth.uid()));
create policy opera_orders_update on public.service_orders for update to authenticated
  using (public.can_manage_service_order(organization_id, created_by))
  with check (public.can_manage_service_order(organization_id, created_by));

create policy opera_tasks_read on public.service_order_tasks for select to authenticated
  using (public.has_active_opera_access(organization_id));
create policy opera_tasks_manage on public.service_order_tasks for all to authenticated
  using (exists (
    select 1 from public.service_orders o
    where o.id = order_id and o.organization_id = service_order_tasks.organization_id
      and public.can_manage_service_order(o.organization_id, o.created_by)
  ))
  with check (exists (
    select 1 from public.service_orders o
    where o.id = order_id and o.organization_id = service_order_tasks.organization_id
      and public.can_manage_service_order(o.organization_id, o.created_by)
  ));
create policy opera_events_read on public.service_order_events for select to authenticated
  using (public.has_active_opera_access(organization_id));

-- Trigger-only elevation gives the allocator write access to the private
-- counter and lets proposal validation lock the referenced row until commit.
create function opera_private.prepare_service_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.has_active_opera_access(new.organization_id) or new.created_by is distinct from auth.uid() then
      raise insufficient_privilege using message = 'Acesso ao OPERA+ obrigatório.';
    end if;
    insert into public.service_order_sequences as seq (organization_id, last_number)
      values (new.organization_id, 1)
      on conflict (organization_id) do update set last_number = seq.last_number + 1
      returning last_number into new.number;
  end if;

  if new.proposal_id is not null and (
    tg_op = 'INSERT' or new.proposal_id is distinct from old.proposal_id or new.client_id is distinct from old.client_id
  ) then
    if not exists (
      select 1 from public.app_entitlements e
      where e.organization_id = new.organization_id and e.app_key = 'proposta-plus'
        and e.enabled and (e.expires_at is null or e.expires_at > now())
    ) then
      raise insufficient_privilege using message = 'Acesso ao PROPOSTA+ obrigatório para vincular a proposta.';
    end if;
    perform 1 from public.proposals p
    where p.id = new.proposal_id and p.organization_id = new.organization_id
      and p.client_id = new.client_id and p.status = 'approved' for share;
    if not found then
      raise check_violation using message = 'Selecione uma proposta aprovada deste cliente.';
    end if;
  end if;

  new.updated_at := now();
  if new.status <> 'completed' then
    new.completed_at := null;
  elsif tg_op = 'INSERT' or old.status <> 'completed' then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

create function opera_private.prepare_service_order_task()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.done is distinct from old.done then
    new.completed_at := case when new.done then now() end;
  end if;
  return new;
end;
$$;

-- The Data API only grants SELECT on history. These triggers derive the
-- author and payload from the authenticated write and its actual row values.
create function opera_private.record_service_order_events()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.service_order_events (organization_id, order_id, event_type, actor_id, details)
    values (new.organization_id, new.id, 'order_created', auth.uid(), jsonb_build_object('status', new.status));
  else
    insert into public.service_order_events (organization_id, order_id, event_type, actor_id, details)
    select new.organization_id, new.id, event.kind, auth.uid(), event.details
    from (values
      ('status_changed', new.status is distinct from old.status, jsonb_build_object('from', old.status, 'to', new.status)),
      ('assignee_changed', new.responsible_user_id is distinct from old.responsible_user_id, jsonb_build_object('from', old.responsible_user_id, 'to', new.responsible_user_id)),
      ('deadline_changed', new.due_date is distinct from old.due_date, jsonb_build_object('from', old.due_date, 'to', new.due_date)),
      ('notes_changed', new.notes is distinct from old.notes, jsonb_build_object('notes', new.notes))
    ) as event(kind, changed, details) where event.changed;
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    insert into public.service_order_events (organization_id, order_id, event_type, actor_id)
    values (new.organization_id, new.id, 'order_completed', auth.uid());
  end if;
  if tg_op = 'INSERT' and new.notes is not null then
    insert into public.service_order_events (organization_id, order_id, event_type, actor_id, details)
    values (new.organization_id, new.id, 'notes_changed', auth.uid(), jsonb_build_object('notes', new.notes));
  end if;
  return null;
end;
$$;

create function opera_private.record_service_order_task_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.done is distinct from old.done then
    insert into public.service_order_events (organization_id, order_id, event_type, actor_id, details)
    values (new.organization_id, new.order_id, case when new.done then 'task_completed' else 'task_reopened' end,
      auth.uid(), jsonb_build_object('task_id', new.id, 'description', new.description));
  end if;
  return null;
end;
$$;

revoke all on function opera_private.prepare_service_order(), opera_private.prepare_service_order_task(),
  opera_private.record_service_order_events(), opera_private.record_service_order_task_event()
  from public, anon, authenticated, service_role;

create trigger service_order_prepare before insert or update on public.service_orders
  for each row execute function opera_private.prepare_service_order();
create trigger service_order_history after insert or update on public.service_orders
  for each row execute function opera_private.record_service_order_events();
create trigger service_order_task_prepare before update on public.service_order_tasks
  for each row execute function opera_private.prepare_service_order_task();
create trigger service_order_task_history after update on public.service_order_tasks
  for each row execute function opera_private.record_service_order_task_event();

-- Profiles are normally visible only to their owner. Expose just the display
-- name of current colleagues, after checking membership and entitlement.
create function public.opera_team(target_org uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, nullif(trim(p.full_name), '')
  from public.organization_members m
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = target_org and public.has_active_opera_access(target_org)
  order by p.full_name, m.user_id;
$$;
revoke all on function public.opera_team(uuid) from public, anon, authenticated, service_role;
grant execute on function public.opera_team(uuid) to authenticated;
