import { z } from "zod";
import { storage } from "./secure-storage";
const schema = z.object({
  voice: z.string().max(300),
  rate: z.number().min(0.7).max(1.25),
});
export async function voiceSettings() {
  try {
    return schema.parse(
      JSON.parse((await storage.getItem("voice-preferences")) ?? "null"),
    );
  } catch {
    return { voice: "", rate: 1 };
  }
}
export async function saveVoiceSettings(value: z.infer<typeof schema>) {
  await storage.setItem(
    "voice-preferences",
    JSON.stringify(schema.parse(value)),
  );
}
