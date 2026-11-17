-- Corrects the proposal item total trigger for DELETE events.
-- Apply remotely only after the PROPOSTA+ validation approval.

create or replace function public.refresh_proposal_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_proposal_id uuid := case
    when tg_op = 'DELETE' then old.proposal_id
    else new.proposal_id
  end;
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
  where id = target_proposal_id
    and created_by = auth.uid()
    and public.is_organization_member(organization_id);

  if not found then
    raise exception 'Não foi possível recalcular a proposta da organização atual.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
