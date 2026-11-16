import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { ResetForm } from "./reset-form";

export default function ResetPage() {
  if (!isSupabaseConfigured()) redirect("/");
  return <ResetForm />;
}
