import { z } from "zod";

const languageTag = z.string().trim().min(2).max(35);

export const profileInputSchema = z.object({
  nativeLanguage: languageTag.nullable().optional(),
  interfaceLanguage: languageTag.nullable().optional(),
  onboardingStatus: z.enum(["not_started", "in_progress", "completed"]).optional(),
});
