-- Correct the owner policies introduced by 20261118024659; version aligned to remote history.
-- The outer table must be explicitly qualified: an unqualified
-- `organization_id` inside the membership subquery resolves to the inner
-- table, which would otherwise allow an owner of any organization to manage
-- settings for another organization.

drop policy "owners manage proposal document settings"
on public.organization_proposal_document_settings;

drop policy "owners update proposal document settings"
on public.organization_proposal_document_settings;

create policy "owners manage proposal document settings"
on public.organization_proposal_document_settings for insert to authenticated
with check (exists (
  select 1
  from public.organization_members member
  where member.organization_id = organization_proposal_document_settings.organization_id
    and member.user_id = (select auth.uid())
    and member.role = 'owner'
));

create policy "owners update proposal document settings"
on public.organization_proposal_document_settings for update to authenticated
using (exists (
  select 1
  from public.organization_members member
  where member.organization_id = organization_proposal_document_settings.organization_id
    and member.user_id = (select auth.uid())
    and member.role = 'owner'
))
with check (exists (
  select 1
  from public.organization_members member
  where member.organization_id = organization_proposal_document_settings.organization_id
    and member.user_id = (select auth.uid())
    and member.role = 'owner'
));
