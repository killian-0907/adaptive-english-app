export async function register(){
  if(process.env.NETLIFY === "true" || process.env.VERCEL || process.env.NEXT_RUNTIME!=="nodejs"||process.env.NODE_ENV!=="production"||process.env.VOICE_CLEANUP_ENABLED==="false")return;
  const { createClient }=await import("@supabase/supabase-js");const { maintainVoice }=await import("../scripts/voice-maintenance");
  const state=globalThis as typeof globalThis & {voiceCleanupTimer?:ReturnType<typeof setInterval>};if(state.voiceCleanupTimer)return;
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});let running=false;
  const run=async()=>{if(running)return;running=true;try{const result=await maintainVoice(db);console.info(JSON.stringify({event:"voice_cleanup",requestId:crypto.randomUUID(),...result}));}catch{console.error(JSON.stringify({event:"voice_cleanup_failed",requestId:crypto.randomUUID()}));}finally{running=false;}};
  state.voiceCleanupTimer=setInterval(()=>{void run();},Math.max(60,Number(process.env.VOICE_CLEANUP_INTERVAL_SECONDS)||3600)*1000);state.voiceCleanupTimer.unref();void run();
}
