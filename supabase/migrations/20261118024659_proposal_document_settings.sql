-- PROPOSTA+ document identity settings.
-- Version reconciled to the timestamp recorded by the remote migration history.

create table public.organization_proposal_document_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  trade_name text check (trade_name is null or char_length(trim(trade_name)) between 2 and 160),
  email text check (email is null or char_length(trim(email)) <= 254),
  address text check (address is null or char_length(trim(address)) <= 1200),
  accent_color text not null default '#2563eb'
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  default_template text not null default 'executive'
    check (default_template in ('executive', 'minimal', 'commercial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A NULL value is intentionally allowed only while a BEFORE INSERT trigger is
-- running. The trigger below always supplies a valid template before the
-- existing NOT NULL constraint is checked, allowing each organization default
-- to work when an API client omits `template`.
alter table public.proposals alter column template drop default;

create trigger organization_proposal_document_settings_set_updated_at
before update on public.organization_proposal_document_settings
for each row execute procedure public.set_updated_at();

alter table public.organization_proposal_document_settings enable row level security;

create policy "members read proposal document settings"
on public.organization_proposal_document_settings for select to authenticated
using (public.is_organization_member(organization_id));

create policy "owners manage proposal document settings"
on public.organization_proposal_document_settings for insert to authenticated
with check (exists (
  select 1 from public.organization_members member
  where member.organization_id = organization_id
    and member.user_id = (select auth.uid())
    and member.role = 'owner'
));

create policy "owners update proposal document settings"
on public.organization_proposal_document_settings for update to authenticated
using (exists (
  select 1 from public.organization_members member
  where member.organization_id = organization_id
    and member.user_id = (select auth.uid())
    and member.role = 'owner'
))
with check (exists (
  select 1 from public.organization_members member
  where member.organization_id = organization_id
    and member.user_id = (select auth.uid())
    and member.role = 'owner'
));

grant select, insert, update on public.organization_proposal_document_settings to authenticated;
revoke all on public.organization_proposal_document_settings from anon;

create or replace function public.append_proposal_document_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  settings public.organization_proposal_document_settings;
begin
  select * into settings
  from public.organization_proposal_document_settings
  where organization_id = new.organization_id;

  new.template := coalesce(new.template, settings.default_template, 'executive');

  if found then
    new.company_snapshot := new.company_snapshot || jsonb_strip_nulls(jsonb_build_object(
      'trade_name', settings.trade_name,
      'email', settings.email,
      'address', settings.address,
      'accent_color', settings.accent_color,
      'default_template', settings.default_template
    ));
  end if;
  return new;
end;
$$;

create trigger proposals_z_append_document_snapshot
before insert on public.proposals
for each row execute procedure public.append_proposal_document_snapshot();

revoke all on function public.append_proposal_document_snapshot() from public, anon, authenticated;
