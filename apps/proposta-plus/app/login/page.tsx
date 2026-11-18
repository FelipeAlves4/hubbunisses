import { redirect } from "next/navigation";
import { safeInternalPath } from "@asex/ui";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isSupabaseConfigured()) redirect("/");

  const { next, reason } = await searchParams;
  const destination = safeInternalPath(next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect(destination);

  return <LoginForm next={destination} reason={reason} />;
}
