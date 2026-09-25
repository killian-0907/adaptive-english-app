import { z } from "zod";
import { feedbackKinds } from "./types";

// Deliberately excludes prompts, answers, transcripts, email addresses and free text.
export const qualityEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("activity"), quality: z.number().int().min(0).max(4).nullable(), support: z.number().int().min(0).max(6), exposure: z.number().int().min(1).max(5), difficulty: z.number().int().min(0).max(5), struggle: z.boolean(), easy: z.boolean(), typedFallback: z.boolean(), replay: z.number().int().min(0).max(20), transfer: z.boolean().nullable(), skipped: z.boolean(), methodChanged: z.boolean(), scenarioRepeated: z.boolean(), estimateChanged: z.boolean() }).strict(),
  z.object({ kind: z.literal("feedback"), value: z.enum(feedbackKinds), support: z.number().int().min(0).max(6).optional(), quality: z.number().int().min(0).max(4).nullable().optional() }).strict(),
  z.object({ kind: z.literal("support"), value: z.enum(["next", "native", "transcript", "replay"]) }).strict(),
  z.object({ kind: z.literal("session_completed") }).strict(),
]);
export type QualityEvent = z.infer<typeof qualityEventSchema>;
export function aggregateQuality(input: unknown[]) {
  const events = input.flatMap(value => { const parsed = qualityEventSchema.safeParse(value); return parsed.success ? [parsed.data] : []; });
  const activities = events.filter(e => e.kind === "activity");
  const rate = (n: number, d = activities.length) => d ? Number((n / d).toFixed(3)) : null;
  const transfer = activities.filter(e => e.transfer !== null);
  const feedback = events.filter(e => e.kind === "feedback");
  return { activities: activities.length, completionRate: rate(activities.filter(e => !e.skipped).length), repeatedStruggleRate: rate(activities.filter(e => e.struggle).length), repeatedEasyRate: rate(activities.filter(e => e.easy).length), methodRejectionRate: rate(feedback.filter(e => e.value === "reject_method").length, feedback.length), supportDistribution: [0,1,2,3,4,5,6].map(level => activities.filter(e => e.support === level).length), exposureDistribution: [1,2,3,4,5].map(level => activities.filter(e => e.exposure === level).length), scenarioRepetitionRate: rate(activities.filter(e => e.scenarioRepeated).length), transferSuccessRate: rate(transfer.filter(e => e.transfer).length, transfer.length), estimateCorrectionFrequency: rate(activities.filter(e => e.estimateChanged).length), difficultyFeedbackWithSupport: feedback.filter(e=>e.value==="too_difficult"&&(e.support??0)>0).length, difficultyFeedbackDespiteIndependentSuccess: feedback.filter(e=>e.value==="too_difficult"&&e.support===0&&(e.quality??0)>=3).length, completedSessions: events.filter(e => e.kind === "session_completed").length, sessionAbandonment: null };
}
