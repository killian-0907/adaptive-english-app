import type { Answer, Evaluation, Observation, Turn } from "./contracts";
import type { Item } from "./items";

export function scoreResponse(item: Item, answer: Answer, evaluation: Evaluation | null, voice: boolean) {
  const support = Math.min(6, answer.support.hints + answer.support.retries + Math.max(0, answer.support.replays - 1) + Number(answer.support.translation) + Number(answer.support.transcript));
  // A skip or inaccessible audio is missing evidence, not demonstrated weakness.
  const quality = answer.skip ? null : item.strategy === "exact" ? Number(answer.text.trim().toLowerCase() === item.answer?.toLowerCase()) * 4 : evaluation?.communicative_success ?? null;
  const audioContaminated = item.type === "listening" && answer.support.transcript;
  const skills = item.expectedSkills.filter(s => s === item.skill || !(s.startsWith("spoken") || s === "conversational_response") || voice);
  const observations: Observation[] = quality === null || audioContaminated ? [] : skills.flatMap(skill => {
    const recommended = evaluation?.recommended_evidence.find(e => e.skill === skill);
    if (item.strategy === "evaluator" && !recommended && skill !== item.skill) return [];
    // Spoken fallback is writing evidence only; never infer speech from typed text.
    const actualSkill = !voice && (item.type === "spoken" || item.type === "practical") && skill === item.skill ? "written_expression" : skill;
    return [{ itemId: item.id, skill: actualSkill, modality: !voice && (item.type === "spoken" || item.type === "practical") ? "written_production" : skill === "practical_communication" ? "real_life_use" : item.modality,
      quality: recommended?.quality ?? quality, difficulty: item.difficulty, support: Math.max(support, evaluation?.support_required ?? 0), confidence: voice ? Math.min(1, evaluation?.evaluator_confidence ?? 1) : evaluation?.evaluator_confidence ?? 3, knowledge: item.knowledge,
      errors: evaluation?.likely_error_categories ?? [] } satisfies Observation];
  });
  const turn: Turn = { itemId: item.id, quality: answer.dontKnow ? 0 : audioContaminated ? null : quality, difficulty: item.difficulty, support, observations };
  const events = observations.map(o => ({ evidence_kind: `${o.modality}_performance`, target_skill: o.skill, modality: o.modality, result: o.quality >= 3 ? "success" : o.quality >= 2 ? "partial" : "failure", response_quality: o.quality, evaluator_confidence_level: o.confidence, support_level: o.support, metadata: { ...o } }));
  const interactions: Record<string, boolean | number> = { task_misunderstanding: answer.dontKnow, hint_use: answer.support.hints, retry_use: answer.support.retries, replay_count: answer.support.replays, transcript_reveal: answer.support.transcript, translation_use: answer.support.translation, skipped: answer.skip, fatigue: answer.fatigue, voice_uncertainty: (item.type === "spoken" || item.type === "practical") && !voice };
  return { turn, events: [...events, ...Object.entries(interactions).filter(([, value]) => !!value).map(([kind, value]) => ({ evidence_kind: kind, target_skill: null, modality: null, result: "neutral", response_quality: null, evaluator_confidence_level: 0, support_level: support, metadata: { value } }))] };
}
