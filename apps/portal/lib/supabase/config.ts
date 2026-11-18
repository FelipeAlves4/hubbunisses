export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function supabaseCookieOptions() {
  const configuredDomain = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN?.trim();
  // Vercel's default project domains are separate sites. A cookie scoped to
  // vercel.app would be both unsafe and ineffective for cross-project SSO.
  const domain =
    configuredDomain &&
    configuredDomain !== "vercel.app" &&
    !configuredDomain.endsWith(".vercel.app")
      ? configuredDomain
      : undefined;
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    // The browser client renews the Supabase session, so this cookie cannot
    // be HttpOnly without moving token refresh to a server-only architecture.
    httpOnly: false,
    ...(domain ? { domain } : {}),
  };
}

export function applicationUrls() {
  const portal =
    process.env.NEXT_PUBLIC_ASEX_PORTAL_URL?.trim() ||
    "https://asex-business-hub.vercel.app";
  return {
    // Product routes deliberately stay on the Hub origin. This gives the
    // Portal a single Supabase SSR session without sharing a cookie through
    // Vercel's public parent domain.
    portal,
    precifica: new URL("/precifica", portal).toString(),
    proposta: new URL("/proposta", portal).toString(),
  };
}
