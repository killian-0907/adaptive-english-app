import "server-only";
import { loadEntitlementInputs } from "@/server/repositories/entitlements";
import { entitlementValueTypeSchema, parseEntitlementValue } from "@/lib/validation/entitlement";
import { mergeEntitlementLayers } from "./merge";
import type { EffectiveEntitlements } from "./types";

export async function resolveEffectiveEntitlements(userId: string): Promise<EffectiveEntitlements> {
  const { definitions, planValues, overrides } = await loadEntitlementInputs(userId);
  const keysById = new Map(definitions.map((row) => [row.id as string, row.entitlement_key as string]));

  const defaults = Object.fromEntries(definitions.map((row) => [row.entitlement_key, row.default_value]));
  const plan = Object.fromEntries(
    planValues.flatMap((row) => {
      const key = keysById.get(row.entitlement_definition_id as string);
      return key ? [[key, row.value] as const] : [];
    }),
  );
  const userOverrides = Object.fromEntries(
    overrides.flatMap((row) => {
      const key = keysById.get(row.entitlement_definition_id as string);
      return key ? [[key, row.value] as const] : [];
    }),
  );

  const merged = mergeEntitlementLayers(defaults, plan, userOverrides);
  return Object.fromEntries(
    definitions.map((definition) => {
      const type = entitlementValueTypeSchema.parse(definition.value_type);
      return [definition.entitlement_key, parseEntitlementValue(type, merged[definition.entitlement_key])];
    }),
  );
}
