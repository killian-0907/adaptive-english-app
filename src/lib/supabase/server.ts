import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getPublicSupabaseEnv } from "./public-env";

/**
 * Authenticated server-user client. It carries the user's cookie session and
 * therefore remains subject to RLS. Use this for ordinary user-scoped work.
 */
export async function createServerUserSupabaseClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. The Next.js proxy
          // refreshes auth cookies for normal requests.
        }
      },
    },
  });
}
