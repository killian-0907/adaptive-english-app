import "server-only";
import { requestSlot } from "./lifecycle";
import { voiceDelivery } from "./delivery";
import { createHash, randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import { advance, initialModel, languageSupport, nextItem } from "@/domain/assessment/engine";
import { evaluationSchema, onboardingSchema, responseSchema, supportSchema, type AssessmentState } from "@/domain/assessment/contracts";
import { getItem } from "@/domain/assessment/items";
import { scoreResponse } from "@/domain/assessment/evidence";
import { OpenAIAssessmentProvider, ProviderUnavailable } from "./assessment-provider";
import { resolveEvaluation } from "@/domain/learning/bounded";
import { recordUsage } from "@/server/repositories/usage";

export class AssessmentError extends Error {}
function checked<T>(result: { data: T; error: unknown }): NonNullable<T> { if (result.error) throw new AssessmentError("Could not save progress. Please retry."); return result.data as NonNullable<T>; }
export async function saveOnboarding(userId: string, input: unknown) {
  const data = onboardingSchema.parse(input);
  checked(await createAdminSupabaseClient().rpc("save_assessment_onboarding", { p_user: userId, p_data: data }));
}
export async function assessmentView(userId: string) {
  const user = await createServerUserSupabaseClient();
  const profile = checked(await user.from("profiles").select("native_language,interface_language,onboarding_status").eq("user_id",userId).single());
  if (profile.onboarding_status !== "completed") return { onboarding: true as const, profile };
  const db = createAdminSupabaseClient();
  const sid = checked(await db.rpc("start_initial_assessment", { p_user: userId }));
  const session = checked(await user.from("learning_sessions").select("*").eq("id",sid).single());
  const state = session.session_summary as AssessmentState;
  if (state.complete) return { onboarding: false as const, complete: true as const, result: session.ending_state_summary as {model:{dimension:string;estimate_level:number;confidence_level:number}[];support:string}, count: state.turns.length, profile };
  const item = nextItem(state)!;
  checked(await db.from("activities").upsert({ user_id: userId, session_id: sid, sequence_no: state.turns.length, activity_type: "initial_assessment", learning_purpose: "communication", target_skill: item.skill, difficulty_level: item.difficulty, english_exposure_level: Math.min(5,state.difficulty+1), correction_strategy: "assessment_no_teaching", status: "active", started_at: new Date().toISOString(), metadata: { itemId: item.id, prompt: item.prompt, strategy: item.strategy } }, { onConflict: "session_id,sequence_no", ignoreDuplicates: true }));
  const activity = checked(await user.from("activities").select("id,metadata").eq("session_id",sid).eq("sequence_no",state.turns.length).single());
  const previousVoice = checked(await user.from("voice_interactions").select("id,transcript").eq("activity_id",activity.id).eq("interaction_type","stt").eq("processing_status","completed").order("attempt_no",{ascending:false}).limit(1));
  return { onboarding: false as const, complete: false as const, activityId: activity.id, count: state.turns.length, profile,
    previousPrompt:state.turns.length?getItem(state.turns.at(-1)!.itemId).tts??undefined:undefined, savedVoice: previousVoice[0] ?? null, ...await voiceDelivery(userId),
    support: languageSupport(state.difficulty), savedSupport: supportSchema.parse((activity.metadata as {support?:unknown}).support ?? {hints:0,replays:0,retries:0,translation:false,transcript:false}), item: { id: item.id, type: item.type, prompt: item.prompt, options: item.options, hasAudio: !!item.tts, speechText:item.tts??undefined, spoken: item.type === "spoken" || item.type === "practical", instruction: item.native[profile.native_language ?? "en"] ?? "Try your best. You can ask for help or skip.", hint: item.hint } };
}
export type AssessmentView = Awaited<ReturnType<typeof assessmentView>>;
export async function ownedActivity(userId: string, activityId: string) {
  const user = await createServerUserSupabaseClient();
  const activity = checked(await user.from("activities").select("*").eq("user_id",userId).eq("id",activityId).eq("activity_type","initial_assessment").single());
  return { activity, item: getItem((activity.metadata as {itemId:string}).itemId) };
}
export async function submitAnswer(userId: string, input: unknown) {
  const answer = responseSchema.parse(input);
  const { activity, item } = await ownedActivity(userId,answer.activityId);
  if (activity.status === "completed") return;
  const db = createAdminSupabaseClient();
  const token = randomUUID();
  const claimed = checked(await db.rpc("claim_assessment_response", { p_user:userId,p_activity:activity.id,p_token:token }));
  if (!claimed) throw new AssessmentError("This response is already being processed. Wait a moment and resume.");
  try {
    let voice = false;
    if (answer.voiceId) {
      const receipt = checked(await db.from("voice_interactions").select("transcript,processing_status").eq("user_id",userId).eq("activity_id",activity.id).eq("id",answer.voiceId).eq("interaction_type","stt").single());
      if (receipt.processing_status !== "completed" || !receipt.transcript) throw new AssessmentError("Try recording again or use typed fallback.");
      answer.text = receipt.transcript; voice = true;
    }
    if (!answer.skip && !answer.text.trim()) throw new AssessmentError("Enter a response, record speech, or choose Skip.");
    if (item.strategy === "exact" && !answer.skip && !item.options.includes(answer.text)) throw new AssessmentError("Choose one of the available answers.");
    const hash = createHash("sha256").update(JSON.stringify({text:answer.text,voiceId:answer.voiceId})).digest("hex");
    const current = checked(await db.from("activities").select("metadata").eq("id",activity.id).single());
    if(current.metadata.support) {
      const saved=supportSchema.parse(current.metadata.support);
      answer.support={hints:Math.max(saved.hints,answer.support.hints),replays:Math.max(saved.replays,answer.support.replays),retries:Math.max(saved.retries,answer.support.retries),translation:saved.translation||answer.support.translation,transcript:saved.transcript||answer.support.transcript};
    }
    const attempts=checked(await db.from("voice_interactions").select("id").eq("activity_id",activity.id).eq("user_id",userId).eq("interaction_type","stt"));
    answer.support.retries=Math.max(answer.support.retries,Math.max(0,attempts.length-1));
    if(item.type === "listening" && !answer.skip && answer.support.replays === 0 && !answer.support.transcript) throw new AssessmentError("Listen to the prompt first, or choose the reading fallback.");
    let evaluation = null;
    if (!answer.skip && resolveEvaluation(item.strategy,false,process.env.OPENAI_ENHANCED_EVALUATION==="true",!!process.env.OPENAI_API_KEY)==="AI_STRUCTURED") {
      try{
        evaluation = current.metadata.responseHash === hash && current.metadata.evaluation ? evaluationSchema.parse(current.metadata.evaluation) : await (async()=>{await requestSlot(userId,"evaluation",30,3600);return new OpenAIAssessmentProvider().evaluate(item,answer.text);})();
        checked(await db.rpc("cache_assessment_evaluation",{p_user:userId,p_activity:activity.id,p_token:token,p_hash:hash,p_evaluation:evaluation}));
        await account(userId,activity.session_id,activity.id,"assessment_evaluation",`${activity.id}:evaluation:${hash}`);
      }catch(error){if(!(error instanceof ProviderUnavailable))throw error;}
    }
    const session = checked(await db.from("learning_sessions").select("session_summary").eq("id",activity.session_id).eq("user_id",userId).single());
    const scored = scoreResponse(item,answer,evaluation,voice);
    const state = advance(session.session_summary as AssessmentState,scored.turn,answer.fatigue);
    checked(await db.rpc("commit_assessment_response", { p_user:userId,p_session:activity.session_id,p_activity:activity.id,p_token:token,p_response:answer,p_events:scored.events,p_state:state,p_model:initialModel(state.turns.flatMap(t=>t.observations)) }));
  } finally {
    await db.rpc("cache_assessment_evaluation",{p_user:userId,p_activity:activity.id,p_token:token,p_hash:null,p_evaluation:null});
  }
}
export async function recordSupport(userId:string,activityId:string,kind:string) {
  await ownedActivity(userId,activityId);
  return checked(await createAdminSupabaseClient().rpc("record_assessment_support",{p_user:userId,p_activity:activityId,p_kind:kind}));
}
export async function account(userId:string,sessionId:string,activityId:string,resourceType:string,dedupeKey:string) {
  const now = new Date(); const end = new Date(now); end.setUTCDate(end.getUTCDate()+1);
  await recordUsage({userId,sessionId,activityId,resourceType,amount:1,unit:"request",periodStart:now.toISOString(),periodEnd:end.toISOString(),dedupeKey});
}
