import { describe, expect, it } from "vitest";
import { mergeEntitlementLayers } from "./merge";

describe("mergeEntitlementLayers", () => {
  it("applies default, then plan, then user override precedence", () => {
    expect(
      mergeEntitlementLayers(
        { can_use_voice: false, ads_enabled: true },
        { can_use_voice: true },
        { ads_enabled: false },
      ),
    ).toEqual({ can_use_voice: true, ads_enabled: false });
  });
});
