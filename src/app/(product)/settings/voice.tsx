"use client";
import { VoiceTools } from "@/app/learn/voice-tools";
export function VoiceSettings(){return <VoiceTools speechText="Hello. Let's practise a little useful English." spoken={false} speed={1} enhancedAvailable={false} request={async()=>{throw new Error("This preview uses browser speech only.");}} played={async()=>{}} confirmed={()=>{}}/>;}
