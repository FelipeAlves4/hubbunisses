-- Calculates proposal totals before the row constraint is evaluated.
-- Applied remotely only after explicit approval.

create or replace function public.refresh_proposal_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_proposal_id uuid;
  proposal_additional_total numeric(14,2);
  proposal_tax_rate numeric(7,4);
  gross_total numeric(14,2);
  item_discount_total numeric(14,2);
  calculated_subtotal numeric(14,2);
  calculated_tax_total numeric(14,2);
  calculated_grand_total numeric(14,2);
begin
  if tg_table_name = 'proposal_items'
    and tg_op = 'DELETE'
    and not exists (
      select 1 from public.proposals where id = old.proposal_id
    ) then
    -- The item is being removed by a proposal/organization cascade. Its parent
    -- no longer exists, so there is nothing to recalculate.
    return old;
  end if;

  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if tg_table_name = 'proposal_items' then
    target_proposal_id := case
      when tg_op = 'DELETE' then old.proposal_id
      else new.proposal_id
    end;
  elsif tg_table_name = 'proposals' then
    target_proposal_id := case
      when tg_op = 'DELETE' then old.id
      else new.id
    end;
  else
    raise exception 'Origem de atualização de totais não suportada: %', tg_table_name
      using errcode = '22023';
  end if;

  select additional_total, tax_rate
  into proposal_additional_total, proposal_tax_rate
  from public.proposals as proposal
  where proposal.id = target_proposal_id
    and proposal.created_by = auth.uid()
    and public.is_organization_member(proposal.organization_id)
  for update;
  if not found then
    raise exception 'Não foi possível recalcular a proposta da organização atual.' using errcode = '42501';
  end if;

  select
    coalesce(sum(round(quantity * unit_price, 2)), 0),
    coalesce(sum(discount_amount), 0)
  into gross_total, item_discount_total
  from public.proposal_items
  where proposal_id = target_proposal_id;

  calculated_subtotal := greatest(0, gross_total - item_discount_total);
  calculated_tax_total := round(
    (calculated_subtotal + proposal_additional_total) * (proposal_tax_rate / 100),
    2
  );
  calculated_grand_total := round(
    calculated_subtotal + proposal_additional_total + calculated_tax_total,
    2
  );

  update public.proposals as proposal
  set
    subtotal = calculated_subtotal,
    discount_total = item_discount_total,
    tax_total = calculated_tax_total,
    grand_total = calculated_grand_total
  where proposal.id = target_proposal_id
    and (proposal.subtotal, proposal.discount_total, proposal.tax_total, proposal.grand_total)
      is distinct from (
        calculated_subtotal,
        item_discount_total,
        calculated_tax_total,
        calculated_grand_total
      );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.refresh_proposal_totals()
from public, anon, authenticated;

create or replace function public.prepare_proposal_totals_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gross_total numeric(14,2);
  item_discount_total numeric(14,2);
  calculated_subtotal numeric(14,2);
begin
  if auth.uid() is null
    or new.created_by is distinct from auth.uid()
    or not public.is_organization_member(new.organization_id) then
    raise exception 'Não foi possível recalcular a proposta da organização atual.'
      using errcode = '42501';
  end if;

  select
    coalesce(sum(round(quantity * unit_price, 2)), 0),
    coalesce(sum(discount_amount), 0)
  into gross_total, item_discount_total
  from public.proposal_items
  where proposal_id = new.id;

  calculated_subtotal := greatest(0, gross_total - item_discount_total);
  new.subtotal := calculated_subtotal;
  new.discount_total := item_discount_total;
  new.tax_total := round(
    (calculated_subtotal + new.additional_total) * (new.tax_rate / 100),
    2
  );
  new.grand_total := round(
    calculated_subtotal + new.additional_total + new.tax_total,
    2
  );
  return new;
end;
$$;

revoke all on function public.prepare_proposal_totals_update()
from public, anon, authenticated;

drop trigger if exists proposals_refresh_totals on public.proposals;
create trigger proposals_refresh_totals
before update of additional_total, tax_rate on public.proposals
for each row execute procedure public.prepare_proposal_totals_update();
