-- Tighten explicit privileges for SECURITY DEFINER functions in the exposed schema.
-- The onboarding RPC remains available only to authenticated users because it checks auth.uid().

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
revoke all on function public.is_organization_member(uuid) from public, anon;
grant execute on function public.is_organization_member(uuid) to authenticated;
