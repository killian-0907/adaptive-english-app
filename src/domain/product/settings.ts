import { z } from "zod";
import { methods, type Preference } from "../learning/types";

export const goalKeys=["daily_communication","work","school","exams"] as const;
export const languageKeys=["en","zh","es"] as const;
export const settingsSchema=z.object({
  nativeLanguage:z.enum(languageKeys),interfaceLanguage:z.enum(languageKeys),
  goals:z.array(z.object({key:z.enum(goalKeys),priority:z.number().int().min(1).max(5)}).strict()).min(1).max(4).refine(g=>new Set(g.map(x=>x.key)).size===g.length,"Choose each goal once."),
  methods:z.record(z.enum(methods),z.number().int().min(-2).max(2)),
  correction:z.enum(["immediate","gentle","after_turn","minimal"]),pace:z.enum(["gentle","balanced","brisk"]),
}).strict();
export type ProductSettings=z.infer<typeof settingsSchema>;
export const methodLabels:Record<typeof methods[number],string>={conversation:"Conversation",role_play:"Role-play",listening:"Listening",speaking:"Speaking",sentence_building:"Sentence building",vocabulary_context:"Vocabulary in context",grammar_explanation:"Grammar explanations",guided_writing:"Writing",review:"Review",transfer:"Using English in a new situation"};
export const goalLabels:Record<typeof goalKeys[number],string>={daily_communication:"Daily communication",work:"Work",school:"School",exams:"Exams"};
export const correctionLabels={immediate:"Correct me often",gentle:"Focus on important mistakes",after_turn:"Let me finish before correcting",minimal:"Minimal correction during conversation"};
export const paceLabels={gentle:"Gentle",balanced:"Balanced",brisk:"Challenging"};
export function editablePreferences(preferences:Preference[]){
  const aliases:Record<string,string>={role_play:"conversation",speaking:"conversation",guided_writing:"writing",sentence_building:"writing",review:"repetition",vocabulary_context:"examples",grammar_explanation:"examples",transfer:"conversation"};
  const values=Object.fromEntries(methods.map(key=>[key,preferences.find(p=>p.preference_type==="method"&&p.target_key===key)?.strength??preferences.find(p=>p.preference_type==="method"&&p.target_key===aliases[key])?.strength??0])) as ProductSettings["methods"];
  const correction=preferences.find(p=>p.preference_type==="correction")?.value_text;
  const pace=preferences.find(p=>p.preference_type==="pace")?.value_text;
  return {methods:values,correction:correction&&correction in correctionLabels?correction as ProductSettings["correction"]:"after_turn" as const,pace:pace&&pace in paceLabels?pace as ProductSettings["pace"]:"balanced" as const};
}
