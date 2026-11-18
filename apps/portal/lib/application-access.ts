import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";

export type CoreApplicationKey = "precifica-plus" | "proposta-plus";

export async function requireApplicationAccess(
  appKey: CoreApplicationKey,
  returnPath: "/precifica" | "/proposta",
) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(returnPath)}`);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect(`/access-denied?app=${appKey}`);

  const { data: entitlement } = await supabase
    .from("app_entitlements")
    .select("enabled, expires_at")
    .eq("organization_id", membership.organization_id)
    .eq("app_key", appKey)
    .maybeSingle();
  const allowed =
    entitlement?.enabled &&
    (!entitlement.expires_at ||
      new Date(entitlement.expires_at).getTime() > Date.now());
  if (!allowed) redirect(`/access-denied?app=${appKey}`);
}
