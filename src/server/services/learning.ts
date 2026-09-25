import "server-only";
import { voiceDelivery, requireVoiceDelivery } from "./delivery";
import { createHash, randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { evaluationSchema } from "@/domain/assessment/contracts";
import type { Item } from "@/domain/assessment/items";
import { decide, correctionText, supportText } from "@/domain/learning/engine";
import { planContent } from "@/domain/learning/scenarios";
import { transferResult } from "@/domain/learning/transfer";
import { resolveEvaluation } from "@/domain/learning/bounded";
import { processEvidence } from "@/domain/learning/processor";
import { responseTarget, scoreLearning } from "@/domain/learning/evaluation";
import { evidenceSchema, type Command, type Decision, type Evidence, type History, type Snapshot, type Task } from "@/domain/learning/types";
import type { Json } from "@/types/database.generated";
import { OpenAIAssessmentProvider, ProviderUnavailable } from "./assessment-provider";
import { assessmentVoice } from "./assessment-voice";
import { account } from "./assessment";
export class LearningError extends Error {}
function checked<T>(r:{data:T;error:unknown}):NonNullable<T>{if(r.error||r.data===null)throw new LearningError("Could not save learning progress. Please retry or resume.");return r.data as NonNullable<T>;}
const json=(value:unknown)=>value as Json;
async function snapshot(userId:string,sessionId:string):Promise<Snapshot>{
  const raw=checked(await createAdminSupabaseClient().rpc("learning_snapshot",{p_user:userId})) as unknown as Snapshot & {states:{session_id:string;state_type:string}[]};
  const goals=checked(await createAdminSupabaseClient().from("learning_goals").select("goal_type").eq("user_id",userId).eq("is_active",true).order("priority",{ascending:false}).order("created_at"));
  return {...raw,goals:goals.map(g=>g.goal_type),sessionId,state:raw.states.find(s=>s.session_id===sessionId)?.state_type??"normal", evidence:raw.evidence.map(e=>evidenceSchema.parse({id:e.id,session_id:e.session_id,activity_id:e.activity_id,target_skill:e.target_skill,knowledge_item_id:e.knowledge_item_id,modality:e.modality,source:e.source,evidence_kind:e.evidence_kind,result:e.result,response_quality:e.response_quality,support_level:e.support_level,evaluator_confidence_level:e.evaluator_confidence_level,transfer_success:e.transfer_success,voice_uncertainty:e.voice_uncertainty??false,response_time_ms:e.response_time_ms,dedupe_key:e.dedupe_key,occurred_at:e.occurred_at,processor_status:e.processor_status,metadata:e.metadata}))};
}
async function owned(userId:string,id:string){
  return checked(await createAdminSupabaseClient().from("activities").select("*").eq("user_id",userId).eq("id",id).eq("activity_type","normal_learning").single());
}
function providerItem(task:Task,decision:Decision):Item{
  return {id:task.key,type:task.spoken?"spoken":task.audio?"listening":"written",skill:task.skill,modality:task.modality,difficulty:decision.difficulty,knowledge:task.topic,prompt:task.prompt,tts:task.audio?task.context:task.prompt,options:task.options,answer:task.answer,strategy:task.strategy==="exact"?"exact":"evaluator",native:task.native,hint:task.explanation,expectedSkills:[task.skill],branching:"performance_and_coverage"};
}
export async function learningVoice(userId:string,id:string,audio?:File){
  const activity=await owned(userId,id);
  if(activity.metadata.lease_until && Date.parse(String(activity.metadata.lease_until))>Date.now())throw new LearningError("Please wait for the current response to finish.");
  const session=checked(await createAdminSupabaseClient().from("learning_sessions").select("status").eq("id",activity.session_id).eq("user_id",userId).single());
  if(session.status!=="active")throw new LearningError("This session has ended.");
  const result=await assessmentVoice(userId,id,audio,async(u,a)=>{const activity=await owned(u,a);const m=activity.metadata as unknown as History["metadata"];return {activity,item:providerItem(m.task,m.decision)};});
  if(!audio)checked(await createAdminSupabaseClient().rpc("control_learning",{p_user:userId,p_activity:id,p_action:"support",p_value:"replay"}).then(r=>({...r,data:true})));
  return result;
}
async function nextActivity(userId:string,sessionId:string){
  for(let i=0;i<4;i++){
    const s=await snapshot(userId,sessionId); const active=s.history.find(h=>h.session_id===sessionId&&h.status==="active"); if(active)return active.id;
    const {decision:d,task}=planContent(s,decide(s));
    const result=await createAdminSupabaseClient().rpc("plan_learning",{p_user:userId,p_session:sessionId,p_revision:s.revision,p_decision:json(d),p_task:json(task)});
    if(result.error)throw new LearningError("Could not prepare the next activity. Please resume.");if(result.data)return result.data;
  }
  throw new LearningError("Another tab changed this session. Please resume.");
}
type Summary={completedScenarios:string[];practiced:string[];worked:string[];needsPractice:string[];expressions:string[];next:string};
function summary(history:History[]):Summary{
  const done=history.filter(h=>h.status==="completed");
  return {completedScenarios:[...new Set(done.filter(h=>{const p=h.metadata.task.scenario;return p&&p.turn===p.total-1&&(h.metadata.quality??0)>=3&&Array.from({length:p.total},(_,i)=>i).every(i=>done.some(t=>t.metadata.task.scenario?.run===p.run&&t.metadata.task.scenario.turn===i&&(t.metadata.quality??0)>=3));}).map(h=>h.metadata.task.scenario!.title))],practiced:[...new Set(done.map(h=>h.metadata.decision.objective))],worked:[...new Set(done.filter(h=>(h.metadata.quality??0)>=3&&!h.metadata.support).map(h=>h.metadata.decision.objective))],needsPractice:[...new Set(done.filter(h=>h.metadata.quality!==null&&((h.metadata.quality??4)<3||h.metadata.support)).map(h=>h.metadata.decision.objective))],expressions:[...new Set(done.map(h=>h.metadata.task.model))].slice(-2),next:done.at(-1)?.metadata.decision.returnRule??"Start with a short, useful everyday exchange."};
}
export type LearningView={kind:"start"|"assessment_required"|"activity"|"summary";sessionId?:string;activityId?:string;objective?:string;method?:string;prompt?:string;options?:string[];spoken?:boolean;audio?:boolean;support?:number;supportText?:string;nativeHelp?:string;transcript?:string;correction?:string;explanation?:string;speed?:number;words?:number;preparation?:number;frame?:string;feedbackDue?:boolean;summary?:Summary;voiceAllowed?:boolean;previousPrompt?:string;speechText?:string;enhancedAvailable?:boolean;scenario?:Task["scenario"];savedVoice?:{id:string;transcript:string|null}|null};
export async function learningView(userId:string,endedSession?:string):Promise<LearningView>{
  const db=createAdminSupabaseClient();
  const assessed=checked(await db.from("learning_sessions").select("id").eq("user_id",userId).eq("status","completed").contains("starting_state_summary",{purpose:"initial_assessment_v1"}).limit(1));
  if(!assessed.length)return {kind:"assessment_required"};
  const sessions=checked(await db.from("learning_sessions").select("id,status").eq("user_id",userId).contains("starting_state_summary",{purpose:"normal_learning_v1"}).order("started_at",{ascending:false}).limit(1));
  const session=sessions[0]; if(!session)return {kind:"start"};
  if(endedSession&&session.id!==endedSession)throw new LearningError("Session not found.");
  if(session.status!=="active"){const s=await snapshot(userId,session.id);return {kind:"summary",sessionId:session.id,summary:summary(s.history.filter(h=>h.session_id===session.id))};}
  const id=await nextActivity(userId,session.id); const activity=await owned(userId,id); const s=await snapshot(userId,session.id); const m=activity.metadata as unknown as History["metadata"];
  const d=m.decision; const task=m.task;const support=m.support??0;
  const receipts=checked(await db.from("voice_interactions").select("id,transcript").eq("user_id",userId).eq("activity_id",id).eq("interaction_type","stt").eq("processing_status","completed").order("attempt_no",{ascending:false}).limit(1));
  const latest=s.history.filter(h=>h.session_id===session.id&&h.status==="completed").at(-1);
  return {kind:"activity",previousPrompt:latest?.metadata.task.audio?latest.metadata.task.context:undefined,speechText:task.audio?task.context:undefined,...await voiceDelivery(userId),scenario:task.scenario,sessionId:session.id,activityId:id,objective:d.objective,method:d.method.replaceAll("_"," "),prompt:task.prompt,options:task.options,spoken:task.spoken,audio:task.audio,support,supportText:supportText(task,support,s.language),nativeHelp:d.exposure<=2||support>=5?task.native[s.language]??task.native.en:undefined,transcript:m.transcript?task.context:undefined,correction:latest?.metadata.correction,explanation:d.method==="grammar_explanation"?task.explanation:undefined,speed:d.listening.speed,words:d.speaking.words,preparation:d.speaking.preparationSeconds,frame:d.speaking.frame&&support>=4?`${task.model.split(" ")[0]} …`:undefined,feedbackDue:d.feedbackDue,savedVoice:receipts[0]??null};
}
async function answer(userId:string,command:Extract<Command,{action:"answer"}>){
  const db=createAdminSupabaseClient();const activity=await owned(userId,command.activityId);if(activity.status==="completed")return;
  const token=randomUUID();if(!checked(await db.rpc("claim_learning_response",{p_user:userId,p_activity:activity.id,p_token:token})))throw new LearningError("This response is processing. Resume in a moment.");
  try{
    const current=await owned(userId,activity.id);const m=current.metadata as unknown as History["metadata"] & {responseHash?:string;evaluation?:unknown};
    const task=m.task;const decision=m.decision;let text=command.text;let voice=false;let browserVoice=false;
    if(command.voiceId){const receipt=checked(await db.from("voice_interactions").select("transcript,processing_status,provider").eq("user_id",userId).eq("activity_id",activity.id).eq("id",command.voiceId).eq("interaction_type","stt").single());if(receipt.processing_status!=="completed"||!receipt.transcript)throw new LearningError("Record again or type your response.");text=receipt.transcript;voice=true;browserVoice=receipt.provider==="browser_native";}
    if(!command.skip&&!text.trim())throw new LearningError("Enter a response or skip.");
    if(task.audio&&!m.replay&&!m.transcript&&!command.skip)throw new LearningError("Listen first, or choose Read instead.");
    let evaluation=null;
    let evaluationStrategy=resolveEvaluation(task.strategy,!!task.criteria,process.env.OPENAI_ENHANCED_EVALUATION==="true",!!process.env.OPENAI_API_KEY);
    if(!command.skip&&evaluationStrategy==="AI_STRUCTURED"){
      const hash=createHash("sha256").update(JSON.stringify({text,voiceId:command.voiceId})).digest("hex");
      const target=responseTarget(task,voice,m.transcript??false);
      const item=providerItem({...task,...target},decision);
      try{
        evaluation=m.responseHash===hash&&m.evaluation?evaluationSchema.parse(m.evaluation):await new OpenAIAssessmentProvider().evaluate(item,text);
        checked(await db.rpc("cache_assessment_evaluation",{p_user:userId,p_activity:activity.id,p_token:token,p_hash:hash,p_evaluation:evaluation}).then(r=>({...r,data:true})));
        await account(userId,activity.session_id,activity.id,"learning_evaluation",`${activity.id}:evaluation:${hash}`);
      }catch(error){if(!(error instanceof ProviderUnavailable))throw error;evaluationStrategy="FALLBACK";}
    }
    const scored=scoreLearning(task,text,evaluation,voice,m.transcript??false,m.support??0,command.skip);
    const {quality,errors,support,skill,modality}=scored;const confidence=browserVoice?Math.min(1,scored.confidence):scored.confidence;
    const correction=correctionText(decision,task,quality,errors,support);
    const attempts=checked(await db.from("voice_interactions").select("id").eq("user_id",userId).eq("activity_id",activity.id).eq("interaction_type","stt"));
    // Never infer speaking ability from typed fallback or listening from revealed text.
    const id=randomUUID();const now=new Date().toISOString();
    for(let retry=0;retry<4;retry++){
      const s=await snapshot(userId,activity.session_id);
      const event:Evidence=evidenceSchema.parse({id,session_id:activity.session_id,activity_id:activity.id,target_skill:quality===null?null:skill,knowledge_item_id:activity.target_knowledge_item_id,modality,source:evaluationStrategy==="AI_STRUCTURED"?"evaluator":"deterministic",evidence_kind:"learning_performance",result:quality===null?"neutral":quality>=3?"success":quality>=2?"partial":"failure",response_quality:quality,support_level:support,evaluator_confidence_level:confidence,transfer_success:transferResult(s,task,decision,quality,support,confidence,browserVoice,Math.max(0,attempts.length-1)),voice_uncertainty:browserVoice,response_time_ms:command.elapsedMs,dedupe_key:`${activity.id}:learning:performance`,occurred_at:now,processor_status:"pending",metadata:{difficulty:decision.difficulty,method:decision.method,topic:task.topic,taskKey:task.key,errors,sessionState:s.state,misunderstood:errors.includes("task_misunderstanding"),firstListen:task.modality==="listening_recognition"&&m.replay===1&&!m.transcript,retries:Math.max(0,attempts.length-1),timed:false,skipped:command.skip,evaluationStrategy,voiceProvider:browserVoice?"browser_native":voice?"openai":"typed",acousticUncertainty:browserVoice,scenarioFamily:task.scenario?.family}});
      const processed=processEvidence(s,[event]);const committed=checked(await db.rpc("commit_learning_response",{p_user:userId,p_activity:activity.id,p_token:token,p_revision:s.revision,p_response:json({...command,text,quality,correction,support}),p_events:json([event]),p_patches:json(processed.patches),p_applied:processed.applied}));if(committed)return;
    }
    throw new LearningError("Another tab changed your state. Please retry your saved response.");
  }finally{await db.rpc("cache_assessment_evaluation",{p_user:userId,p_activity:activity.id,p_token:token,p_hash:null,p_evaluation:null});}
}
export async function learningCommand(userId:string,command:Command){
  const db=createAdminSupabaseClient();
  if(command.action==="start")checked(await db.rpc("start_learning",{p_user:userId}));
  else if(command.action==="browser_voice"){await requireVoiceDelivery(userId);const voiceId=checked(await db.rpc("record_browser_transcript",{p_user:userId,p_activity:command.activityId,p_attempt:command.attemptId,p_text:command.text}));return {voiceId,transcript:command.text};}
  else if(command.action==="answer")await answer(userId,command);
  else if(command.action==="end"){checked(await db.rpc("end_learning",{p_user:userId,p_session:command.sessionId}).then(r=>({...r,data:true})));return learningView(userId,command.sessionId);}
  else if(command.action==="support"||command.action==="feedback")checked(await db.rpc("control_learning",{p_user:userId,p_activity:command.activityId,p_action:command.action,p_value:command.kind}).then(r=>({...r,data:true})));
  return learningView(userId);
}

export async function learningPreview(userId:string){
  const sessions=checked(await createAdminSupabaseClient().from("learning_sessions").select("id").eq("user_id",userId).contains("starting_state_summary",{purpose:"normal_learning_v1"}).order("started_at",{ascending:false}).limit(1));
  const s=await snapshot(userId,sessions[0]?.id??"00000000-0000-4000-8000-000000000000");
  const active=s.history.find(h=>h.session_id===s.sessionId&&h.status==="active");return {objective:active?.metadata.decision.objective??decide(s).objective};
}
