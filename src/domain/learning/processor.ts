import type { Evidence, Patch, Snapshot } from "./types";
const eligible = (e: Evidence) => e.response_quality !== null && e.evaluator_confidence_level > 0 && !e.metadata.misunderstood && !e.voice_uncertainty && !["tired", "overloaded", "frustrated"].includes(e.metadata.sessionState);
const independent = (e: Evidence) => e.support_level === 0 && e.metadata.retries === 0 && e.evaluator_confidence_level >= 2;
const unique = (events: Evidence[]) => [...new Map(events.map(e => [e.activity_id, e])).values()];
export function reviewNeed(state: string, last: string | null, current: number, now: Date, failed = false) {
  const days = last ? (now.getTime() - Date.parse(last)) / 86400000 : 0;
  return Math.min(3, Math.max(current, failed ? 3 : 0, days > (state === "strong" ? 60 : 14) ? 2 : state === "emerging" || state === "supported" ? 1 : 0));
}
/** Pure, bounded updates. Persistence compares the snapshot revision before applying them. */
export function processEvidence(snapshot: Snapshot, incoming: Evidence[], now = new Date()): { patches: Patch[]; applied: string[] } {
  const pending = [...snapshot.evidence.filter(e => e.processor_status === "pending"), ...incoming.filter(e=>!snapshot.evidence.some(old=>old.id===e.id&&old.processor_status==="applied"))].filter((e, i, all) => all.findIndex(x => x.id === e.id) === i);
  const all = [...snapshot.evidence.filter(e => !pending.some(p => p.id === e.id)), ...pending].sort((a,b) => a.occurred_at.localeCompare(b.occurred_at));
  const valid = all.filter(eligible); const patches: Patch[] = [];
  const changed = pending.filter(eligible);
  for (const skill of new Set(changed.map(e => e.target_skill).filter(Boolean))) {
    const samples = unique(valid.filter(e => e.target_skill === skill && independent(e))).slice(-8);
    const old = snapshot.abilities.find(a => a.dimension === skill);
    let level = old?.estimate_level ?? 0; let confidence = old?.confidence_level ?? 0;
    const last = samples.slice(-3); const latest = changed.filter(e => e.target_skill === skill).at(-1)!;
    // Each level needs three independent successes at/above that level. Old easy successes cannot raise it again.
    if (independent(latest) && last.length === 3 && last.every(e => e.response_quality! >= 3 && e.metadata.difficulty >= level)) level = Math.min(6, level + 1);
    else if (independent(latest) && last.length === 3 && last.every(e => e.response_quality! <= 1 && e.metadata.difficulty <= level)) level = Math.max(0, level - 1);
    if (samples.length >= 3 && (last.every(e => e.response_quality! >= 3) || last.every(e => e.response_quality! <= 1))) confidence = Math.max(confidence, samples.length >= 6 && samples.filter(e => e.transfer_success).length >= 2 ? 3 : 2);
    else if (samples.length) confidence = Math.max(confidence, 1);
    patches.push({ kind: "ability", key: skill!, values: { dimension: skill, estimate_level: level, confidence_level: confidence, trend: level > (old?.estimate_level ?? 0) ? "improving" : level < (old?.estimate_level ?? 0) ? "declining" : "stable", last_evidence_at: latest.occurred_at }, evidence: unique([...samples, latest]).map(e => e.id) });
  }
  const groups = new Set(changed.filter(e => e.knowledge_item_id && e.modality).map(e => `${e.knowledge_item_id}:${e.modality}`));
  for (const key of groups) {
    const [kid, modality] = key.split(":"); const samples = unique(valid.filter(e => e.knowledge_item_id === kid && e.modality === modality)).slice(-10); const latest = samples.at(-1)!;
    const old = snapshot.knowledge.find(k => k.knowledge_item_id === kid && k.modality === modality);
    const successes = samples.filter(e => independent(e) && e.response_quality! >= 3); const transfer = successes.filter(e => e.transfer_success).length;
    let state = old?.state ?? "unknown";
    if (latest.response_quality! >= 2) {
      const proposed = latest.support_level > 0 ? "supported" : successes.length >= 5 && transfer >= 2 ? "strong" : successes.length >= 3 ? (modality.endsWith("recognition") ? "recognized" : "independent") : "emerging";
      const rank = ["unknown", "emerging", "supported", "recognized", "independent", "strong"];
      if (rank.indexOf(proposed) > rank.indexOf(state)) state = proposed;
    }
    if (samples.slice(-3).length === 3 && samples.slice(-3).every(e => independent(e) && e.response_quality! <= 1) && ["strong", "independent"].includes(state)) state = "emerging";
    patches.push({ kind: "knowledge", key, values: { knowledge_item_id: kid, modality, state, confidence_level: Math.max(old?.confidence_level ?? 0, successes.length >= 5 && transfer >= 2 ? 3 : successes.length >= 3 ? 2 : 1), review_need: latest.response_quality! <= 1 ? 3 : transfer >= 2 && latest.transfer_success ? 0 : reviewNeed(state, old?.last_evidence_at ?? null, old?.review_need ?? 0, now), last_evidence_at: latest.occurred_at, trend: latest.transfer_success ? "improving" : "stable" }, evidence: samples.map(e => e.id) });
    for (const error of new Set(samples.flatMap(e => e.metadata.errors))) {
      const occurrences = samples.filter(e => e.metadata.errors.includes(error)); if (occurrences.length < 3) continue;
      const patternKey = `${key}:${error}`; const clean = samples.slice(-3).filter(e => independent(e) && e.response_quality! >= 3 && !e.metadata.errors.includes(error));
      patches.push({ kind: "pattern", key: patternKey, values: { pattern_key: patternKey, mistake_category: error, knowledge_item_id: kid, modality, confidence_level: occurrences.length >= 5 ? 2 : 1, severity_level: occurrences.filter(e => e.response_quality! <= 1).length >= 3 ? 2 : 1, occurrence_count: Math.max(occurrences.length, snapshot.patterns.find(p=>p.pattern_key===patternKey)?.occurrence_count ?? 0), status: clean.length >= 3 ? "improving" : occurrences.length >= 5 ? "established" : "candidate", improvement_state: clean.length >= 3 ? "improving" : "stable", last_observed_at: occurrences.at(-1)!.occurred_at }, evidence: samples.map(e => e.id) });
    }
    // Comparable later independent transfer, not immediate same-task success, is the effectiveness signal.
    for (const method of new Set(samples.map(e => e.metadata.method))) {
      const matched = new Map<string, {before:Evidence;after:Evidence}>();
      for (const e of samples.filter(e=>e.metadata.method===method && e.target_skill===latest.target_skill && e.response_quality!<=1)) {
        const after=samples.find(next=>next.occurred_at>e.occurred_at&&next.target_skill===e.target_skill&&next.transfer_success!==null&&independent(next)&&next.metadata.difficulty===e.metadata.difficulty);
        if(after)matched.set(after.activity_id,{before:e,after});
      }
      const pairs=[...matched.values()].map(pair=>pair.before);const later=[...matched.values()].map(pair=>pair.after);
      if (!pairs.length) continue;
      const helpful = later.filter(e => e.transfer_success).length;
      patches.push({ kind: "effect", key: `${method}:${latest.target_skill}`, values: { teaching_method: method, target_skill: latest.target_skill, effectiveness_state: helpful === 0 ? "not_currently_showing_benefit" : helpful < pairs.length ? "mixed" : pairs.length >= 3 ? "repeatedly_helpful" : "promising", confidence_level: pairs.length >= 3 ? 2 : 1, evidence_count: pairs.length, last_observed_at: latest.occurred_at }, evidence: unique([...pairs,...later]).map(e => e.id) });
    }
  }
  // Pending batches may affect the same method/skill through multiple knowledge items.
  const consolidated=new Map<string,Patch>();
  for(const patch of patches){const key=`${patch.kind}:${patch.key}`;const old=consolidated.get(key);consolidated.set(key,old?{...patch,evidence:[...new Set([...old.evidence,...patch.evidence])]}:patch);}
  return { patches:[...consolidated.values()], applied: pending.map(e => e.id) };
}
