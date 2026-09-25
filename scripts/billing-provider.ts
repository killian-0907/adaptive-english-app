// Shared by server-only services and the standalone deletion worker. Never import in a client component.
import Stripe from "stripe";
import { allowedPrice, billingConfig, subscriptionStatus, type Interval } from "../src/domain/billing/policy.ts";
export type PriceView = { interval: Interval; amount: number; currency: string };
export type BillingSnapshot = { reference: string; status: ReturnType<typeof subscriptionStatus>; start: string; end: string; cancel: boolean };
export interface BillingProvider {
  prices(): Promise<PriceView[]>;
  customer(userId: string): Promise<string>;
  checkout(customer: string, interval: Interval, origin: string): Promise<string>;
  portal(customer: string, origin: string): Promise<string>;
  snapshot(customer: string): Promise<BillingSnapshot | null>;
  remove(customer: string): Promise<void>;
  verify(body: string, signature: string): { id: string; customer: string | null };
}
export class StripeTestProvider implements BillingProvider {
  private client: Stripe;
  private env: Record<string,string|undefined>;
  constructor(env: Record<string,string|undefined> = process.env, client?: Stripe) {
    this.env = env;
    const config = billingConfig(env);
    if (!config.key) throw new Error("Stripe test configuration required");
    this.client = client ?? new Stripe(config.key, { timeout: 15000, maxNetworkRetries: 1 });
  }
  private async price(interval: Interval) {
    const price = await this.client.prices.retrieve(allowedPrice(this.env, interval));
    if (price.livemode || !price.active || price.type !== "recurring" || price.recurring?.interval !== interval || price.recurring.interval_count !== 1 || price.unit_amount === null || price.billing_scheme !== "per_unit" || price.recurring.usage_type !== "licensed") throw new Error("Unsupported test price");
    return price;
  }
  async prices() {
    const config = billingConfig(this.env);
    return Promise.all((["month", "year"] as const).filter(interval => !!config.prices[interval]).map(async interval => {
      const price = await this.price(interval);
      return { interval, amount: price.unit_amount!, currency: price.currency };
    }));
  }
  async customer(userId: string) {
    // No learner profile, goals or conversation is sent to Stripe.
    const customer = await this.client.customers.create({}, { idempotencyKey: `customer:${userId}` });
    if (customer.livemode) throw new Error("Live billing is disabled");
    return customer.id;
  }
  async checkout(customer: string, interval: Interval, origin: string) {
    const price = await this.price(interval);
    const subscriptions = await this.client.subscriptions.list({ customer, status: "all", limit: 100 });
    if (subscriptions.has_more || subscriptions.data.some(s => !["canceled", "incomplete_expired"].includes(s.status))) throw new Error("Manage your existing subscription in billing settings");
    const pending = await this.client.checkout.sessions.list({ customer, status: "open", limit: 100 });
    if (pending.has_more || pending.data.length > 5) throw new Error("Too many open checkout sessions");
    // Expire abandoned sessions before creating another interval, preventing double subscriptions.
    for (const session of pending.data) {
      if (session.livemode) throw new Error("Live billing is disabled");
      await this.client.checkout.sessions.expire(session.id);
    }
    const session = await this.client.checkout.sessions.create({ customer, mode: "subscription", line_items: [{ price: price.id, quantity: 1 }], success_url: `${origin}/membership?checkout=returned`, cancel_url: `${origin}/membership`, expires_at: Math.floor(Date.now()/1000)+1800 });
    if (session.livemode || !session.url) throw new Error("Checkout unavailable");
    return session.url;
  }
  async portal(customer: string, origin: string) {
    const owner = await this.client.customers.retrieve(customer);
    if (owner.deleted || owner.livemode) throw new Error("Billing customer unavailable");
    return (await this.client.billingPortal.sessions.create({customer, return_url: `${origin}/membership`})).url;
  }
  async snapshot(customer: string): Promise<BillingSnapshot | null> {
    const all = await this.client.subscriptions.list({customer, status:"all", limit:100});
    if (all.has_more || all.data.some(s => s.livemode)) throw new Error("Unsupported billing state");
    const allowed = Object.values(billingConfig(this.env).prices).filter(Boolean);
    const subscriptions = all.data.filter(s => s.items.data.length === 1 && allowed.includes(s.items.data[0].price.id) && s.items.data[0].quantity === 1);
    const active = subscriptions.filter(s => !["canceled","incomplete_expired"].includes(s.status));
    if (active.length > 1) throw new Error("Multiple subscriptions require review");
    const s = active[0] ?? subscriptions.sort((a,b) => b.created-a.created)[0];
    if (!s) return null;
    const item = s.items.data[0];
    const end = Math.min(item.current_period_end, s.cancel_at ?? Infinity, s.ended_at ?? Infinity);
    return { reference:s.id, status:subscriptionStatus(s.status), start:new Date(s.start_date*1000).toISOString(), end:new Date(Math.max(s.start_date,end)*1000).toISOString(), cancel:s.cancel_at_period_end || !!s.cancel_at };
  }
  verify(body: string, signature: string) {
    const secret = billingConfig(this.env).webhookSecret;
    if (!secret) throw new Error("Webhook configuration required");
    const event = this.client.webhooks.constructEvent(body, signature, secret);
    if (event.livemode) throw new Error("Live billing is disabled");
    const relevant = ["checkout.session.completed","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed","invoice.payment_action_required"];
    const object = event.data.object as {customer?: string | {id:string} | null};
    const customer = typeof object.customer === "string" ? object.customer : object.customer?.id;
    return {id:event.id, customer:relevant.includes(event.type) ? customer ?? null : null};
  }
  async remove(customer: string) {
    const owner = await this.client.customers.retrieve(customer);
    if (owner.deleted) return;
    if (owner.livemode) throw new Error("Live billing is disabled");
    // Deleting a test customer cancels ALL subscriptions and prevents any open
    // Checkout session from successfully creating a new subscription afterward.
    await this.client.customers.del(customer);
  }
}
