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
  return {
    // Local development supplies localhost values in .env.local. Keeping
    // deployed defaults here prevents a missing Vercel variable from sending
    // a production user to a loopback URL that only exists on their device.
    portal:
      process.env.NEXT_PUBLIC_ASEX_PORTAL_URL?.trim() ||
      "https://asex-business-hub.vercel.app",
    precifica:
      process.env.NEXT_PUBLIC_PRECIFICA_URL?.trim() ||
      "https://asex-precifica-plus.vercel.app",
    proposta:
      process.env.NEXT_PUBLIC_PROPOSTA_URL?.trim() ||
      "https://asex-proposta-plus.vercel.app",
  };
}
