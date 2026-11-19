-- CLIENTA+ CRM MVP. Review and apply remotely only after explicit approval.
-- This migration deliberately creates no entitlement records.

alter type public.app_key add value if not exists 'clienta-plus';

create type public.crm_opportunity_stage as enum (
  'new_lead', 'contact_started', 'qualification', 'proposal_sent',
  'negotiation', 'won', 'lost'
);
create type public.crm_opportunity_priority as enum ('low', 'medium', 'high');
create type public.crm_activity_type as enum (
  'call', 'whatsapp', 'email', 'meeting', 'note', 'follow_up', 'stage_changed'
);

-- Keep authorization in the database boundary too: server actions enforce it
-- before the query, while RLS protects the Data API from bypasses.
create or replace function public.has_active_clienta_access(target_organization_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1
    from public.organization_members m
    join public.app_entitlements e
      on e.organization_id = m.organization_id
     -- Compare as text so this migration remains valid when Supabase wraps
     -- the ALTER TYPE and policy creation in the same transaction.
     and e.app_key::text = 'clienta-plus'
     and e.enabled
     and (e.expires_at is null or e.expires_at > now())
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
  );
$$;

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  responsible_user_id uuid,
  title text not null check (char_length(trim(title)) between 2 and 220),
  description text check (description is null or char_length(description) <= 8000),
  estimated_value_cents bigint not null default 0 check (estimated_value_cents between 0 and 99999999999999),
  stage public.crm_opportunity_stage not null default 'new_lead',
  priority public.crm_opportunity_priority not null default 'medium',
  expected_close_date date,
  next_contact_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.proposal_clients(organization_id, id) on delete restrict,
  foreign key (organization_id, responsible_user_id) references public.organization_members(organization_id, user_id) on delete set null,
  unique (organization_id, id)
);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  activity_type public.crm_activity_type not null,
  body text check (body is null or char_length(body) <= 8000),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, opportunity_id) references public.crm_opportunities(organization_id, id) on delete cascade,
  check ((activity_type <> 'follow_up') or due_date is not null),
  check (completed_at is null or activity_type = 'follow_up'),
  unique (organization_id, id)
);

create table public.crm_opportunity_proposals (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null,
  proposal_id uuid not null,
  linked_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, proposal_id),
  unique (organization_id, proposal_id),
  foreign key (organization_id, opportunity_id) references public.crm_opportunities(organization_id, id) on delete cascade,
  foreign key (organization_id, proposal_id) references public.proposals(organization_id, id) on delete cascade
);

create index crm_opportunities_org_stage_updated_idx on public.crm_opportunities (organization_id, stage, updated_at desc);
create index crm_opportunities_org_client_idx on public.crm_opportunities (organization_id, client_id);
create index crm_activities_org_opportunity_created_idx on public.crm_activities (organization_id, opportunity_id, created_at desc);
create index crm_activities_open_followups_idx on public.crm_activities (organization_id, due_date) where activity_type = 'follow_up' and completed_at is null;

create or replace function public.crm_prevent_identity_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by then
    raise exception 'A organização e o criador do registro não podem ser alterados.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.crm_record_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.crm_activities (organization_id, opportunity_id, created_by, activity_type, body)
    values (
      new.organization_id, new.id, auth.uid(), 'stage_changed',
      format('Etapa alterada de %s para %s.', old.stage, new.stage)
    );
  end if;
  return new;
end;
$$;

create or replace function public.crm_validate_proposal_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1
    from public.crm_opportunities o
    join public.proposals p on p.organization_id = o.organization_id and p.id = new.proposal_id
    where o.organization_id = new.organization_id
      and o.id = new.opportunity_id
      and p.client_id = o.client_id
  ) then
    raise exception 'A proposta deve pertencer ao cliente da oportunidade.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger crm_opportunities_set_updated_at before update on public.crm_opportunities for each row execute procedure public.set_updated_at();
create trigger crm_activities_set_updated_at before update on public.crm_activities for each row execute procedure public.set_updated_at();
create trigger crm_opportunities_prevent_identity_change before update on public.crm_opportunities for each row execute procedure public.crm_prevent_identity_change();
create trigger crm_activities_prevent_identity_change before update on public.crm_activities for each row execute procedure public.crm_prevent_identity_change();
create trigger crm_opportunities_record_stage_change after update of stage on public.crm_opportunities for each row execute procedure public.crm_record_stage_change();
create trigger crm_opportunity_proposals_validate_client before insert or update on public.crm_opportunity_proposals for each row execute procedure public.crm_validate_proposal_link();

alter table public.crm_opportunities enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_opportunity_proposals enable row level security;
revoke all on public.crm_opportunities, public.crm_activities, public.crm_opportunity_proposals from anon;

create policy "members with clienta read opportunities" on public.crm_opportunities for select to authenticated using (public.has_active_clienta_access(organization_id));
create policy "members with clienta create opportunities" on public.crm_opportunities for insert to authenticated with check (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id));
create policy "creators with clienta update opportunities" on public.crm_opportunities for update to authenticated using (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id)) with check (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id));
create policy "creators with clienta delete opportunities" on public.crm_opportunities for delete to authenticated using (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id));

create policy "members with clienta read activities" on public.crm_activities for select to authenticated using (public.has_active_clienta_access(organization_id));
create policy "members with clienta create activities" on public.crm_activities for insert to authenticated with check (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id) and exists (select 1 from public.crm_opportunities o where o.id = opportunity_id and o.organization_id = crm_activities.organization_id));
create policy "creators with clienta update activities" on public.crm_activities for update to authenticated using (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id)) with check (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id));
create policy "creators with clienta delete activities" on public.crm_activities for delete to authenticated using (created_by = (select auth.uid()) and public.has_active_clienta_access(organization_id));

create policy "members with clienta read proposal links" on public.crm_opportunity_proposals for select to authenticated using (public.has_active_clienta_access(organization_id));
create policy "opportunity creators with clienta link proposals" on public.crm_opportunity_proposals for insert to authenticated with check (linked_by = (select auth.uid()) and public.has_active_clienta_access(organization_id) and exists (select 1 from public.crm_opportunities o where o.id = opportunity_id and o.organization_id = crm_opportunity_proposals.organization_id and o.created_by = (select auth.uid())));
create policy "opportunity creators with clienta unlink proposals" on public.crm_opportunity_proposals for delete to authenticated using (public.has_active_clienta_access(organization_id) and exists (select 1 from public.crm_opportunities o where o.id = opportunity_id and o.organization_id = crm_opportunity_proposals.organization_id and o.created_by = (select auth.uid())));

grant select, insert, update, delete on public.crm_opportunities, public.crm_activities to authenticated;
grant select, insert, delete on public.crm_opportunity_proposals to authenticated;
revoke all on function public.crm_record_stage_change() from public, anon, authenticated;
revoke all on function public.crm_validate_proposal_link() from public, anon, authenticated;
revoke all on function public.has_active_clienta_access(uuid) from public, anon;
grant execute on function public.has_active_clienta_access(uuid) to authenticated;
