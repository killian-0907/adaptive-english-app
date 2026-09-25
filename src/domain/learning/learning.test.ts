import { describe, expect, it } from "vitest";
import { decide, makeTask, classifyDifficulty, correctionText, supportText } from "./engine";
import { processEvidence, reviewNeed, calibratedConfidence } from "./processor";
import { learningEvidence } from "./evidence";
import { scenarioTask, scenarios } from "./scenarios";
import { scoreLearning } from "./evaluation";
import { commandSchema, type Evidence, type History, type Snapshot } from "./types";
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const now=new Date("2026-09-25T00:00:00Z");
function snapshot(extra:Partial<Snapshot>={}):Snapshot{return {revision:1,sessionId:id(1),language:"en",abilities:[],knowledge:[],patterns:[],effects:[],preferences:[],goals:["daily_communication"],evidence:[],history:[],state:"normal",catalog:[{id:id(2),normalized_key:"learning:polite_requests"}],...extra};}
function event(n:number,extra:Partial<Evidence>={}):Evidence{return {id:id(100+n),activity_id:id(200+n),session_id:id(1),target_skill:"vocabulary",knowledge_item_id:id(2),modality:"reading_recognition",source:"deterministic",evidence_kind:"learning_performance",result:"success",response_quality:4,support_level:0,evaluator_confidence_level:3,transfer_success:null,voice_uncertainty:false,response_time_ms:1000,dedupe_key:`learning-event-${id(n)}`,occurred_at:new Date(now.getTime()+n*1000).toISOString(),processor_status:"applied",metadata:{difficulty:1,method:"sentence_building",topic:"polite_requests",taskKey:`task-${n}`,errors:[],sessionState:"normal",misunderstood:false,firstListen:false,retries:0,timed:false},...extra};}
function history(n:number,quality:number|null=4,extra:Partial<History["metadata"]>={}):History{const decision=decide(snapshot());return {id:id(200+n),session_id:id(1),status:"completed",created_at:new Date(now.getTime()+n*1000).toISOString(),metadata:{decision,task:makeTask(decision,n),quality,support:0,...extra}};}
const ability=(s:Snapshot,events:Evidence[])=>processEvidence(s,events,now).patches.find(p=>p.kind==="ability")?.values;
describe("validated learning evaluation",()=>{
  const result={communicative_success:4,comprehension_success:4,meaning_accuracy:4,sentence_quality:4,vocabulary_retrieval:4,grammar_observations:[],likely_error_categories:[],support_required:0,evaluator_confidence:2,recommended_evidence:[{skill:"written_expression",quality:3},{skill:"spoken_expression",quality:4}]};
  it("typed responses to speaking tasks become written evidence only",()=>{const d={...decide(snapshot()),method:"speaking" as const};expect(scoreLearning(makeTask(d,0),"Hello",result,false,false,0,false)).toMatchObject({skill:"written_expression",modality:"written_production",quality:3});});
  it("revealed listening text produces reading evidence",()=>{const task=makeTask({...decide(snapshot()),method:"listening"},0);expect(scoreLearning(task,task.answer!,null,false,true,5,false)).toMatchObject({skill:"reading",modality:"reading_recognition",support:5});});
  it("unsupported evaluator dimensions are not promoted to trusted target evidence",()=>{const task=makeTask({...decide(snapshot()),method:"speaking"},0);expect(scoreLearning(task,"Hello",{...result,recommended_evidence:[{skill:"intelligibility",quality:4}]},true,false,0,false).quality).toBeNull();});
  it("keeps evaluator-observed support and rejects malformed output",()=>{const task=makeTask({...decide(snapshot()),method:"guided_writing"},0);expect(scoreLearning(task,"Hello",{...result,support_required:2},false,false,0,false).support).toBe(2);expect(()=>scoreLearning(task,"Hello",{...result,communicative_success:99},false,false,0,false)).toThrow();});
});
describe("normal learning evidence processor",()=>{
  it("one success increases observation confidence, not level or mastery",()=>{const result=processEvidence(snapshot(),[event(1)]);expect(result.patches.find(p=>p.kind==="ability")?.values).toMatchObject({estimate_level:0,confidence_level:1});expect(result.patches.find(p=>p.kind==="knowledge")?.values.state).toBe("emerging");});
  it("three independent successes allow only a single-level step",()=>{expect(ability(snapshot({evidence:[event(1),event(2)]}),[event(3)])).toMatchObject({estimate_level:1,confidence_level:2});});
  it("one poor result does not lower an established ability",()=>{expect(ability(snapshot({abilities:[{dimension:"vocabulary",estimate_level:3,confidence_level:2}]}),[event(1,{response_quality:0})])?.estimate_level).toBe(3);});
  it("three comparable failures can lower ability one step",()=>{expect(ability(snapshot({abilities:[{dimension:"vocabulary",estimate_level:3,confidence_level:2}],evidence:[event(1,{response_quality:0}),event(2,{response_quality:0})]}),[event(3,{response_quality:0})])?.estimate_level).toBe(2);});
  it("easy repeats do not raise ability beyond the task level",()=>{expect(ability(snapshot({abilities:[{dimension:"vocabulary",estimate_level:3,confidence_level:2}],evidence:[event(1),event(2)]}),[event(3)])?.estimate_level).toBe(3);});
  it("supported success cannot create independent mastery or boost level",()=>{const events=[1,2,3,4,5].map(n=>event(n,{support_level:5}));const r=processEvidence(snapshot({evidence:events.slice(0,4)}),[events[4]]);expect(r.patches.find(p=>p.kind==="ability")?.values.estimate_level).toBe(0);expect(r.patches.find(p=>p.kind==="knowledge")?.values.state).toBe("supported");});
  it("recognition changes no spoken ability or production knowledge",()=>{const r=processEvidence(snapshot(),[event(1)]);expect(r.patches.filter(p=>p.kind==="ability").map(p=>p.key)).toEqual(["vocabulary"]);expect(r.patches.find(p=>p.kind==="knowledge")?.values.modality).toBe("reading_recognition");});
  it("fatigue and misunderstanding never permanently lower ability",()=>{for(const state of ["tired","frustrated","overloaded"]){const e=event(1);e.metadata.sessionState=state;expect(processEvidence(snapshot(),[e]).patches).toEqual([]);}const e=event(2);e.metadata.misunderstood=true;expect(processEvidence(snapshot(),[e]).patches).toEqual([]);});
  it("voice uncertainty is applied without a pronunciation or ability judgment",()=>{const r=processEvidence(snapshot(),[event(1,{voice_uncertainty:true})]);expect(r.patches).toEqual([]);expect(r.applied).toHaveLength(1);});
  it("repeated low-confidence judgments cannot establish independent ability",()=>{expect(ability(snapshot({evidence:[event(1,{evaluator_confidence_level:1}),event(2,{evaluator_confidence_level:1})]}),[event(3,{evaluator_confidence_level:1})])).toMatchObject({estimate_level:0,confidence_level:0});});
  it("already applied evidence is a no-op on retry",()=>{const e=event(1);expect(processEvidence(snapshot({evidence:[e]}),[e])).toEqual({patches:[],applied:[]});});
  it("consumes pending persisted evidence",()=>{const e=event(1,{processor_status:"pending"});expect(processEvidence(snapshot({evidence:[e]}),[]).applied).toEqual([e.id]);});
  it("requires repeated distinct activities for recurring mistakes",()=>{const events=[1,2,3].map(n=>{const e=event(n,{response_quality:0});e.metadata.errors=["tense"];return e;});expect(processEvidence(snapshot({evidence:events.slice(0,1)}),[events[1]]).patches.some(p=>p.kind==="pattern")).toBe(false);expect(processEvidence(snapshot({evidence:events.slice(0,2)}),[events[2]]).patches.find(p=>p.kind==="pattern")?.values.occurrence_count).toBe(3);});
  it("marks recurring mistakes improving after repeated independent clean use",()=>{const es=[1,2,3,4,5,6].map(n=>{const e=event(n,{response_quality:n<=3?0:4});e.metadata.errors=n<=3?["tense"]:[];return e;});expect(processEvidence(snapshot({evidence:es.slice(0,5)}),[es[5]]).patches.find(p=>p.kind==="pattern")?.values.status).toBe("improving");});
  it("transfer supports stronger confidence than repetition",()=>{const es=[1,2,3,4,5,6].map(n=>event(n,{transfer_success:n>=5?true:null}));const r=processEvidence(snapshot({evidence:es.slice(0,5)}),[es[5]]);expect(r.patches.find(p=>p.kind==="knowledge")?.values).toMatchObject({state:"strong",confidence_level:3});});
  it("one later transfer cannot become three effectiveness observations",()=>{const es=[1,2,3].map(n=>event(n,{response_quality:0}));const r=processEvidence(snapshot({evidence:es}),[event(4,{transfer_success:true})]);expect(r.patches.find(p=>p.kind==="effect")?.values).toMatchObject({effectiveness_state:"promising",evidence_count:1,confidence_level:1});});
  it("does not credit a method from a different skill or difficulty",()=>{for(const mismatch of ["skill","difficulty"]){const later=event(2,{transfer_success:true});if(mismatch==="skill")later.target_skill="grammar";else later.metadata.difficulty=3;expect(processEvidence(snapshot({evidence:[event(1,{response_quality:0})]}),[later]).patches.some(p=>p.kind==="effect")).toBe(false);}});
  it("mixed comparable later outcomes remain mixed, separate from preferences",()=>{const es=[event(1,{response_quality:0}),event(2,{transfer_success:true}),event(3,{response_quality:0}),event(4,{response_quality:0,transfer_success:false})];const r=processEvidence(snapshot({evidence:es.slice(0,3),preferences:[{preference_type:"method",target_key:"sentence_building",strength:-2,value_text:null}]}),[es[3]]);expect(r.patches.find(p=>p.kind==="effect")?.values.effectiveness_state).toBe("mixed");expect(r.patches.some(p=>(p.kind as string)==="preference")).toBe(false);});
  it("review rises with gaps without erasing strong knowledge",()=>{expect(reviewNeed("emerging","2026-08-01",0,now)).toBe(2);expect(reviewNeed("strong","2026-09-01",0,now)).toBe(0);expect(reviewNeed("strong","2026-01-01",0,now)).toBe(2);});
});
describe("adaptive teaching",()=>{
  it("stores structured rationale, version and realistic return rule",()=>{const d=decide(snapshot());expect(d.reasons).toContain("goal_relevance_and_breadth");expect(d.version).toBe("learning-v1");expect(d.returnRule).toContain("two focused");});
  it("prioritizes goal-relevant language",()=>{expect(decide(snapshot({goals:["work"]})).topic).toBe("meeting_times");});
  it("selects review for overdue knowledge",()=>{expect(decide(snapshot({knowledge:[{knowledge_item_id:id(2),modality:"written_production",state:"emerging",confidence_level:1,review_need:3,last_evidence_at:null}]})).purpose).toBe("review");});
  it("prioritizes production review when recognition has not transferred",()=>{const d=decide(snapshot({knowledge:[{knowledge_item_id:id(2),modality:"reading_recognition",state:"recognized",confidence_level:2,review_need:0,last_evidence_at:now.toISOString()}]}),now);expect(d.purpose).toBe("review");expect(d.method).toBe("sentence_building");});
  it("progression does not demand perfect mastery",()=>{expect(decide(snapshot({history:[history(1,2)]})).purpose).toBe("progression");});
  it("does not obsess over the weakest skill or a single topic",()=>{const h=[1,2,3].map(n=>history(n,2));const d=decide(snapshot({history:h,abilities:[{dimension:"spoken_expression",estimate_level:0,confidence_level:2}]}));expect(d.topic).not.toBe(h[0].metadata.decision.topic);});
  it("requires a pattern for difficulty changes",()=>{expect(classifyDifficulty(snapshot({history:[history(1,0)]}))).toBe("somewhat_difficult");expect(classifyDifficulty(snapshot({history:[history(1,0),history(2,0)]}))).toBe("too_difficult");expect(classifyDifficulty(snapshot({history:[history(1),history(2)]}))).toBe("too_easy");});
  it("intervenes immediately when instructions are incomprehensible",()=>{const h=history(1,null,{feedback:"cannot_understand"});h.status="interrupted";expect(decide(snapshot({history:[h]})).difficultyState).toBe("impossible_to_follow");});
  it("increases exposure with repeated independent comprehension",()=>{const low=decide(snapshot());const high=decide(snapshot({evidence:[1,2,3,4].map(n=>event(n,{target_skill:"listening",modality:"listening_recognition"}))}));expect(high.exposure).toBeGreaterThan(low.exposure);});
  it("temporarily restores native support under overload",()=>{const s=snapshot({abilities:[{dimension:"listening",estimate_level:3,confidence_level:2}]});expect(decide({...s,state:"overloaded"}).exposure).toBeLessThan(decide(s).exposure);});
  it("respects explicit method rejection while preserving the objective",()=>{const h=history(1,null,{feedback:"reject_method"});h.status="interrupted";const d=decide(snapshot({history:[h]}));expect(d.objective).toBe(h.metadata.decision.objective);expect(d.method).not.toBe(h.metadata.decision.method);});
  it("promising effectiveness does not redefine a disliked method as liked",()=>{const d=decide(snapshot({preferences:[{preference_type:"method",target_key:"vocabulary_context",strength:-2,value_text:null}],effects:[{teaching_method:"vocabulary_context",target_skill:"vocabulary",effectiveness_state:"repeatedly_helpful",confidence_level:2,evidence_count:3}]}));expect(d.method).not.toBe("vocabulary_context");});
  it("can use a brief helpful but disliked format without changing its preference",()=>{const s=snapshot({state:"tired",preferences:["sentence_building","vocabulary_context","review"].map(target_key=>({preference_type:"method",target_key,strength:-1,value_text:null})),effects:[{teaching_method:"sentence_building",target_skill:"written_expression",effectiveness_state:"repeatedly_helpful",confidence_level:2,evidence_count:4}]});expect(decide(s).method).toBe("sentence_building");expect(s.preferences[0].strength).toBe(-1);expect(decide(s).returnRule).toContain("two focused");});
  it("uses engagement to favor realistic communication without inventing ability",()=>{expect(decide(snapshot({state:"highly_engaged"})).method).toBe("conversation");expect(decide(snapshot({state:"highly_engaged"})).difficulty).toBe(0);});
  it("selects more speaking immediately on explicit request",()=>{const h=history(1,null,{feedback:"more_speaking"});h.status="interrupted";expect(["speaking","role_play"]).toContain(decide(snapshot({history:[h]})).method);});
  it("prefers gentle delayed correction when frustrated",()=>{expect(decide(snapshot({state:"frustrated"})).correction).toBe("delayed");});
  it("focused practice provides a target correction, not unrelated minor errors",()=>{const d=decide(snapshot());const task=makeTask(d,0);expect(correctionText({...d,correction:"hint_first"},task,0,["tense"],0)).toContain(task.explanation);});
  it("support ladder progresses to native clarification and model",()=>{const task=makeTask(decide(snapshot()),0);expect(supportText(task,5,"zh")).toBe(task.native.zh);expect(supportText(task,6,"en")).toContain(task.model);});
  it("returns to transfer after two focused activities",()=>{const h=[history(1,2),history(2,2)];for(const item of h)item.metadata.decision.purpose="weakness_repair";expect(decide(snapshot({history:h})).purpose).toBe("transfer");});
  it("transfer changes context while retaining the learning objective",()=>{const d=decide(snapshot());const t=makeTask({...d,purpose:"transfer"},1);expect(t.topic).toBe(d.topic);expect(t.variant).not.toBe(makeTask(d,0).variant);});
  it("session tiredness shortens demands and avoids aggressive progression",()=>{const d=decide(snapshot({state:"tired",abilities:[{dimension:"vocabulary",estimate_level:4,confidence_level:2}]}));expect(d.purpose).toBe("consolidation");expect(d.speaking.words).toBeLessThanOrEqual(5);});
  it("cross-session review uses old evidence but does not carry tired state",()=>{const h=history(1,0);h.session_id=id(99);expect(classifyDifficulty(snapshot({history:[h]}))).toBe("comfortable");expect(decide(snapshot({history:[h]})).support.initial).toBe(0);});
  it("does not remove replay from advanced listening",()=>{expect(decide(snapshot({abilities:[{dimension:"listening",estimate_level:5,confidence_level:3}]})).listening).toMatchObject({replay:true,transcript:false,speed:1});});
  it("always rejects forged client identity, evidence and difficulty",()=>{expect(commandSchema.safeParse({action:"answer",activityId:id(1),text:"hello",voiceId:null,skip:false,elapsedMs:null,user_id:id(2),evidence:[],difficulty:5}).success).toBe(false);});
});


describe("Phase 16 calibration regressions",()=>{
  it("identical tasks with different activity IDs/difficulty labels do not create mastery",()=>{
    const events=Array.from({length:8},(_,i)=>{const e=event(i+1);e.metadata.taskKey="polite_requests:review:"+i+":0";e.transfer_success=true;return e;});
    const result=processEvidence(snapshot({evidence:events.slice(0,-1)}),events.slice(-1),now);
    expect(result.patches.find(p=>p.kind==="ability")?.values).toMatchObject({estimate_level:0,confidence_level:1});
    expect(result.patches.find(p=>p.kind==="knowledge")?.values.state).toBe("emerging");
  });
  it("conflicting evidence reduces previously high confidence without collapsing level",()=>{
    const events=[1,2,3,4].map(n=>event(n,{response_quality:n%2?0:4}));
    expect(ability(snapshot({abilities:[{dimension:"vocabulary",estimate_level:3,confidence_level:3}],evidence:events.slice(0,-1)}),events.slice(-1))).toMatchObject({estimate_level:3,confidence_level:1});
  });
  it("stale evidence is not current confidence",()=>{expect(calibratedConfidence([1,2,3,4,5,6].map(n=>event(n,{transfer_success:true})),new Date("2027-09-25"))).toBe(0);});
  it("two independent recoveries release sticky review urgency",()=>{
    const s=snapshot({knowledge:[{knowledge_item_id:id(2),modality:"reading_recognition",state:"recognized",confidence_level:2,review_need:3,last_evidence_at:now.toISOString()}],evidence:[event(1)]});
    expect(processEvidence(s,[event(2)],now).patches.find(p=>p.kind==="knowledge")?.values.review_need).toBe(0);
  });
  it("reading recognition cannot raise listening exposure",()=>{expect(decide(snapshot({evidence:[1,2,3,4].map(n=>event(n))}),now).exposure).toBe(decide(snapshot(),now).exposure);});
  it("previous session feedback does not leak into the next session",()=>{const h=history(1,null,{feedback:"cannot_understand"});h.session_id=id(99);expect(decide(snapshot({history:[h]}),now).difficultyState).toBe("comfortable");});
  it("alternating answers do not cause easy/hard oscillation",()=>{const s=snapshot({history:[history(1,4),history(2,0),history(3,4)]});expect(decide(s,now).difficulty).toBe(0);});
  it("listening is selected after a window of reading drills",()=>{const s=snapshot({history:[1,2,3,4,5,6].map(n=>history(n,2))});expect(decide(s,now).method).toBe("listening");});
  it("breadth does not override an explicit listening rejection",()=>{const s=snapshot({history:[1,2,3,4,5,6].map(n=>history(n,2)),preferences:[{preference_type:"method",target_key:"listening",strength:-2,value_text:null}]});expect(decide(s,now).method).not.toBe("listening");});
  it("fatigue never changes stable estimates over repeated failed activities",()=>{const events=Array.from({length:20},(_,i)=>{const e=event(i,{response_quality:0});e.metadata.sessionState="tired";return e;});expect(processEvidence(snapshot({abilities:[{dimension:"vocabulary",estimate_level:4,confidence_level:2}]}),events,now).patches).toEqual([]);});
});


describe("content calibration",()=>{
  it("accepts a useful phrase in communication but requires target order in formal practice",()=>{
    const decision={...decide(snapshot()),method:"speaking" as const};const task=scenarioTask(scenarios.find(s=>s.key==="restaurant")!,0,decision,"test");
    expect(scoreLearning(task,task.model,null,true,false,0,false).quality).toBe(3);
    const formal=makeTask({...decision,method:"sentence_building",topic:"past_events",difficulty:2},0);
    expect(scoreLearning(formal,formal.model.split(" ").reverse().join(" "),null,false,false,0,false).quality).toBeLessThan(2);
  });
  it("a basic phrase cannot establish advanced ability through a difficulty label",()=>{
    const decision={...decide(snapshot()),method:"speaking" as const,difficulty:5};const task=scenarioTask(scenarios[0],0,decision,"test");
    const scored=scoreLearning(task,task.model,null,true,false,0,false);
    const e=learningEvidence({snapshot:snapshot(),task,decision,scored,id:id(31),activityId:id(32),knowledgeId:id(2),now:now.toISOString(),browserVoice:false,voice:true,replay:1,transcript:false,retries:0,elapsedMs:1000,skip:false,evaluationStrategy:"LOCAL_BOUNDED"});
    expect(e.metadata.difficulty).toBe(1);
  });
});
