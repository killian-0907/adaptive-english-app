export type BillingEnvironment = Record<string, string | undefined>;
export type Interval = "month" | "year";
export function billingConfig(env: BillingEnvironment) {
  const key = env.STRIPE_SECRET_KEY;
  if (key && !/^sk_test_[A-Za-z0-9]+$/.test(key)) throw new Error("Only Stripe test keys are supported");
  const prices = { month: env.STRIPE_PREMIUM_MONTHLY_PRICE_ID, year: env.STRIPE_PREMIUM_YEARLY_PRICE_ID };
  for (const id of Object.values(prices)) if (id && !/^price_[A-Za-z0-9]+$/.test(id)) throw new Error("Invalid price configuration");
  if (prices.month && prices.month === prices.year) throw new Error("Price intervals must be distinct");
  return { key, prices, webhookSecret: env.STRIPE_WEBHOOK_SECRET, ready: !!key && !!env.STRIPE_WEBHOOK_SECRET && !!(prices.month || prices.year) };
}
export function allowedPrice(env: BillingEnvironment, interval: Interval) {
  const config = billingConfig(env);
  const price = config.prices[interval];
  if (!config.ready || !price) throw new Error("Checkout is not configured");
  return price;
}
export function subscriptionStatus(status: string): "active" | "trial" | "canceled" | "expired" | "payment_issue" {
  if (status === "active") return "active";
  if (status === "trialing") return "trial";
  if (status === "canceled") return "canceled";
  if (status === "incomplete_expired") return "expired";
  return "payment_issue";
}
export function allowance(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid allowance");
  return value;
}
export function displayAmount(amount: number, currency: string, locale: string) {
  // Stripe retains two-decimal API representation for ISK/UGX despite ISO zero decimals.
  const formatter = new Intl.NumberFormat(locale,{style:"currency",currency});
  const decimals = ["isk","ugx"].includes(currency.toLowerCase()) ? 2 : formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** decimals);
}
