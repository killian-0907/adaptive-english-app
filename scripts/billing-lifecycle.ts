import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.generated.ts";
import { StripeTestProvider, type BillingProvider } from "./billing-provider.ts";
export type BillingDB = SupabaseClient<Database>;
export async function billingLease<T>(db: BillingDB, userId: string, deleting: boolean, action: (token: string) => Promise<T>) {
  const token = crypto.randomUUID();
  const lock = await db.rpc("acquire_billing_lock", {p_user:userId, p_token:token, p_deleting:deleting});
  if (lock.error || !lock.data) throw new Error("Billing operation pending; please retry");
  try { return await action(token); }
  finally { await db.from("billing_locks").delete().eq("user_id",userId).eq("token",token); }
}
export async function removeBilling(db: BillingDB, userId: string, provider?: BillingProvider) {
  const mapping = await db.from("billing_customers").select("customer_id").eq("user_id",userId).maybeSingle();
  if (mapping.error) throw new Error("Billing cleanup unavailable");
  // Always acquire the lease, even without a mapping: a customer creation may be in flight.
  await billingLease(db,userId,true,async()=>{
    const current = await db.from("billing_customers").select("customer_id").eq("user_id",userId).maybeSingle();
    if (current.error) throw new Error("Billing cleanup unavailable");
    if (current.data) await (provider ?? new StripeTestProvider()).remove(current.data.customer_id);
  });
}
export async function synchronizeBilling(db: BillingDB, event: {id:string;customer:string|null}, provider: BillingProvider) {
  if (!event.customer) return false;
  const existing = await db.from("billing_events").select("event_id").eq("event_id",event.id).maybeSingle();
  if (existing.error) throw new Error("Event lookup unavailable");
  if (existing.data) return false;
  const owner = await db.from("billing_customers").select("user_id").eq("customer_id",event.customer).maybeSingle();
  if (owner.error) throw new Error("Customer lookup unavailable");
  if (!owner.data) return false; // Foreign Stripe customers cannot grant app access.
  return billingLease(db,owner.data.user_id,false,async token=>{
    // Fetch under the lease, rather than replaying an old event snapshot.
    const snapshot = await provider.snapshot(event.customer!);
    if (!snapshot) throw new Error("No configured subscription found");
    const result = await db.rpc("apply_billing_event",{p_event:event.id,p_user:owner.data!.user_id,p_token:token,p_subscription:snapshot.reference,p_status:snapshot.status,p_start:snapshot.start,p_end:snapshot.end,p_cancel:snapshot.cancel});
    if (result.error) throw new Error("Entitlement synchronization unavailable");
    return result.data;
  });
}
