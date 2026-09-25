import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { billingConfig, type Interval } from "@/domain/billing/policy";
import { siteOrigin } from "@/lib/deployment";
import { StripeTestProvider, type PriceView, type BillingProvider } from "../../../scripts/billing-provider";
import { billingLease } from "../../../scripts/billing-lifecycle";
export async function billingOverview(userId: string) {
  const db = createAdminSupabaseClient();
  const [mapping, subscription] = await Promise.all([
    db.from("billing_customers").select("user_id").eq("user_id",userId).maybeSingle(),
    db.from("subscriptions").select("status,ends_at,provider_metadata").eq("user_id",userId).eq("is_current",true).maybeSingle(),
  ]);
  if (mapping.error || subscription.error) throw new Error("Membership unavailable");
  let prices: PriceView[] = [], configured = false, portalConfigured = false;
  try { const config=billingConfig(process.env);portalConfigured=!!config.key;configured = config.ready; if (configured) prices = await new StripeTestProvider().prices(); } catch { configured = false; }
  const s = subscription.data;
  return {configured, prices, portal:!!mapping.data && portalConfigured, status:s?.ends_at && Date.parse(s.ends_at)<=Date.now() && ["active","trial"].includes(s.status) ? "expired" : s?.status ?? "free", endsAt:s?.ends_at, cancel:!!(s?.provider_metadata && typeof s.provider_metadata === "object" && "cancel_at_period_end" in s.provider_metadata && s.provider_metadata.cancel_at_period_end)};
}
export async function startBilling(userId: string, action:"checkout"|"portal", interval: Interval = "month", provider: BillingProvider = new StripeTestProvider()) {
  const db = createAdminSupabaseClient(), origin = siteOrigin();
  return billingLease(db,userId,false,async()=>{
    const mapping = await db.from("billing_customers").select("customer_id").eq("user_id",userId).maybeSingle();
    if (mapping.error) throw new Error("Customer lookup unavailable");
    let customer = mapping.data?.customer_id;
    if (action === "portal") { if (!customer) throw new Error("No billing account"); return provider.portal(customer,origin); }
    // Validate provider configuration before creating a customer.
    const prices = await provider.prices(); if (!prices.some(p=>p.interval===interval)) throw new Error("Price unavailable");
    if (!customer) {
      customer = await provider.customer(userId);
      const saved = await db.from("billing_customers").insert({user_id:userId,customer_id:customer});
      if (saved.error) { await provider.remove(customer); throw new Error("Could not link customer"); }
    }
    return provider.checkout(customer,interval,origin);
  });
}
