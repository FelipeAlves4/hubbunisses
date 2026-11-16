import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function proxy(request: NextRequest) {
  if (!configured()) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN
        ? { domain: process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN }
        : undefined,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    const login = new URL(
      "/login",
      process.env.NEXT_PUBLIC_ASEX_PORTAL_URL ?? "http://localhost:3000",
    );
    login.searchParams.set("next", request.nextUrl.href);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
