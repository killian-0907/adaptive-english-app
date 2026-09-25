import { z } from "zod";
import { dimensions, type Dimension, type Modality } from "../assessment/contracts";
export const VERSION = "learning-v1";
export const methods = ["conversation", "role_play", "listening", "speaking", "sentence_building", "vocabulary_context", "grammar_explanation", "guided_writing", "review", "transfer"] as const;
export type Method = typeof methods[number];
export type Purpose = "weakness_repair" | "review" | "progression" | "transfer" | "communication" | "consolidation";
export const feedbackKinds = ["reject_method", "too_difficult", "cannot_understand", "cannot_retrieve", "less_correction", "more_speaking", "tired", "bored", "frustrated", "engaged", "normal", "provider_fallback"] as const;
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("end"), sessionId: z.uuid() }).strict(),
  z.object({ action: z.literal("feedback"), activityId: z.uuid(), kind: z.enum(feedbackKinds) }).strict(),
  z.object({ action: z.literal("support"), activityId: z.uuid(), kind: z.enum(["next", "native", "transcript", "replay"]) }).strict(),
  z.object({ action: z.literal("tts"), activityId: z.uuid() }).strict(),
  z.object({ action: z.literal("answer"), activityId: z.uuid(), text: z.string().max(3000), voiceId: z.uuid().nullable(), skip: z.boolean(), elapsedMs: z.number().int().min(0).max(3600000).nullable() }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export type Ability = { dimension: Dimension; estimate_level: number; confidence_level: number; trend?: string; last_evidence_at?: string | null };
export type Knowledge = { knowledge_item_id: string; modality: Modality; state: string; confidence_level: number; review_need: number; last_evidence_at: string | null };
export type Pattern = { pattern_key: string; mistake_category: string; knowledge_item_id: string | null; modality: Modality | null; confidence_level: number; severity_level: number; occurrence_count: number; status: string };
export type Effect = { teaching_method: string; target_skill: Dimension | null; effectiveness_state: string; confidence_level: number; evidence_count: number };
export type Preference = { preference_type: string; target_key: string; strength: number; value_text: string | null };
export type Task = { key: string; knowledgeId?: string; topic: string; prompt: string; context: string; options: string[]; answer: string | null; model: string; explanation: string; native: Record<string, string>; skill: Dimension; modality: Modality; strategy: "exact" | "evaluator"; audio: boolean; spoken: boolean; variant: number };
export type Decision = { objective: string; targetSkill: Dimension; topic: string; purpose: Purpose; method: Method; scenario: string; difficulty: number; exposure: number; nativeSupport: number; correction: "immediate" | "delayed" | "hint_first" | "model_response" | "move_on"; support: { initial: number; max: number }; collect: string[]; triggers: string[]; returnRule: string; reasons: string[]; version: string; listening: { speed: number; transcript: boolean; replay: boolean; turns: number }; speaking: { words: number; preparationSeconds: number; frame: boolean; followUp: boolean }; difficultyState: string; feedbackDue: boolean };
export type History = { id: string; session_id: string; status: string; created_at: string; metadata: { decision: Decision; task: Task; support?: number; replay?: number; transcript?: boolean; quality?: number | null; feedback?: string; correction?: string; elapsedMs?: number | null } };
export const evidenceSchema = z.object({
  id: z.uuid(), session_id: z.uuid(), activity_id: z.uuid(), target_skill: z.enum(dimensions).nullable(), knowledge_item_id: z.uuid().nullable(), modality: z.enum(["reading_recognition", "listening_recognition", "written_production", "spoken_production", "real_life_use"]).nullable(),
  source: z.enum(["deterministic", "evaluator", "user_feedback", "voice_processor", "system"]), evidence_kind: z.string().min(1).max(120), result: z.enum(["success", "partial", "failure", "neutral"]), response_quality: z.number().int().min(0).max(4).nullable(), support_level: z.number().int().min(0).max(6), evaluator_confidence_level: z.number().int().min(0).max(3), transfer_success: z.boolean().nullable(), voice_uncertainty: z.boolean(), response_time_ms: z.number().int().min(0).nullable(), dedupe_key: z.string().min(16).max(200), occurred_at: z.string(), processor_status: z.enum(["pending", "applied", "failed", "processing"]),
  metadata: z.object({ difficulty: z.number().int().min(0).max(5), method: z.enum(methods), topic: z.string(), taskKey: z.string(), errors: z.array(z.string()), sessionState: z.string(), misunderstood: z.boolean(), firstListen: z.boolean(), retries: z.number().int().min(0), timed: z.boolean() }).strict(),
}).strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export type Snapshot = { revision: number; sessionId: string; language: string; abilities: Ability[]; knowledge: Knowledge[]; patterns: Pattern[]; effects: Effect[]; preferences: Preference[]; goals: string[]; evidence: Evidence[]; history: History[]; state: string; catalog: { id: string; normalized_key: string }[] };
export type Patch = { kind: "ability" | "knowledge" | "pattern" | "effect"; key: string; values: Record<string, unknown>; evidence: string[] };
