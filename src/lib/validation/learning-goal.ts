import { z } from "zod";

export const learningGoalInputSchema = z.object({
  goalType: z.string().trim().min(1).max(80),
  priority: z.number().int().min(1).max(5),
  isActive: z.boolean().default(true),
  description: z.string().trim().max(500).nullable().optional(),
});
