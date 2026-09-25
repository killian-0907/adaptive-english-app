import type { Dimension } from "../assessment/contracts";
import { reviewNeed } from "./processor";
import { VERSION, type Decision, type Method, type Snapshot, type Task } from "./types";
export const topics = ["polite_requests", "meeting_times", "past_events", "clarification"] as const;
const objectives: Record<string,string> = { polite_requests: "Make a polite request", meeting_times: "Arrange a useful meeting time", past_events: "Describe a past event", clarification: "Ask for clarification" };
const clamp = (n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function classifyDifficulty(s: Snapshot) {
  const recent = s.history.filter(h=>h.session_id===s.sessionId && h.status==="completed" && h.metadata.quality!==null).slice(-3);
  const feedback=s.history.at(-1)?.metadata.feedback;
  if(feedback==="cannot_understand") return "impossible_to_follow";
  if(feedback==="too_difficult" || s.state==="overloaded") return "too_difficult";
  if(recent.length>=2 && recent.slice(-2).every(h=>(h.metadata.quality??0)<=1)) return "too_difficult";
  if(recent.length>=2 && recent.slice(-2).every(h=>(h.metadata.quality??0)>=3 && !h.metadata.support && (!h.metadata.elapsedMs || h.metadata.elapsedMs<45000))) return "too_easy";
  if(recent.at(-1)?.metadata.support || (recent.at(-1)?.metadata.quality??3)<2) return "somewhat_difficult";
  return recent.length ? "appropriately_challenging" : "comfortable";
}
export function decide(s: Snapshot, now=new Date()): Decision {
  const history=s.history; const current=history.filter(h=>h.session_id===s.sessionId); const last=history.at(-1); const previous=last?.metadata.decision;
  const feedback=last?.metadata.feedback; const interrupted=last?.status==="interrupted" && last.session_id===s.sessionId;
  const states=["tired","frustrated","overloaded","increased_support_need"];
  const difficultyState=classifyDifficulty(s);
  const due=s.knowledge.map(k=>({...k,need:Math.max(reviewNeed(k.state,k.last_evidence_at,k.review_need,now),k.modality.endsWith("recognition")&&["recognized","strong"].includes(k.state)&&!s.knowledge.some(p=>p.knowledge_item_id===k.knowledge_item_id&&p.modality.endsWith("production")&&["independent","strong"].includes(p.state))?2:0)})).filter(k=>k.need>=2).sort((a,b)=>b.need-a.need);
  const catalogTopic=(id:string)=>s.catalog.find(k=>k.id===id)?.normalized_key.replace("learning:","");
  const repeated=s.patterns.filter(p=>p.confidence_level>=1&&p.status!=="improving"&&p.severity_level>=1).sort((a,b)=>b.severity_level-a.severity_level);
  let topic=topics[0] as string; let purpose: Decision["purpose"]="communication"; const reasons:string[]=[];
  const recentTopics=history.slice(-3).map(h=>h.metadata.decision.topic);
  const focusRun=current.slice(-2).filter(h=>["weakness_repair","consolidation","review"].includes(h.metadata.decision.purpose));
  if(interrupted && previous){topic=previous.topic;purpose=previous.purpose;reasons.push("preserve_objective_after_feedback");}
  else if(focusRun.length>=2 && previous){topic=previous.topic;purpose="transfer";reasons.push("return_to_real_use_after_brief_focus");}
  else if(states.includes(s.state)){topic=previous?.topic??topics[0];purpose="consolidation";reasons.push("temporary_session_support");}
  else if(due.length && previous?.purpose!=="review" && current.length%3!==2){topic=catalogTopic(due[0].knowledge_item_id)??topics[0];purpose="review";reasons.push("retrieval_or_staleness_review");}
  else if(repeated.length && previous?.purpose!=="weakness_repair" && !recentTopics.every(t=>t===catalogTopic(repeated[0].knowledge_item_id??""))){topic=catalogTopic(repeated[0].knowledge_item_id??"")??"past_events";purpose="weakness_repair";reasons.push("repeated_communication_relevant_pattern");}
  else if(difficultyState==="too_difficult" && previous){topic=previous.topic;purpose="weakness_repair";reasons.push("repeated_struggle");}
  else if(previous && (last?.metadata.quality??0)>=3 && !last?.metadata.support && previous.purpose!=="transfer"){topic=previous.topic;purpose="transfer";reasons.push("check_reuse_in_new_context");}
  else { const goalTopic=s.goals.includes("work")?"meeting_times":s.goals.includes("school")?"clarification":"polite_requests"; topic=recentTopics.includes(goalTopic)?topics.find(t=>!recentTopics.includes(t))??topics[current.length%topics.length]:goalTopic;purpose=current.length===0?"communication":"progression";reasons.push("goal_relevance_and_breadth"); }
  if(!topics.includes(topic as typeof topics[number])) topic="polite_requests";
  const candidates: Method[]=purpose==="review"?(due[0]?.modality.endsWith("recognition")?["sentence_building","speaking","review"]:["review","sentence_building","listening"]):purpose==="weakness_repair"?["sentence_building","grammar_explanation","vocabulary_context","speaking"]:purpose==="transfer"?["transfer","role_play","guided_writing"]:purpose==="consolidation"?["vocabulary_context","sentence_building","review"]:["vocabulary_context","conversation","role_play","listening","speaking","guided_writing"];
  const preferenceKey: Record<Method,string>={conversation:"conversation",role_play:"conversation",listening:"listening",speaking:"conversation",sentence_building:"writing",vocabulary_context:"examples",grammar_explanation:"examples",guided_writing:"writing",review:"repetition",transfer:"conversation"};
  const rejected=s.preferences.filter(p=>p.preference_type==="method"&&p.strength<=-2&&history.slice(-3).some(h=>h.metadata.decision.method===p.target_key)).map(p=>p.target_key);
  const score=(m:Method)=>{
    const pref=s.preferences.filter(p=>p.preference_type==="method" && (p.target_key===m||p.target_key===preferenceKey[m])).reduce((sum,p)=>sum+p.strength,0);
    const methodSkill=m==="listening"?"listening":["speaking","conversation","role_play","transfer"].includes(m)?"spoken_expression":["sentence_building","guided_writing"].includes(m)?"written_expression":"vocabulary";
    const effect=s.effects.find(e=>e.teaching_method===m&&e.target_skill===methodSkill);
    const weakness=s.abilities.find(a=>a.dimension===methodSkill&&a.confidence_level>=2&&a.estimate_level<=1);
    return pref*2+(effect?.effectiveness_state==="repeatedly_helpful"?2:effect?.effectiveness_state==="promising"?1:0)+(weakness?2:0)+(s.state==="highly_engaged"&&["conversation","role_play"].includes(m)?1:0) -(history.slice(-2).filter(h=>h.metadata.decision.method===m).length*2)+(feedback==="more_speaking"&&["speaking","role_play"].includes(m)?12:0) -(states.includes(s.state)&&["conversation","role_play"].includes(m)?3:0);
  };
  let available=candidates.filter(m=>!(interrupted && feedback==="reject_method" && m===previous?.method) && !rejected.includes(m));
  if(feedback==="provider_fallback") available=["sentence_building","vocabulary_context","review"].filter(m=>m!==previous?.method) as Method[];
  if(feedback==="more_speaking") available=["speaking","role_play"];
  if(!available.length) available=(["sentence_building","vocabulary_context","guided_writing"] as Method[]).filter(m=>m!==previous?.method);
  const method=[...available].sort((a,b)=>score(b)-score(a))[0];
  reasons.push(s.effects.some(e=>e.teaching_method===method&&e.confidence_level>0)?"preference_and_observed_association":"need_preference_and_recent_format");
  const targetSkill:Dimension=interrupted&&previous?previous.targetSkill:method==="listening"?"listening":["speaking","conversation","role_play","transfer"].includes(method)?"spoken_expression":method==="vocabulary_context"||method==="review"?"vocabulary":topic==="past_events"?"grammar":"written_expression";
  const ability=s.abilities.find(a=>a.dimension===targetSkill); let difficulty=interrupted&&previous?previous.difficulty:Math.min(4,ability?.estimate_level??0);
  if(previous && current.length && previous.targetSkill===targetSkill) difficulty=previous.difficulty;
  if(["too_difficult","impossible_to_follow"].includes(difficultyState)) difficulty--;
  else if(difficultyState==="too_easy"&&!states.includes(s.state)) difficulty++;
  else if(s.state==="bored" && current.length>=2) difficulty++;
  if(states.includes(s.state)) difficulty=Math.min(difficulty,previous?.difficulty??difficulty);
  difficulty=clamp(difficulty,0,5);
  const independent=s.evidence.slice(-6).filter(e=>e.response_quality!==null&&e.response_quality>=3&&e.support_level===0&&!e.metadata.misunderstood);
  const listening=s.abilities.find(a=>a.dimension==="listening");
  let exposure=clamp((listening&&listening.confidence_level>0?listening.estimate_level:0)+1,1,5);
  if(listening?.last_evidence_at && now.getTime()-Date.parse(listening.last_evidence_at)>60*86400000) exposure=Math.max(1,exposure-1);
  if(independent.length>=4) exposure=clamp(exposure+1,1,5);
  if((states.includes(s.state)&&feedback!=="cannot_retrieve")||feedback==="cannot_understand") exposure=Math.max(1,exposure-1);
  // Change either language exposure or task difficulty upwards on a turn, not both.
  if(previous && difficulty>previous.difficulty) exposure=Math.min(exposure,previous.exposure);
  const correctionPreference=s.preferences.find(p=>p.preference_type==="correction")?.value_text;
  const correction:Decision["correction"]=s.state==="frustrated"||correctionPreference==="gentle"||feedback==="less_correction"?"delayed":["conversation","role_play","transfer"].includes(method)?"delayed":difficultyState==="too_difficult"?"model_response":correctionPreference==="immediate"?"immediate":"hint_first";
  return {objective:objectives[topic],targetSkill,topic,purpose,method,scenario:s.goals.includes("work")?"at_work":purpose==="transfer"?"new_everyday_context":"daily_life",difficulty,exposure,nativeSupport:5-exposure,correction,support:{initial:feedback==="cannot_understand"?5:feedback==="cannot_retrieve"?4:states.includes(s.state)?3:0,max:6},collect:[targetSkill,"independence",purpose==="transfer"?"transfer":"task_performance","instruction_understanding"],triggers:["two_struggles","two_independent_successes","explicit_feedback"],returnRule:"After at most two focused activities, try the same objective in a new realistic context.",reasons,version:VERSION,listening:{speed:exposure<=2?0.8:exposure<=3?0.9:1,transcript:exposure===1,replay:true,turns:difficulty>=3&&!states.includes(s.state)?2:1},speaking:{words:difficulty===0?1:states.includes(s.state)?5:5+difficulty*8,preparationSeconds:exposure<=2?20:5,frame:exposure<=2||states.includes(s.state),followUp:difficulty>=3&&!states.includes(s.state)},difficultyState,feedbackDue:current.length>0&&(current.length%4===0||difficultyState==="too_difficult"||previous?.method!==method)};
}
const content: Record<string,{sentences:string[]; zh:string; es:string; cue:string; rule:string}>={
  polite_requests:{sentences:["Water, please.","Could I have some tea, please?","Could you send me the report, please?"],zh:"礼貌地提出请求。",es:"Haz una petición cortés.",cue:"please",rule:"Use please for a short request; Could I have…? adds a polite question."},
  meeting_times:{sentences:["At nine.","Can we meet at ten?","Could we move our meeting to Friday?"],zh:"安排见面时间。",es:"Acuerda una hora para reunirte.",cue:"at / on",rule:"Use at with clock times and on with days."},
  past_events:{sentences:["I walked.","I visited a friend yesterday.","I finished the report before the meeting."],zh:"描述过去发生的事情。",es:"Describe un hecho pasado.",cue:"yesterday",rule:"Regular verbs often add -ed when describing a completed past action."},
  clarification:{sentences:["Again, please.","Could you say that again?","Could you explain what you mean by that?"],zh:"没听懂时，请对方重复或解释。",es:"Pide que repitan o aclaren algo.",cue:"again / explain",rule:"Ask for repetition or clarification when the message is unclear."},
};
export function makeTask(d:Decision, sequence:number):Task {
  const c=content[d.topic]; const variant=d.purpose==="transfer"?1+sequence%2:sequence%2; const model=c.sentences[Math.min(2,Math.floor(d.difficulty/2)+(d.purpose==="transfer"?1:0))];
  const recognition=["vocabulary_context","review","listening"].includes(d.method); const exact=recognition||["sentence_building","grammar_explanation"].includes(d.method);
  const place=d.scenario==="at_work"?(variant?"with a new colleague":"at your workplace"):(variant?"with a new neighbour":"with a friend");
  const context=`You are ${place}. ${d.objective}.`;
  const prompt=d.method==="listening"?"Listen, then choose the sentence you heard.":recognition?`${context} Choose a useful expression.`:exact?`${context} Put these words in order: ${model.replace(/[?.!]/g,"").split(" ").reverse().join(" / ")}`:`${context} ${d.difficulty===0?"One word is enough.":`Use about ${d.speaking.words} words.`}${d.speaking.followUp?" Add a reason or a follow-up question.":""}`;
  return {key:`${d.topic}:${d.method}:${d.difficulty}:${variant}`,topic:d.topic,prompt,context:recognition&&d.method==="listening"?model:context,options:recognition?[model,"Never mind, goodbye.","That is a blue chair."].sort((a,b)=>a.localeCompare(b)):[],answer:exact?model:null,model,explanation:c.rule,native:{zh:c.zh,es:c.es,en:d.objective},skill:d.method==="listening"?"listening":recognition?"vocabulary":["speaking","role_play","conversation","transfer"].includes(d.method)?"spoken_expression":d.topic==="past_events"?"grammar":"written_expression",modality:d.method==="listening"?"listening_recognition":recognition?"reading_recognition":["speaking","role_play","conversation","transfer"].includes(d.method)?"spoken_production":"written_production",strategy:exact?"exact":"evaluator",audio:d.method==="listening",spoken:["speaking","role_play","conversation","transfer"].includes(d.method),variant};
}
export function supportText(task:Task,level:number,language:string){return ["Try independently.","Read or listen to the prompt once more.",task.native.en,`Think about: ${task.topic.replaceAll("_"," ")}.`,`${task.model.split(" ")[0]} …`,task.native[language]??task.native.en,`Model: ${task.model}`][clamp(level,0,6)];}
export function correctionText(d:Decision,task:Task,quality:number|null,errors:string[],support:number){
  if(quality===null)return "This response was not scored. We can try another way.";
  if(quality>=3)return support>0?"You completed this with help. We will try using it independently later.":d.purpose==="transfer"?"You used the idea in a new context. Let's keep practising.":"Your message worked. Let's try another context.";
  if(d.correction==="delayed" && quality>=2 && !errors.length)return "Your meaning came through. Keep the conversation going.";
  if(d.correction==="hint_first")return `Try this cue next time: ${task.explanation}`;
  return `A useful model: ${task.model} ${task.explanation}`;
}
