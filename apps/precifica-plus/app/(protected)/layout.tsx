import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isSupabaseConfigured()) return children;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login?next=/");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/access-denied");

  const { data: entitlement } = await supabase
    .from("app_entitlements")
    .select("enabled, expires_at")
    .eq("organization_id", membership.organization_id)
    .eq("app_key", "precifica-plus")
    .maybeSingle();
  const allowed =
    entitlement?.enabled &&
    (!entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now());
  if (!allowed) redirect("/access-denied");

  return children;
}
