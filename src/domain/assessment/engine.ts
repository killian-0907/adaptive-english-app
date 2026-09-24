import type { AssessmentState, Observation, Turn } from "./contracts";
import { getItem, items } from "./items";

export function languageSupport(difficulty: number, struggle = false) { return struggle || difficulty <= 1 ? "native_supported" : difficulty <= 3 ? "english_with_fallback" : "mostly_english"; }
export function nextItem(state: AssessmentState) {
  if (state.complete) return null;
  const used = new Set(state.turns.map(t => t.itemId));
  const covered = new Set(state.turns.map(t => getItem(t.itemId).type));
  const order = ["listening", "spoken", "practical", "reading", "written", "recognition"];
  // Prefer untested modalities. At the floor, offer meaning recognition before writing.
  if (state.difficulty === 0 && state.turns.length >= 2) order.splice(3, 0, order.pop()!);
  const candidates = items.filter(i => !used.has(i.id));
  return candidates.sort((a, b) => (Math.abs(a.difficulty - state.difficulty) * 20 + (covered.has(a.type) ? 8 : 0) + order.indexOf(a.type)) - (Math.abs(b.difficulty - state.difficulty) * 20 + (covered.has(b.type) ? 8 : 0) + order.indexOf(b.type)))[0] ?? null;
}
export function advance(state: AssessmentState, turn: Turn, fatigue = false): AssessmentState {
  if (state.complete || state.turns.some(t => t.itemId === turn.itemId)) return state;
  const turns = [...state.turns, turn];
  const last = turns.slice(-2);
  const easy = last.length === 2 && last.every(t => t.quality !== null && t.quality >= 3 && t.support === 0);
  const struggle = turn.quality !== null && turn.quality <= 1;
  const difficulty = Math.max(0, Math.min(5, state.difficulty + (easy ? 2 : struggle ? -1 : 0)));
  const covered = new Set(turns.map(t => getItem(t.itemId).type));
  let reason: string | null = null;
  if (fatigue && turns.length >= 2) reason = "fatigue";
  else if (turns.length >= 4 && turns.slice(-4).every(t => t.difficulty === 0 && t.quality !== null && t.quality <= 1)) reason = "beginner_floor";
  else if (turns.length >= 8 && covered.size >= 5 && turns.filter(t => t.difficulty >= 4 && (t.quality ?? 0) >= 3).length >= 3) reason = "strong_fast_path";
  else if (turns.length >= 10 && covered.size >= 5 && turns.slice(-3).every(t => t.difficulty === turn.difficulty && t.quality !== null && Math.abs(t.quality - (turn.quality ?? 0)) <= 1)) reason = "stable_evidence";
  else if (turns.length >= 14) reason = "length_limit";
  return { version: 1, turns, difficulty, complete: !!reason, reason };
}
export function initialModel(observations: Observation[]) {
  const skills = [...new Set(observations.map(o => o.skill))];
  return skills.map(skill => {
    const relevant = observations.filter(o => o.skill === skill && o.confidence > 0);
    const independent = relevant.filter(o => o.support === 0);
    const values = relevant.map(o => Math.max(0, Math.min(6, o.difficulty + (o.quality >= 3 ? 1 : o.quality <= 1 ? -1 : 0))));
    const consistent = values.length > 1 && Math.max(...values) - Math.min(...values) <= 1;
    return { dimension: skill, estimate_level: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      confidence_level: relevant.length === 0 ? 0 : independent.length >= 3 && consistent && relevant.every(o => o.confidence >= 2) ? 2 : 1 };
  });
}
