import { removeBilling } from "./billing-lifecycle.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.generated";
import { audioExpired, cleanAudio, retentionHours } from "../src/domain/product/lifecycle.ts";
type DB=SupabaseClient<Database>;
export async function removeUserObjects(db:DB,userId:string){
  async function directory(prefix:string){
    for(;;){const {data,error}=await db.storage.from("voice-temp").list(prefix,{limit:100});if(error)throw new Error("Storage unavailable");if(!data.length)break;
      const paths:string[]=[];for(const object of data){const path=`${prefix}/${object.name}`;if(object.id)paths.push(path);else await directory(path);}
      if(paths.length){const removed=await db.storage.from("voice-temp").remove(paths);if(removed.error)throw new Error("Storage unavailable");}
      if(!paths.length&&data.length<100)break;
    }
  }
  await directory(userId);
}
export async function maintainVoice(db:DB, options: { signal?: AbortSignal } = {}){
  options.signal?.throwIfAborted();
  const now=Date.now();let removed=0,failed=0;const success=retentionHours(process.env.VOICE_SUCCESS_HOURS,24),retry=retentionHours(process.env.VOICE_RETRY_HOURS,72);
  const jobs=await db.from("account_deletion_jobs").select("user_id,completed_at").order("completed_at",{ascending:true,nullsFirst:true}).order("requested_at").limit(100);
  if(jobs.error)throw new Error("Maintenance unavailable");
  for(const job of jobs.data){options.signal?.throwIfAborted();try{if(!job.completed_at)await removeBilling(db,job.user_id);await removeUserObjects(db,job.user_id);if(!job.completed_at){const r=await db.auth.admin.deleteUser(job.user_id);if(r.error&&r.error.status!==404)throw new Error("Identity unavailable");const marked=await db.from("account_deletion_jobs").update({completed_at:new Date(now).toISOString()}).eq("user_id",job.user_id);if(marked.error)throw new Error("Deletion completion unavailable");}else if(now-Date.parse(job.completed_at)>7*86400000){const completed=await db.from("account_deletion_jobs").delete().eq("user_id",job.user_id);if(completed.error)throw new Error("Deletion cleanup unavailable");}}catch{failed++;}}
  const deadline=new Date(now).toISOString(),successBefore=new Date(now-success*3600000).toISOString(),retryBefore=new Date(now-retry*3600000).toISOString();
  const records=await db.from("voice_interactions").select("id,user_id,audio_object_path,audio_deleted_at,audio_expires_at,created_at,processing_status").not("audio_object_path","is",null).is("audio_deleted_at",null)
    .or(`audio_expires_at.lte.${deadline},and(audio_expires_at.is.null,processing_status.eq.completed,created_at.lte.${successBefore}),and(audio_expires_at.is.null,processing_status.neq.completed,created_at.lte.${retryBefore})`).order("created_at").limit(1000);
  if(records.error)throw new Error("Maintenance unavailable");
  for(const row of records.data){options.signal?.throwIfAborted();if(!audioExpired(row,now,success,retry))continue;try{await cleanAudio(row,async path=>{const r=await db.storage.from("voice-temp").remove([path]);if(r.error)throw new Error("Storage unavailable");},async()=>{const r=await db.from("voice_interactions").update({audio_deleted_at:new Date(now).toISOString(),audio_object_path:null}).eq("id",row.id).eq("audio_object_path",row.audio_object_path!);if(r.error)throw new Error("Database unavailable");});removed++;}catch{failed++;}}
  return {removed,failed};
}
