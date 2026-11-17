-- PROPOSTA+ foundation. Review and apply remotely only after explicit approval.
-- No entitlement is granted here: application access remains an explicit business decision.

create type public.proposal_client_type as enum ('individual', 'company');
create type public.proposal_catalog_kind as enum ('product', 'service');
create type public.proposal_status as enum ('draft', 'sent', 'approved', 'declined', 'expired', 'cancelled');

create table public.proposal_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 180),
  type public.proposal_client_type not null default 'company',
  contact_name text check (contact_name is null or char_length(trim(contact_name)) between 2 and 160),
  email text check (email is null or char_length(trim(email)) <= 254),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  document_number text check (document_number is null or char_length(trim(document_number)) between 5 and 32),
  address text check (address is null or char_length(address) <= 1200),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.proposal_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 180),
  description text check (description is null or char_length(description) <= 4000),
  kind public.proposal_catalog_kind not null,
  unit text not null check (char_length(trim(unit)) between 1 and 60),
  default_price numeric(14,2) not null default 0 check (default_price >= 0),
  internal_code text check (internal_code is null or char_length(trim(internal_code)) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.proposal_number_sequences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_number bigint not null default 1 check (next_number > 0)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  number bigint,
  title text not null check (char_length(trim(title)) between 1 and 220),
  description text check (description is null or char_length(description) <= 8000),
  status public.proposal_status not null default 'draft',
  issued_at date not null default current_date,
  valid_until date,
  responsible_name text check (responsible_name is null or char_length(trim(responsible_name)) <= 160),
  payment_terms text check (payment_terms is null or char_length(payment_terms) <= 8000),
  delivery_terms text check (delivery_terms is null or char_length(delivery_terms) <= 8000),
  warranty_terms text check (warranty_terms is null or char_length(warranty_terms) <= 8000),
  notes text check (notes is null or char_length(notes) <= 8000),
  template text not null default 'executive' check (template in ('executive', 'minimal', 'commercial')),
  client_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(client_snapshot) = 'object'),
  company_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(company_snapshot) = 'object'),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
  additional_total numeric(14,2) not null default 0 check (additional_total >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
  grand_total numeric(14,2) not null default 0 check (grand_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.proposal_clients(organization_id, id) on delete restrict,
  check (valid_until is null or valid_until >= issued_at),
  check (grand_total = round(subtotal + additional_total + tax_total, 2)),
  unique (organization_id, number),
  unique (organization_id, id)
);

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  organization_id uuid not null,
  catalog_item_id uuid,
  description text not null check (char_length(trim(description)) between 1 and 1000),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (char_length(trim(unit)) between 1 and 60),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  total numeric(14,2) not null check (total >= 0 and discount_amount <= round(quantity * unit_price, 2) and total = round(quantity * unit_price - discount_amount, 2)),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, proposal_id) references public.proposals(organization_id, id) on delete cascade,
  foreign key (organization_id, catalog_item_id) references public.proposal_catalog_items(organization_id, id) on delete set null,
  unique (proposal_id, sort_order)
);

create index proposal_clients_organization_name_idx on public.proposal_clients (organization_id, name);
create index proposal_catalog_items_organization_name_idx on public.proposal_catalog_items (organization_id, name);
create index proposals_organization_updated_idx on public.proposals (organization_id, updated_at desc);
create index proposal_items_proposal_sort_idx on public.proposal_items (proposal_id, sort_order);

create or replace function public.prepare_proposal_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allocated_number bigint;
  client_record public.proposal_clients;
  organization_record public.organizations;
begin
  if auth.uid() is null
    or new.created_by is distinct from auth.uid()
    or not public.is_organization_member(new.organization_id) then
    raise exception 'Autenticação e associação à organização são obrigatórias.' using errcode = '42501';
  end if;
  if new.number is not null then
    raise exception 'O número da proposta é atribuído pelo sistema.' using errcode = '22023';
  end if;

  select * into client_record from public.proposal_clients
  where id = new.client_id and organization_id = new.organization_id;
  if not found then
    raise exception 'O cliente deve pertencer à organização da proposta.' using errcode = '23503';
  end if;
  select * into organization_record from public.organizations where id = new.organization_id;
  insert into public.proposal_number_sequences (organization_id, next_number)
  values (new.organization_id, 2)
  on conflict (organization_id) do update
    set next_number = public.proposal_number_sequences.next_number + 1
  returning next_number - 1 into allocated_number;
  new.number := allocated_number;
  new.client_snapshot := jsonb_build_object(
    'name', client_record.name, 'type', client_record.type,
    'contact_name', client_record.contact_name, 'email', client_record.email,
    'phone', client_record.phone, 'document_number', client_record.document_number,
    'address', client_record.address
  );
  new.company_snapshot := jsonb_build_object(
    'name', organization_record.name, 'document_number', organization_record.document_number,
    'phone', organization_record.phone, 'logo_url', organization_record.logo_url
  );
  new.subtotal := 0;
  new.discount_total := 0;
  new.tax_total := round(new.additional_total * (new.tax_rate / 100), 2);
  new.grand_total := round(new.additional_total + new.tax_total, 2);
  return new;
end;
$$;

create or replace function public.refresh_proposal_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_proposal_id uuid := coalesce(new.proposal_id, old.proposal_id);
  gross_total numeric(14,2);
  item_discount_total numeric(14,2);
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;
  select coalesce(sum(round(quantity * unit_price, 2)), 0), coalesce(sum(discount_amount), 0)
  into gross_total, item_discount_total
  from public.proposal_items where proposal_id = target_proposal_id;

  update public.proposals
  set
    subtotal = greatest(0, gross_total - item_discount_total),
    discount_total = item_discount_total,
    tax_total = round((greatest(0, gross_total - item_discount_total) + additional_total) * (tax_rate / 100), 2),
    grand_total = round(greatest(0, gross_total - item_discount_total) + additional_total + ((greatest(0, gross_total - item_discount_total) + additional_total) * (tax_rate / 100)), 2)
  where id = target_proposal_id and created_by = auth.uid() and public.is_organization_member(organization_id);
  if not found then
    raise exception 'Não foi possível recalcular a proposta da organização atual.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_proposal_tenant_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by
    or new.number is distinct from old.number
    or new.client_id is distinct from old.client_id
    or new.client_snapshot is distinct from old.client_snapshot
    or new.company_snapshot is distinct from old.company_snapshot then
    raise exception 'A identidade, os snapshots e o número da proposta não podem ser alterados.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_organization_or_creator_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by then
    raise exception 'A organização e o criador do registro não podem ser alterados.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_proposal_item_tenant_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.proposal_id is distinct from old.proposal_id then
    raise exception 'A organização e a proposta de um item não podem ser alteradas.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger proposals_prepare_insert before insert on public.proposals for each row execute procedure public.prepare_proposal_insert();
create trigger proposal_clients_set_updated_at before update on public.proposal_clients for each row execute procedure public.set_updated_at();
create trigger proposal_catalog_items_set_updated_at before update on public.proposal_catalog_items for each row execute procedure public.set_updated_at();
create trigger proposals_set_updated_at before update on public.proposals for each row execute procedure public.set_updated_at();
create trigger proposal_items_set_updated_at before update on public.proposal_items for each row execute procedure public.set_updated_at();
create trigger proposals_prevent_tenant_change before update on public.proposals for each row execute procedure public.prevent_proposal_tenant_change();
create trigger proposal_clients_prevent_tenant_change before update on public.proposal_clients for each row execute procedure public.prevent_organization_or_creator_change();
create trigger proposal_catalog_items_prevent_tenant_change before update on public.proposal_catalog_items for each row execute procedure public.prevent_organization_or_creator_change();
create trigger proposal_items_prevent_tenant_change before update on public.proposal_items for each row execute procedure public.prevent_proposal_item_tenant_change();
create trigger proposal_items_refresh_totals after insert or update or delete on public.proposal_items for each row execute procedure public.refresh_proposal_totals();
create trigger proposals_refresh_totals after update of additional_total, tax_rate on public.proposals for each row execute procedure public.refresh_proposal_totals();

alter table public.proposal_clients enable row level security;
alter table public.proposal_catalog_items enable row level security;
alter table public.proposal_number_sequences enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

revoke all on public.proposal_clients, public.proposal_catalog_items, public.proposal_number_sequences, public.proposals, public.proposal_items from anon;
revoke update on public.proposals from authenticated;

create policy "members read proposal clients" on public.proposal_clients for select to authenticated using (public.is_organization_member(organization_id));
create policy "members create proposal clients" on public.proposal_clients for insert to authenticated with check (created_by = (select auth.uid()) and public.is_organization_member(organization_id));
create policy "creators update proposal clients" on public.proposal_clients for update to authenticated using (created_by = (select auth.uid()) and public.is_organization_member(organization_id)) with check (created_by = (select auth.uid()) and public.is_organization_member(organization_id));
create policy "creators delete proposal clients" on public.proposal_clients for delete to authenticated using (created_by = (select auth.uid()) and public.is_organization_member(organization_id));

create policy "members read proposal catalog" on public.proposal_catalog_items for select to authenticated using (public.is_organization_member(organization_id));
create policy "members create proposal catalog" on public.proposal_catalog_items for insert to authenticated with check (created_by = (select auth.uid()) and public.is_organization_member(organization_id));
create policy "creators update proposal catalog" on public.proposal_catalog_items for update to authenticated using (created_by = (select auth.uid()) and public.is_organization_member(organization_id)) with check (created_by = (select auth.uid()) and public.is_organization_member(organization_id));
create policy "creators delete proposal catalog" on public.proposal_catalog_items for delete to authenticated using (created_by = (select auth.uid()) and public.is_organization_member(organization_id));

create policy "members read proposals" on public.proposals for select to authenticated using (public.is_organization_member(organization_id));
create policy "members create proposals" on public.proposals for insert to authenticated with check (created_by = (select auth.uid()) and public.is_organization_member(organization_id));
create policy "creators update proposals" on public.proposals for update to authenticated using (created_by = (select auth.uid()) and public.is_organization_member(organization_id)) with check (created_by = (select auth.uid()) and public.is_organization_member(organization_id));
create policy "creators delete proposals" on public.proposals for delete to authenticated using (created_by = (select auth.uid()) and public.is_organization_member(organization_id));

create policy "members read proposal items" on public.proposal_items for select to authenticated using (public.is_organization_member(organization_id));
create policy "proposal creators create items" on public.proposal_items for insert to authenticated with check (public.is_organization_member(organization_id) and exists (select 1 from public.proposals p where p.id = proposal_id and p.organization_id = organization_id and p.created_by = (select auth.uid())));
create policy "proposal creators update items" on public.proposal_items for update to authenticated using (exists (select 1 from public.proposals p where p.id = proposal_id and p.organization_id = organization_id and p.created_by = (select auth.uid())) and public.is_organization_member(organization_id)) with check (exists (select 1 from public.proposals p where p.id = proposal_id and p.organization_id = organization_id and p.created_by = (select auth.uid())) and public.is_organization_member(organization_id));
create policy "proposal creators delete items" on public.proposal_items for delete to authenticated using (exists (select 1 from public.proposals p where p.id = proposal_id and p.organization_id = organization_id and p.created_by = (select auth.uid())) and public.is_organization_member(organization_id));

grant select, insert, update, delete on public.proposal_clients, public.proposal_catalog_items, public.proposal_items to authenticated;
grant select, insert, delete on public.proposals to authenticated;
grant update (title, description, status, issued_at, valid_until, responsible_name, payment_terms, delivery_terms, warranty_terms, notes, template, additional_total, tax_rate) on public.proposals to authenticated;
revoke all on public.proposal_number_sequences from anon, authenticated;
revoke all on function public.prepare_proposal_insert() from public, anon, authenticated;
revoke all on function public.refresh_proposal_totals() from public, anon, authenticated;
