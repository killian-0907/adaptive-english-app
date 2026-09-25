import { evidenceSchema, type Decision, type Snapshot, type Task } from "./types";
import { transferResult } from "./transfer";
import { scoreLearning } from "./evaluation";

// One evidence boundary for production and deterministic QA. Neither caller sets model output.
export function learningEvidence(input: {
  snapshot: Snapshot; task: Task; decision: Decision; scored: ReturnType<typeof scoreLearning>;
  id: string; activityId: string; knowledgeId: string | null; now: string;
  browserVoice: boolean; nativeVoice?: boolean; voice: boolean; replay: number; transcript: boolean;
  retries: number; elapsedMs: number | null; skip: boolean; evaluationStrategy: string;
}) {
  const { snapshot: s, task, decision, scored, browserVoice, voice, retries } = input;
  const { quality, errors, support, skill, modality } = scored;
  const confidence = browserVoice ? Math.min(1, scored.confidence) : scored.confidence;
  return evidenceSchema.parse({
    id: input.id, session_id: s.sessionId, activity_id: input.activityId, target_skill: quality === null ? null : skill,
    knowledge_item_id: input.knowledgeId, modality, source: input.evaluationStrategy === "AI_STRUCTURED" ? "evaluator" : "deterministic",
    evidence_kind: "learning_performance", result: quality === null ? "neutral" : quality >= 3 ? "success" : quality >= 2 ? "partial" : "failure",
    response_quality: quality, support_level: support, evaluator_confidence_level: confidence,
    transfer_success: transferResult(s, task, decision, quality, support, confidence, browserVoice, retries),
    voice_uncertainty: browserVoice, response_time_ms: input.elapsedMs, dedupe_key: `${input.activityId}:learning:performance`,
    occurred_at: input.now, processor_status: "pending", metadata: {
      // The small beta catalog cannot establish advanced mastery merely by relabeling a short phrase.
      difficulty: Math.min(decision.difficulty, task.scenario ? (task.scenario.function === "repair" ? 3 : 1) : 2), method: decision.method, topic: task.topic, taskKey: task.key, errors,
      sessionState: s.state, misunderstood: errors.includes("task_misunderstanding"),
      firstListen: task.modality === "listening_recognition" && input.replay === 1 && !input.transcript,
      retries, timed: false, skipped: input.skip, evaluationStrategy: input.evaluationStrategy,
      voiceProvider: input.nativeVoice ? "native_os" : browserVoice ? "browser_native" : voice ? "openai" : "typed",
      acousticUncertainty: browserVoice, scenarioFamily: task.scenario?.family,
    },
  });
}
