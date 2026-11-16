import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");
  return <LoginForm />;
}
