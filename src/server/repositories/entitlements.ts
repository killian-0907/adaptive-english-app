import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function loadEntitlementInputs(userId: string, now = new Date()) {
  const supabase = createAdminSupabaseClient();

  const { data: definitions, error: definitionsError } = await supabase
    .from("entitlement_definitions")
    .select("id, entitlement_key, value_type, default_value");
  if (definitionsError) throw definitionsError;

  const { data: currentSubscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  let planId = currentSubscription?.plan_id as string | undefined;
  if (!planId) {
    const { data: freePlan, error: freePlanError } = await supabase
      .from("plans")
      .select("id")
      .eq("plan_key", "free")
      .eq("is_active", true)
      .single();
    if (freePlanError) throw freePlanError;
    planId = freePlan.id as string;
  }

  const { data: planValues, error: planValuesError } = await supabase
    .from("plan_entitlements")
    .select("entitlement_definition_id, value")
    .eq("plan_id", planId);
  if (planValuesError) throw planValuesError;

  const isoNow = now.toISOString();
  const { data: overrides, error: overridesError } = await supabase
    .from("user_entitlement_overrides")
    .select("entitlement_definition_id, value, starts_at, ends_at")
    .eq("user_id", userId)
    .lte("starts_at", isoNow)
    .or(`ends_at.is.null,ends_at.gt.${isoNow}`);
  if (overridesError) throw overridesError;

  return { definitions: definitions ?? [], planValues: planValues ?? [], overrides: overrides ?? [] };
}
