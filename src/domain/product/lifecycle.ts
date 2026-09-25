import { z } from "zod";
export const deletionSchema=z.object({confirmation:z.literal("DELETE")}).strict();
export const passwordSchema=z.string().min(8).max(128);
export const pageSchema=z.coerce.number().int().min(1).max(10000).catch(1);
export type AudioRecord={id:string;user_id:string;audio_object_path:string|null;audio_deleted_at:string|null;audio_expires_at:string|null;created_at:string;processing_status:string};
export function retentionHours(value:string|undefined,fallback:number){const n=Number(value);return Number.isFinite(n)&&n>=1&&n<=168?n:fallback;}
export function audioExpired(row:AudioRecord,now:number,successHours=24,retryHours=72){
  if(!row.audio_object_path||row.audio_deleted_at)return false;
  const deadline=row.audio_expires_at?Date.parse(row.audio_expires_at):Date.parse(row.created_at)+(row.processing_status==="completed"?successHours:retryHours)*3600000;
  return Number.isFinite(deadline)&&deadline<=now;
}
export async function cleanAudio(row:AudioRecord,remove:(path:string)=>Promise<void>,mark:()=>Promise<void>){
  if(!row.audio_object_path||row.audio_deleted_at)return false;
  if(!row.audio_object_path.startsWith(row.user_id+"/"))throw new Error("Invalid object ownership");
  await remove(row.audio_object_path);await mark();return true;
}
export async function deleteInOrder(steps:{queue:()=>Promise<void>;storage:()=>Promise<void>;identity:()=>Promise<void>;complete:()=>Promise<void>}){
  await steps.queue();await steps.storage();await steps.identity();await steps.complete();
}
export const exportSelections={
  profiles:"native_language,interface_language,onboarding_status,created_at",
  learning_goals:"goal_type,priority,is_active,created_at",
  learning_preferences:"preference_type,target_key,strength,value_text,source",
  learner_ability_estimates:"dimension,estimate_level,confidence_level,trend,last_evidence_at",
  learner_knowledge_states:"knowledge_item_id,modality,state,confidence_level,review_need,last_evidence_at",
  learning_sessions:"id,started_at,ended_at,status",
  activities:"id,session_id,activity_type,status,created_at",
  activity_messages:"activity_id,role,modality,content_text,created_at",
  user_feedback:"feedback_type,value_text,value_score,free_text,created_at",
  voice_interactions:"interaction_type,transcript,created_at",
} as const;
