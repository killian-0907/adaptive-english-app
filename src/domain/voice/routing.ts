import { z } from "zod";

export const voiceSettingsSchema = z.object({
  input: z.enum(["speaking", "typing"]).default("speaking"),
  voice: z.string().max(300).default(""),
  rate: z.number().min(0.7).max(1.25).default(1),
  autoplay: z.boolean().default(false),
  enhanced: z.boolean().default(false),
  transcript: z.enum(["on_request","after_attempt","automatic"]).default("on_request"),
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;
export const defaultVoiceSettings = voiceSettingsSchema.parse({});
export type Capabilities = { tts: boolean; stt: boolean; microphone: "granted" | "prompt" | "denied" | "unknown"; englishVoice: boolean; recognitionLanguage: "en-US" };
export const noCapabilities: Capabilities = { tts: false, stt: false, microphone: "unknown", englishVoice: false, recognitionLanguage: "en-US" };
export function capabilityState(c: Capabilities) {
  if (c.microphone === "denied") return "microphone_denied";
  if (c.tts && c.stt) return "full_voice_available";
  if (c.tts) return "tts_only";
  if (c.stt) return "recognition_only";
  return "typed_fallback_only";
}
export function resolveVoice(c: Capabilities, settings: VoiceSettings, enhancedAvailable: boolean, failed: { enhanced?: boolean; tts?: boolean; stt?: boolean } = {}) {
  const enhanced = settings.enhanced && enhancedAvailable && !failed.enhanced;
  return {
    tts: enhanced ? "openai" : c.tts && !failed.tts ? "browser_native" : "text_fallback",
    stt: settings.input === "typing" || c.microphone === "denied" ? "typed_fallback" : enhanced ? "openai" : c.stt && !failed.stt ? "browser_native" : "typed_fallback",
  } as const;
}
