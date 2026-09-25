"use client";
import { useMemo, useSyncExternalStore } from "react";
import { defaultVoiceSettings, voiceSettingsSchema } from "@/domain/voice/routing";
export const voiceSettingsKey="adaptive-english.voice.v1";
const subscribe=(changed:()=>void)=>{window.addEventListener("storage",changed);window.addEventListener("voice-preferences",changed);return()=>{window.removeEventListener("storage",changed);window.removeEventListener("voice-preferences",changed);};};
const read=()=>{try{return localStorage.getItem(voiceSettingsKey)??"{}";}catch{return "{}";}};
export function useVoicePreferences(){const stored=useSyncExternalStore(subscribe,read,()=>"{}");return useMemo(()=>{try{const parsed=voiceSettingsSchema.safeParse(JSON.parse(stored));return parsed.success?parsed.data:defaultVoiceSettings;}catch{return defaultVoiceSettings;}},[stored]);}
