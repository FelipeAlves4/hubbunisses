import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";

export type ApplicationKey =
  | "precifica-plus"
  | "proposta-plus"
  | "nexo-finance"
  | "clienta-plus";
export type ApplicationPath = "/precifica" | "/proposta" | "/financeiro" | "/clientes";

export class ApplicationAccessError extends Error {}

export async function getApplicationAccess(
  appKey: ApplicationKey,
): Promise<{ organizationId: string; userId: string }> {
  if (!isSupabaseConfigured()) {
    throw new ApplicationAccessError("O Supabase ainda não está configurado.");
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) throw new ApplicationAccessError("Autenticação obrigatória.");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membership) throw new ApplicationAccessError("Organização não encontrada.");

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
  if (!allowed) throw new ApplicationAccessError("Acesso não autorizado.");

  return { organizationId: membership.organization_id, userId };
}

export async function requireApplicationAccess(
  appKey: ApplicationKey,
  returnPath: ApplicationPath,
) {
  if (!isSupabaseConfigured()) return;
  try {
    return await getApplicationAccess(appKey);
  } catch (error) {
    if (error instanceof ApplicationAccessError) {
      if (error.message === "Autenticação obrigatória.") {
        redirect(`/login?next=${encodeURIComponent(returnPath)}`);
      }
      redirect(`/access-denied?app=${appKey}`);
    }
    throw error;
  }
}
