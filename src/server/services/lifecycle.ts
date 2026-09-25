import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { exportSelections, deleteInOrder } from "@/domain/product/lifecycle";
import { productHistory } from "./product";
import { removeUserObjects } from "../../../scripts/voice-maintenance";
export class RateLimitError extends Error {}
export async function requestSlot(userId:string,action:string,limit:number,seconds:number){
  const {data,error}=await createAdminSupabaseClient().rpc("take_request_slot",{p_user:userId,p_action:action,p_limit:limit,p_seconds:seconds});
  if(error)throw new Error("Request validation unavailable");
  if(!data)throw new RateLimitError("Please wait before trying again.");
}
export async function exportAccount(userId:string,email:string){
  const db=createAdminSupabaseClient();const result:Record<string,unknown>={version:1,exportedAt:new Date().toISOString(),email};
  for(const [table,columns] of Object.entries(exportSelections)){
    const rows:unknown[]=[];
    for(let offset=0;;offset+=500){
      // Every page is scoped to authenticated server identity. Explicit allowlist excludes operational metadata.
      let query=db.from(table as keyof typeof exportSelections).select(columns).eq("user_id",userId).order(table==="profiles"?"user_id":"id").range(offset,offset+499);
      if(table==="activity_messages")query=query.neq("role","system_instruction");
      const {data,error}=await query;if(error)throw new Error("Export unavailable");rows.push(...data);if(data.length<500)break;
      if(rows.length>=100000)throw new Error("Export too large; no partial export returned");
    }
    result[table]=rows;
  }
  result.recentSessionSummaries=await productHistory(userId);
  return result;
}
export async function deleteAccount(userId:string){
  const db=createAdminSupabaseClient();
  await deleteInOrder({
    queue:async()=>{const r=await db.from("account_deletion_jobs").upsert({user_id:userId},{onConflict:"user_id",ignoreDuplicates:true});if(r.error)throw new Error("Deletion unavailable");},
    storage:()=>removeUserObjects(db,userId),
    identity:async()=>{const r=await db.auth.admin.deleteUser(userId);if(r.error&&r.error.status!==404)throw new Error("Deletion unavailable");},
    complete:async()=>{const r=await db.from("account_deletion_jobs").update({completed_at:new Date().toISOString()}).eq("user_id",userId);if(r.error)throw new Error("Deletion pending");},
  });
}
