import { advance, initialModel, nextItem } from "../domain/assessment/engine";
import { initialState, type Dimension } from "../domain/assessment/contracts";
import { scoreResponse } from "../domain/assessment/evidence";
import { decide } from "../domain/learning/engine";
import { planContent } from "../domain/learning/scenarios";
import { scoreLearning } from "../domain/learning/evaluation";
import { learningEvidence } from "../domain/learning/evidence";
import { processEvidence } from "../domain/learning/processor";
import type { Ability, Decision, Effect, Evidence, History, Knowledge, Patch, Pattern, Preference, Snapshot, Task } from "../domain/learning/types";

export type Persona = { name: string; skills: Partial<Record<Dimension, number>>; baseline: number; goals: string[]; preferences?: Preference[]; fatigue?: boolean; reject?: string; mistakes?: number; recognitionBonus?: number; methodGain?: Record<string, number>; assessmentBias?: number };
const preference = (target_key: string, strength: number): Preference => ({ preference_type: "method", target_key, strength, value_text: null });
export const personas: Persona[] = [
  { name: "zero_beginner", baseline: 0, skills: {}, goals: ["daily_communication"] },
  { name: "basic_communicator", baseline: 1, skills: { sentence_formation: 0, spoken_expression: 0 }, goals: ["daily_communication"] },
  { name: "reading_not_listening", baseline: 2, skills: { reading: 4, vocabulary: 4, listening: 0 }, goals: ["daily_communication"] },
  { name: "recognition_not_retrieval", baseline: 1, skills: { spoken_expression: 0 }, recognitionBonus: 3, goals: ["daily_communication"] },
  { name: "grammar_not_communication", baseline: 1, skills: { grammar: 4, written_expression: 3, spoken_expression: 0 }, goals: ["daily_communication"] },
  { name: "speaker_not_writer", baseline: 2, skills: { spoken_expression: 4, written_expression: 0 }, goals: ["daily_communication"] },
  { name: "work", baseline: 2, skills: {}, goals: ["work"] },
  { name: "daily", baseline: 2, skills: {}, goals: ["daily_communication"] },
  { name: "exam", baseline: 3, skills: {}, goals: ["exams"] },
  { name: "advanced", baseline: 5, skills: {}, goals: ["work"], mistakes: 0.01, assessmentBias: -2 },
  { name: "tired", baseline: 3, skills: {}, goals: ["daily_communication"], fatigue: true },
  { name: "method_rejection", baseline: 2, skills: {}, goals: ["daily_communication"], reject: "sentence_building" },
  { name: "role_play_lover", baseline: 2, skills: {}, goals: ["daily_communication"], preferences: [preference("role_play", 2)], methodGain: { sentence_building: 1, role_play: -0.5 } },
  { name: "inconsistent", baseline: 2, skills: {}, goals: ["daily_communication"], mistakes: 0.35 },
];
export const qaId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function random(seed: number) { let value = seed >>> 0; return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; }; }

// In-memory persistence applies only patches emitted by the real evidence processor.
function apply(s: Snapshot, patches: Patch[]) {
  for (const patch of patches) {
    const merge = <T>(rows: T[], match: (row: T) => boolean) => { const index = rows.findIndex(match); if (index < 0) rows.push(patch.values as T); else rows[index] = { ...rows[index], ...patch.values }; };
    if (patch.kind === "ability") merge<Ability>(s.abilities, row => row.dimension === patch.key);
    if (patch.kind === "knowledge") merge<Knowledge>(s.knowledge, row => `${row.knowledge_item_id}:${row.modality}` === patch.key);
    if (patch.kind === "pattern") merge<Pattern>(s.patterns, row => row.pattern_key === patch.key);
    if (patch.kind === "effect") merge<Effect>(s.effects, row => `${row.teaching_method}:${row.target_skill}` === patch.key);
  }
}
export type Step = { session: number; decision: Decision; task: Pick<Task, "key" | "modality" | "scenario">; quality: number | null; support: number; evidence: Pick<Evidence, "target_skill" | "modality" | "voice_uncertainty" | "transfer_success">; abilities: Ability[]; state: string; feedback?: string };
export function simulate(persona: Persona, seed = 1, sessions = 20, browserVoice = false) {
  const rng = random(seed); let serial = 100; const start = Date.parse("2026-01-01T00:00:00Z");
  let assessment = initialState();
  for (let i = 0; i < 14 && !assessment.complete; i++) {
    const item = nextItem(assessment); if (!item) break;
    const skill = (persona.skills[item.skill] ?? persona.baseline) + (persona.assessmentBias ?? 0);
    const success = rng() < Math.max(0.05, Math.min(0.98, 0.6 + (skill - item.difficulty) * 0.18));
    const answer = { activityId: qaId(serial++), text: success ? item.answer ?? "Hello" : item.options.find(o => o !== item.answer) ?? "Not sure", voiceId: null, skip: false, dontKnow: false, fatigue: false, support: { hints: 0, replays: 1, retries: 0, translation: false, transcript: false } };
    // No paid assessment evaluator is invented: open-ended answers remain unscored, like the free beta.
    assessment = advance(assessment, scoreResponse(item, answer, null, false).turn);
  }
  const initial = initialModel(assessment.turns.flatMap(turn => turn.observations));
  const s: Snapshot = { revision: 0, sessionId: qaId(1), language: "zh", abilities: structuredClone(initial), knowledge: [], patterns: [], effects: [], preferences: structuredClone(persona.preferences ?? []), goals: persona.goals, evidence: [], history: [], state: "normal", catalog: [] };
  const steps: Step[] = [];
  for (let session = 0; session < sessions; session++) {
    s.sessionId = qaId(10 + session); s.state = persona.fatigue && session % 7 === 5 ? "tired" : "normal";
    for (let turn = 0; turn < 8; turn++) {
      // Includes a long gap to exercise stale confidence/review; bounds match the database snapshot.
      const now = new Date(start + (session * 2 + (session >= 15 ? 90 : 0)) * 86400000 + turn * 60000);
      const { decision, task } = planContent(s, decide(s, now)); const activityId = qaId(serial++);
      if (persona.reject === decision.method) {
        s.history.push({ id: activityId, session_id: s.sessionId, status: "interrupted", created_at: now.toISOString(), metadata: { decision, task, feedback: "reject_method", quality: null } });
        s.preferences = [...s.preferences.filter(p => p.target_key !== decision.method), preference(decision.method, -2)];
        steps.push({ session, decision, task, quality: null, support: 0, evidence: { target_skill: null, modality: null, voice_uncertainty: false, transfer_success: null }, abilities: structuredClone(s.abilities), state: s.state, feedback: "reject_method" });
        continue;
      }
      const trueSkill = (persona.skills[task.skill] ?? persona.baseline) + (task.modality.endsWith("recognition") ? persona.recognitionBonus ?? 0 : 0) + (persona.methodGain?.[decision.method] ?? 0);
      const support = decision.support.initial;
      const probability = Math.max(0.03, Math.min(0.99, 0.65 + (trueSkill - decision.difficulty) * 0.18 + support * 0.035 - (s.state === "tired" ? 0.45 : 0) - (persona.mistakes ?? 0.08)));
      const success = rng() < probability;
      const text = success ? task.answer ?? task.model : task.options.find(x => x !== task.answer) ?? "I am not sure";
      const scored = scoreLearning(task, text, null, task.spoken, false, support, false);
      let kid = s.catalog.find(k => k.normalized_key === `learning:${task.topic}`)?.id;
      if (!kid) { kid = qaId(serial++); s.catalog.push({ id: kid, normalized_key: `learning:${task.topic}` }); }
      const event = learningEvidence({ snapshot: s, task, decision, scored, id: qaId(serial++), activityId, knowledgeId: kid, now: now.toISOString(), browserVoice: task.spoken && browserVoice, voice: task.spoken, replay: task.audio ? 1 : 0, transcript: false, retries: 0, elapsedMs: 20000, skip: false, evaluationStrategy: task.criteria ? "LOCAL_BOUNDED" : "DETERMINISTIC" });
      const result = processEvidence(s, [event], now); apply(s, result.patches);
      s.evidence = [...s.evidence, { ...event, processor_status: "applied" as const }].slice(-500); s.revision++;
      s.history = [...s.history, { id: activityId, session_id: s.sessionId, status: "completed", created_at: now.toISOString(), metadata: { decision, task, quality: scored.quality, support, elapsedMs: 20000 } } satisfies History].slice(-100);
      steps.push({ session, decision, task, quality: scored.quality, support, evidence: event, abilities: structuredClone(s.abilities), state: s.state });
    }
  }
  return { persona: persona.name, seed, sessions, voiceAssumption: browserVoice ? "unverified_browser_transcript" : "synthetic_verified_transcript_no_acoustic_claim", assessment, initial, steps, snapshot: s };
}
export function trajectoryMetrics(run: ReturnType<typeof simulate>) {
  const steps = run.steps, count = steps.length;
  const rate = (test: (s: Step) => boolean) => Number((steps.filter(test).length / count).toFixed(3));
  let maxMethodRun = 0, same = 0, prior = "";
  let maxFocusedRun=0,focused=0,scenarioRepeats=0;
  for(let i=0;i<steps.length;i++){focused=["review","weakness_repair","consolidation"].includes(steps[i].decision.purpose)?focused+1:0;maxFocusedRun=Math.max(maxFocusedRun,focused);if(i&&steps[i].task.scenario&&steps[i].task.scenario?.family===steps[i-1].task.scenario?.family)scenarioRepeats++;}
  for (const step of steps) { same = prior === step.decision.method ? same + 1 : 1; maxMethodRun = Math.max(maxMethodRun, same); prior = step.decision.method; }
  return { persona: run.persona, seed: run.seed, sessions: run.sessions, activities: count, scoredRate: rate(s => s.quality !== null), struggleRate: rate(s => s.quality !== null && s.quality <= 1), easyRate: rate(s => s.decision.difficultyState === "too_easy"), listeningRate: rate(s => s.task.modality === "listening_recognition"), speakingRate: rate(s => s.task.modality === "spoken_production"), reviewRate: rate(s => s.decision.purpose === "review"), transferAttempts: steps.filter(s => s.evidence.transfer_success !== null).length, transferSuccesses: steps.filter(s => s.evidence.transfer_success === true).length, rejectionRate: rate(s => !!s.feedback), completionRate: rate(s=>!s.feedback), completedSessions: run.sessions, sessionAbandonmentRate: 0, maxFocusedRun, scenarioRepeatRate: Number((scenarioRepeats/count).toFixed(3)), transferOpportunityRate: rate(s=>s.decision.purpose==="transfer"), maxMethodRun, scenarioFamilies: new Set(steps.map(s => s.task.scenario?.family).filter(Boolean)).size, maxDifficulty: Math.max(...steps.map(s => s.decision.difficulty)), maxExposure: Math.max(...steps.map(s => s.decision.exposure)), independentRate: rate(s => s.support === 0), supportDistribution: Object.fromEntries([0,1,2,3,4,5,6].map(n => [n, steps.filter(s => s.support === n).length])), exposureDistribution: Object.fromEntries([1,2,3,4,5].map(n => [n, steps.filter(s => s.decision.exposure === n).length])), assessmentCorrections: run.snapshot.abilities.filter(a => a.estimate_level !== run.initial.find(i => i.dimension === a.dimension)?.estimate_level).length };
}
