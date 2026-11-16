export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function applicationUrls() {
  return {
    portal: process.env.NEXT_PUBLIC_ASEX_PORTAL_URL ?? "http://localhost:3000",
    precifica: process.env.NEXT_PUBLIC_PRECIFICA_URL ?? "http://localhost:3001",
  };
}
