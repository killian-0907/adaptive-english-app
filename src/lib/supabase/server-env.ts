import "server-only";

export function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Missing required environment variable: SUPABASE_SECRET_KEY");
  return value;
}
