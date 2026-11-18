import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeApplicationRedirect } from "../../../lib/auth-redirect";
import { createClient } from "../../../lib/supabase/server";
import { applicationUrls } from "../../../lib/supabase/config";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next =
    requestedNext === "/reset"
      ? "/reset"
      : safeApplicationRedirect(requestedNext, applicationUrls());
  const redirectTo = new URL("/login", request.url);
  if (!tokenHash || !type) return NextResponse.redirect(redirectTo);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });
  return NextResponse.redirect(new URL(error ? "/login" : next, request.url));
}
