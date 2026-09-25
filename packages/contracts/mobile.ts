import { z } from "zod";
export {
  onboardingSchema,
  supportSchema,
  responseSchema,
} from "../../src/domain/assessment/contracts";
export {
  settingsSchema,
  goalKeys,
  languageKeys,
} from "../../src/domain/product/settings";
export {
  commandSchema,
  feedbackKinds,
  methods,
} from "../../src/domain/learning/types";
export {
  betaFeedbackSchema,
  feedbackCategories,
} from "../../src/lib/validation/beta-feedback";
export { MOBILE_API_VERSION } from "../../src/domain/auth/request";
import { supportSchema } from "../../src/domain/assessment/contracts";
const strings = z.array(z.string());
export const progressSchema = z.object({
  cards: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      stage: z.string(),
      note: z.string(),
      uncertain: z.boolean(),
    }),
  ),
  gaps: strings,
  timeline: z.array(
    z.object({ id: z.string(), date: z.string(), text: z.string() }),
  ),
  needs: strings,
  reviewSuggested: z.boolean(),
});
export const homeSchema = z.object({
  progress: progressSchema,
  focus: z.string(),
  active: z.boolean(),
});
export const historySchema = z.array(
  z.object({
    id: z.string(),
    started: z.string(),
    ended: z.string().nullable(),
    count: z.number(),
    focus: strings,
    scenarios: strings,
    skills: strings,
    expressions: strings,
    next: z.string(),
    note: z.string(),
    limited: z.boolean(),
  }),
);
export const membershipSchema = z.object({
  current: z.object({
    name: z.string(),
    future: z.array(z.object({ label: z.string(), eligible: z.boolean() })),
    paymentNotice: z.string(),
  }),
  plans: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      features: z.array(
        z.object({ label: z.string(), available: z.boolean() }),
      ),
    }),
  ),
});
export const bootstrapSchema = z.object({
  apiVersion: z.literal("1"),
  userId: z.uuid(),
  email: z.string(),
  language: z.enum(["en", "zh", "es"]),
  entry: z.enum(["onboarding", "assessment", "home"]),
  active: z.boolean(),
});
const summarySchema = z.object({
  completedScenarios: strings,
  practiced: strings,
  worked: strings,
  needsPractice: strings,
  expressions: strings,
  next: z.string(),
});
export const learningSchema = z.object({
  kind: z.enum(["start", "assessment_required", "activity", "summary"]),
  sessionId: z.uuid().optional(),
  activityId: z.uuid().optional(),
  objective: z.string().optional(),
  method: z.string().optional(),
  prompt: z.string().optional(),
  options: strings.optional(),
  spoken: z.boolean().optional(),
  audio: z.boolean().optional(),
  support: z.number().optional(),
  supportText: z.string().optional(),
  nativeHelp: z.string().optional(),
  transcript: z.string().optional(),
  correction: z.string().optional(),
  speed: z.number().optional(),
  summary: summarySchema.optional(),
  voiceAllowed: z.boolean().optional(),
  speechText: z.string().optional(),
  frame: z.string().optional(),
  savedVoice: z
    .object({ id: z.uuid(), transcript: z.string().nullable() })
    .nullable()
    .optional(),
});
const profile = z.object({
  native_language: z.string().nullable(),
  interface_language: z.string().nullable(),
  onboarding_status: z.string(),
});
export const assessmentSchema = z.discriminatedUnion("onboarding", [
  z.object({ onboarding: z.literal(true), profile }),
  z.object({
    onboarding: z.literal(false),
    complete: z.boolean(),
    profile,
    count: z.number(),
    activityId: z.uuid().optional(),
    savedVoice: z
      .object({ id: z.uuid(), transcript: z.string().nullable() })
      .nullable()
      .optional(),
    savedSupport: supportSchema.optional(),
    support: z.string().optional(),
    voiceAllowed: z.boolean().optional(),
    item: z
      .object({
        id: z.string(),
        type: z.string(),
        prompt: z.string(),
        options: strings,
        hasAudio: z.boolean(),
        speechText: z.string().optional(),
        spoken: z.boolean(),
        instruction: z.string(),
        hint: z.string(),
      })
      .optional(),
    result: z
      .object({
        model: z.array(
          z.object({
            dimension: z.string(),
            estimate_level: z.number(),
            confidence_level: z.number(),
          }),
        ),
        support: z.string(),
      })
      .optional(),
  }),
]);
export type LearningDTO = z.infer<typeof learningSchema>;
export type AssessmentDTO = z.infer<typeof assessmentSchema>;
export type BootstrapDTO = z.infer<typeof bootstrapSchema>;
