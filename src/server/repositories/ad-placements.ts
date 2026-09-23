import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function loadAdPlacement(surfaceKey: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("ad_placement_configs")
    .select("surface_key, enabled, protected_surface")
    .eq("surface_key", surfaceKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}
