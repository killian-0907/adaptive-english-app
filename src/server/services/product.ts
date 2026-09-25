import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/server/auth";
import { entryRoute, progressCards, recognitionGaps, progressTimeline, practiceNeeds, sessionSummary, skillLabels } from "@/domain/product/selectors";
import { editablePreferences, goalKeys, settingsSchema } from "@/domain/product/settings";
import { membershipSummary, subscriptionActive } from "@/domain/product/commercial";
import { resolveEffectiveEntitlements } from "@/domain/entitlements/service";
import { learningPreview } from "./learning";
import type { History } from "@/domain/learning/types";
import { z } from "zod";

function checked<T>(r:{data:T;error:unknown}):NonNullable<T>{if(r.error||r.data===null)throw new Error("Could not load your account. Please try again.");return r.data as NonNullable<T>;}
export const productIdentity=cache(async(requireAssessment=false)=>{
  const user=await requireAuthenticatedUser();const db=await createServerUserSupabaseClient();
  const profile=checked(await db.from("profiles").select("native_language,interface_language,onboarding_status").eq("user_id",user.id).single());
  if(requireAssessment){const sessions=checked(await db.from("learning_sessions").select("id").eq("user_id",user.id).eq("status","completed").contains("starting_state_summary",{purpose:"initial_assessment_v1"}).limit(1));const route=entryRoute(profile.onboarding_status==="completed",!!sessions.length);if(route!=="/home")redirect(route);}
  return {id:user.id,email:user.email??"",language:profile.interface_language??"en",nativeLanguage:profile.native_language??"en"};
});
export async function productProgress(userId:string){
  const db=createAdminSupabaseClient();
  const [a,k,p,c]=await Promise.all([
    db.from("learner_ability_estimates").select("dimension,estimate_level,confidence_level,trend,last_evidence_at").eq("user_id",userId),
    db.from("learner_knowledge_states").select("knowledge_item_id,modality,state,confidence_level,review_need,last_evidence_at").eq("user_id",userId).order("last_evidence_at",{ascending:false,nullsFirst:false}).limit(100),
    db.from("recurring_mistake_patterns").select("pattern_key,mistake_category,knowledge_item_id,modality,confidence_level,severity_level,occurrence_count,status").eq("user_id",userId),
    db.from("learner_model_changes").select("id,created_at,changed_entity_type,dimension,previous_value,new_value").eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
  ]);
  const abilities=checked(a),knowledge=checked(k),patterns=checked(p),changes=checked(c);
  const ids=[...new Set(knowledge.map(x=>x.knowledge_item_id))];
  const labels=ids.length?checked(await db.from("knowledge_items").select("id,canonical_text").in("id",ids)):[];
  return {cards:progressCards(abilities),gaps:recognitionGaps(knowledge,new Map(labels.map(x=>[x.id,x.canonical_text]))),timeline:progressTimeline(changes.map(x=>({...x,changed_at:x.created_at}))),needs:practiceNeeds(abilities,patterns),reviewSuggested:knowledge.some(k=>k.review_need>=2)};
}
export async function productHome(userId:string){
  const db=await createServerUserSupabaseClient();
  const [progress,preview,sessions]=await Promise.all([productProgress(userId),learningPreview(userId),db.from("learning_sessions").select("id,status").eq("user_id",userId).contains("starting_state_summary",{purpose:"normal_learning_v1"}).order("started_at",{ascending:false}).limit(1)]);
  return {progress,focus:preview.objective,active:checked(sessions)[0]?.status==="active"};
}
export async function productHistory(userId:string,sessionId?:string,page=1){
  if(sessionId&&!z.uuid().safeParse(sessionId).success)return [];
  const db=createAdminSupabaseClient();
  let query=db.from("learning_sessions").select("id,started_at,ended_at").eq("user_id",userId).eq("status","completed").contains("starting_state_summary",{purpose:"normal_learning_v1"}).order("started_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*30,page*30-1);
  if(sessionId)query=query.eq("id",sessionId);
  const sessions=checked(await query);if(!sessions.length)return [];
  const ids=sessions.map(s=>s.id);
  const [activities,observations]=await Promise.all([
    db.from("activities").select("id,session_id,status,created_at,metadata").eq("user_id",userId).in("session_id",ids).order("created_at",{ascending:false}).limit(1000),
    db.from("evidence_events").select("session_id,target_skill").eq("user_id",userId).in("session_id",ids).eq("evidence_kind","learning_performance").not("target_skill","is",null).limit(1000),
  ]);
  const history=checked(activities).reverse() as unknown as History[];const events=checked(observations);
  return sessions.map(s=>({...sessionSummary(s.id,s.started_at,s.ended_at,history.filter(h=>h.session_id===s.id)),skills:[...new Set(events.filter(e=>e.session_id===s.id).map(e=>skillLabels[e.target_skill!]??"English"))],limited:history.length===1000}));
}
export async function productSettings(userId:string){
  const db=await createServerUserSupabaseClient();const [p,g,prefs]=await Promise.all([
    db.from("profiles").select("native_language,interface_language").eq("user_id",userId).single(),
    db.from("learning_goals").select("goal_type,priority").eq("user_id",userId).eq("is_active",true).order("priority",{ascending:false}).order("created_at"),
    db.from("learning_preferences").select("preference_type,target_key,strength,value_text").eq("user_id",userId),
  ]);const profile=checked(p);const goals=checked(g).filter(g=>goalKeys.includes(g.goal_type as typeof goalKeys[number])).map(g=>({key:g.goal_type,priority:g.priority}));
  return settingsSchema.parse({nativeLanguage:profile.native_language??"en",interfaceLanguage:profile.interface_language??"en",goals:goals.length?goals:[{key:"daily_communication",priority:3}],...editablePreferences(checked(prefs))});
}
export async function saveProductSettings(userId:string,input:unknown){
  const settings=settingsSchema.parse(input);const result=await createAdminSupabaseClient().rpc("save_product_settings",{p_user:userId,p_data:settings});if(result.error)throw new Error("Could not save settings. Your previous preferences are unchanged.");return settings;
}
const catalogMetadata=z.object({preview:z.boolean().optional(),features:z.array(z.object({label:z.string().max(160),available:z.boolean()})).default([])});
export async function productMembership(userId:string){
  const db=createAdminSupabaseClient();const [plansResult,subscriptionResult,entitlements]=await Promise.all([
    db.from("plans").select("id,display_name,description,metadata").eq("is_active",true).order("sort_order"),
    db.from("subscriptions").select("plan_id,status,started_at,ends_at").eq("user_id",userId).eq("is_current",true).maybeSingle(),resolveEffectiveEntitlements(userId),
  ]);
  const plans=checked(plansResult);if(subscriptionResult.error)throw new Error("Could not load membership.");const subscription=subscriptionResult.data;
  const current=subscriptionActive(subscription)?plans.find(p=>p.id===subscription?.plan_id)?.display_name??"Account membership":"Free";
  return {current:membershipSummary(current,entitlements),plans:plans.map(p=>({name:p.display_name,description:p.description,...catalogMetadata.parse(p.metadata)}))};
}
