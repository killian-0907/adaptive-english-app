import { createClient } from "@supabase/supabase-js";
import { maintainVoice } from "./voice-maintenance.ts";
import type { Database } from "../src/types/database.generated.ts";
const db=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
async function run(){try{console.log(JSON.stringify(await maintainVoice(db)));}catch{console.error("Voice maintenance failed; retry on next run.");process.exitCode=1;}}
await run();
if(process.argv.includes("--watch")){process.exitCode=0;setInterval(()=>{void run();},Math.max(60,Number(process.env.VOICE_CLEANUP_INTERVAL_SECONDS)||3600)*1000);}
