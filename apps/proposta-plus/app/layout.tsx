import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "@asex/ui/styles.css";
import "./proposta.css";
import { portalUrl, isSupabaseConfigured } from "../lib/supabase/config";
import { createClient } from "../lib/supabase/server";

export const metadata: Metadata = {
  title: "PROPOSTA+",
  description: "Propostas comerciais profissionais",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) redirect(`${portalUrl}/login`);

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!membership) redirect(portalUrl);

    const { data: entitlement } = await supabase
      .from("app_entitlements")
      .select("enabled, expires_at")
      .eq("organization_id", membership.organization_id)
      .eq("app_key", "proposta-plus")
      .maybeSingle();
    const allowed =
      entitlement?.enabled &&
      (!entitlement.expires_at ||
        new Date(entitlement.expires_at).getTime() > Date.now());
    if (!allowed) redirect(portalUrl);
  }
  return <html lang="pt-BR"><body>{children}</body></html>;
}
