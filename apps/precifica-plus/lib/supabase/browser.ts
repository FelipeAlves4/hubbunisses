import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookieOptions: process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN
          ? { domain: process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN }
          : undefined,
      },
    );
  }
  return browserClient;
}
