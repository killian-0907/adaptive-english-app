import type { EntitlementValue } from "@/lib/validation/entitlement";

export type EffectiveEntitlements = Record<string, EntitlementValue>;

export type EntitlementLayer = Record<string, unknown>;
