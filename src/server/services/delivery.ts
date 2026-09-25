import "server-only";
import { resolveEffectiveEntitlements } from "@/domain/entitlements/service";
import { deliveryCapabilities } from "@/domain/product/commercial";
export async function voiceDelivery(userId:string){const capabilities=deliveryCapabilities(await resolveEffectiveEntitlements(userId));return {voiceAllowed:capabilities.voice,enhancedAvailable:capabilities.voice&&!!process.env.OPENAI_API_KEY};}
export async function requireVoiceDelivery(userId:string){if(!(await voiceDelivery(userId)).voiceAllowed)throw new Error("Voice is unavailable for this account. Type your response to continue.");}
