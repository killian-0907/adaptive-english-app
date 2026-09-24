import type { Evaluation } from "../assessment/contracts";
import type { Item } from "../assessment/items";
export interface VoiceProvider {
  speak(text: string): Promise<ArrayBuffer>;
  transcribe(audio: File): Promise<{ text: string; duration?: number; segments?: {start:number;end:number;text:string;avg_logprob:number;no_speech_prob:number}[] }>;
}
export interface AssessmentEvaluator { evaluate(item: Item, response: string): Promise<Evaluation> }
