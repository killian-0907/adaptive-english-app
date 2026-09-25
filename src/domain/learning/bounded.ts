export type BoundedCriteria = { phrases: string[]; maxWords: number; function: string };
// Exact whole-message alternatives: never infer intent from an isolated keyword.
export function normalizeMessage(text: string) {
  return text.toLowerCase().replace(/[’]/g, "'").replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
}
export function evaluateBounded(text: string, criteria: BoundedCriteria) {
  const normalized = normalizeMessage(text);
  const accepted = normalized.split(" ").length <= criteria.maxWords && criteria.phrases.some(p => normalizeMessage(p) === normalized);
  return { quality: accepted ? 3 : null, confidence: accepted ? 2 : 0, errors: [] as string[] };
}
export function resolveEvaluation(strategy: "exact" | "evaluator" | "local_bounded", hasCriteria: boolean, enhancedOptedIn: boolean, enhancedAvailable: boolean) {
  if (strategy === "exact") return "DETERMINISTIC";
  if (hasCriteria) return "LOCAL_BOUNDED";
  if (enhancedOptedIn && enhancedAvailable) return "AI_STRUCTURED";
  return "FALLBACK";
}
