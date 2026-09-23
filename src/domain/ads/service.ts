import "server-only";
import { resolveEffectiveEntitlements } from "@/domain/entitlements/service";
import { loadAdPlacement } from "@/server/repositories/ad-placements";

export async function isAdAllowed(params: {
  userId: string;
  surfaceKey: string;
  activeLearningProtected: boolean;
}) {
  if (params.activeLearningProtected) return false;

  const [entitlements, placement] = await Promise.all([
    resolveEffectiveEntitlements(params.userId),
    loadAdPlacement(params.surfaceKey),
  ]);

  return entitlements.ads_enabled === true && placement?.enabled === true && placement.protected_surface !== true;
}
