import { z } from "zod";

export const entitlementValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
  z.null(),
]);

export const entitlementValueTypeSchema = z.enum(["boolean", "integer", "numeric", "text", "json"]);

export type EntitlementValue = z.infer<typeof entitlementValueSchema>;
export type EntitlementValueType = z.infer<typeof entitlementValueTypeSchema>;

export function parseEntitlementValue(type: EntitlementValueType, value: unknown): EntitlementValue {
  switch (type) {
    case "boolean":
      return z.boolean().nullable().parse(value);
    case "integer":
      return z.number().int().nullable().parse(value);
    case "numeric":
      return z.number().nullable().parse(value);
    case "text":
      return z.string().nullable().parse(value);
    case "json":
      return entitlementValueSchema.parse(value);
  }
}
