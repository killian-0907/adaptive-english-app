import "server-only";
import { deploymentReady } from "@/lib/deployment";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "./public-env";
import { getSupabaseServiceRoleKey } from "./server-env";

/**
 * RLS-bypassing service-role client. Keep imports of this module inside narrow,
 * server-only repositories/services that own authoritative writes.
 */
export function createAdminSupabaseClient() {
  if (process.env.VERCEL && !deploymentReady()) throw new Error("Hosted deployment configuration is incomplete");
  const { url } = getPublicSupabaseEnv();
  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
