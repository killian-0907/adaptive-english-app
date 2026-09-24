import { z } from "zod";

export const dimensions = ["listening", "spoken_expression", "spoken_fluency", "conversational_response", "intelligibility", "reading", "written_expression", "vocabulary", "grammar", "sentence_formation", "practical_communication"] as const;
export type Dimension = typeof dimensions[number];
export type Modality = "reading_recognition" | "listening_recognition" | "written_production" | "spoken_production" | "real_life_use";
export const methods = ["conversation", "listening", "reading", "writing", "examples", "repetition"] as const;
export const onboardingSchema = z.object({
  nativeLanguage: z.enum(["zh", "en", "es"]), interfaceLanguage: z.enum(["zh", "en", "es"]),
  goals: z.array(z.enum(["daily_communication", "work", "school", "exams"])).min(1).max(4),
  experience: z.enum(["none", "some_school", "regular_use"]),
  liked: z.array(z.enum(methods)).max(6), disliked: z.array(z.enum(methods)).max(6),
  correction: z.enum(["immediate", "after_turn", "gentle"]), pace: z.enum(["gentle", "balanced", "brisk"]).nullable(),
}).strict().refine(v => !v.liked.some(m => v.disliked.includes(m)), "A method cannot be both preferred and disliked.");
export const supportSchema = z.object({ hints: z.number().int().min(0).max(20), replays: z.number().int().min(0).max(20), retries: z.number().int().min(0).max(10), translation: z.boolean(), transcript: z.boolean() }).strict();
export type Support = z.infer<typeof supportSchema>;
export const responseSchema = z.object({ activityId: z.uuid(), text: z.string().max(3000), voiceId: z.uuid().nullable(), skip: z.boolean(), dontKnow: z.boolean().default(false), fatigue: z.boolean(), support: supportSchema }).strict();
export type Answer = z.infer<typeof responseSchema>;
const score = z.number().int().min(0).max(4);
export const evaluationSchema = z.object({
  communicative_success: score, comprehension_success: score, meaning_accuracy: score,
  sentence_quality: score, vocabulary_retrieval: score,
  grammar_observations: z.array(z.enum(["word_order", "tense", "agreement", "missing_words"])).max(4),
  likely_error_categories: z.array(z.enum(["word_order", "tense", "agreement", "missing_words", "task_misunderstanding"])).max(5),
  support_required: z.number().int().min(0).max(3), evaluator_confidence: z.number().int().min(0).max(3),
  recommended_evidence: z.array(z.object({ skill: z.enum(dimensions), quality: score }).strict()).max(11),
}).strict();
export type Evaluation = z.infer<typeof evaluationSchema>;
export type Observation = { itemId: string; skill: Dimension; modality: Modality; quality: number; difficulty: number; support: number; confidence: number; knowledge: string; errors: string[] };
export type Turn = { itemId: string; quality: number | null; difficulty: number; support: number; observations: Observation[] };
export type AssessmentState = { version: 1; turns: Turn[]; difficulty: number; complete: boolean; reason: string | null };
export const initialState = (): AssessmentState => ({ version: 1, turns: [], difficulty: 0, complete: false, reason: null });
