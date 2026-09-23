import { entitlementValueSchema } from "@/lib/validation/entitlement";
import type { EffectiveEntitlements, EntitlementLayer } from "./types";

export function mergeEntitlementLayers(
  defaults: EntitlementLayer,
  planValues: EntitlementLayer,
  overrides: EntitlementLayer,
): EffectiveEntitlements {
  const merged = { ...defaults, ...planValues, ...overrides };
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, entitlementValueSchema.parse(value)]),
  );
}
