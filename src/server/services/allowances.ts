import "server-only";
import { resolveEffectiveEntitlements } from "@/domain/entitlements/service";
import { allowance } from "@/domain/billing/policy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { RateLimitError } from "./lifecycle";
import { ProviderUnavailable } from "./assessment-provider";
export async function withAllowance<T>(userId:string, kind:"voice"|"ai", call:()=>Promise<T>):Promise<T> {
  const entitlements = await resolveEffectiveEntitlements(userId);
  const limit = allowance(entitlements[kind === "voice" ? "voice_usage_allowance" : "ai_usage_allowance"]);
  const db = createAdminSupabaseClient();
  const reserved = await db.rpc("reserve_provider_usage",{p_user:userId,p_resource:`premium_${kind}_calls`,p_limit:limit!,p_key:`provider:${crypto.randomUUID()}`});
  if (reserved.error) throw new Error("Usage verification unavailable");
  if (!reserved.data) {
    // Enhanced evaluation is optional: let the existing deterministic fallback
    // continue core learning when a configured provider allowance is exhausted.
    if (kind === "ai") throw new ProviderUnavailable("Enhanced evaluation allowance is used.");
    throw new RateLimitError("Your configured provider allowance is used. Browser voice and typing remain available.");
  }
  let succeeded = false;
  try { const result = await call(); succeeded = true; return result; }
  finally {
    // A process crash leaves a conservative pending reservation; never silently overspend.
    const saved = await db.from("usage_records").update({status:succeeded?"recorded":"voided"}).eq("id",reserved.data).eq("user_id",userId);
    if (saved.error) console.error(JSON.stringify({category:"provider",status:"usage_finalize_failed",requestId:crypto.randomUUID()}));
  }
}
