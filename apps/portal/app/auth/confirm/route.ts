import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next =
    request.nextUrl.searchParams.get("next") === "/reset" ? "/reset" : "/";
  const redirectTo = new URL("/login", request.url);
  if (!tokenHash || !type) return NextResponse.redirect(redirectTo);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });
  return NextResponse.redirect(new URL(error ? "/login" : next, request.url));
}
