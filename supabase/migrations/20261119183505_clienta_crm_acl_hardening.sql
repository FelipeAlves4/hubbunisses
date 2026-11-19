-- CLIENTA+ ACL hardening. RLS policies and table data are intentionally untouched.
-- Supabase default ACLs may grant broad table privileges to authenticated; replace
-- them with the minimum operations required by the CRM application.

revoke all privileges on table
  public.crm_opportunities,
  public.crm_activities,
  public.crm_opportunity_proposals
from public, anon, authenticated;

grant select, insert, update, delete on table public.crm_opportunities to authenticated;
grant select, insert, update, delete on table public.crm_activities to authenticated;
grant select, insert, delete on table public.crm_opportunity_proposals to authenticated;
