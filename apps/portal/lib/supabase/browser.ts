import { createBrowserClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookieOptions: supabaseCookieOptions(),
      },
    );
  }
  return browserClient;
}
