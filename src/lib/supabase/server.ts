import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "@/domain/auth/request";
import type { Database } from "@/types/database";
import { getPublicSupabaseEnv } from "./public-env";

/**
 * Authenticated server-user client. It carries the user's cookie session and
 * therefore remains subject to RLS. Use this for ordinary user-scoped work.
 */
export async function createServerUserSupabaseClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  const authorization = (await headers()).get("authorization");
  if (authorization !== null) {
    const token = bearerToken(authorization);
    if (!token) throw new Error("Invalid authorization.");
    return createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  const cookieStore = await cookies();

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
