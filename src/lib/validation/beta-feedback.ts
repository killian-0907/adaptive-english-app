import { z } from "zod";
export const feedbackCategories = ["lesson", "easy", "difficult", "voice", "bug", "confusing", "other"] as const;
export const betaFeedbackSchema = z.object({ category: z.enum(feedbackCategories), text: z.string().trim().min(1).max(1000), route: z.enum(["/settings", "/home", "/learn", "/my-english", "/history", "/assessment", "/membership"]) }).strict();
export function browserFamily(ua: string) { return /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other"; }
export function feedbackRow(input: z.infer<typeof betaFeedbackSchema>, version: string, ua: string) {
  return { feedback_type: `beta_${input.category}`, free_text: input.text,
    value_text: JSON.stringify({ route: input.route, version: /^[a-f0-9]{12}$/.test(version) ? version : "development", browser: browserFamily(ua) }) };
}
