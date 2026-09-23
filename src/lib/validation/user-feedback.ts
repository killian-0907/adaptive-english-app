import { z } from "zod";

export const userFeedbackInputSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  activityId: z.string().uuid().nullable().optional(),
  feedbackType: z.string().trim().min(1).max(80),
  valueText: z.string().trim().max(200).nullable().optional(),
  valueScore: z.number().int().min(-5).max(5).nullable().optional(),
  freeText: z.string().trim().max(1000).nullable().optional(),
});
