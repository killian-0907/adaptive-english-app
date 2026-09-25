import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilityState, defaultVoiceSettings, noCapabilities, resolveVoice, voiceSettingsSchema } from "../voice/routing";
import { BrowserRecognition, detectCapabilities, recognitionError, speakBrowser, type Recognition } from "@/lib/voice/browser";
import { evaluateBounded, resolveEvaluation } from "./bounded";
import { planContent, scenarios, scenarioTask } from "./scenarios";
import { decide } from "./engine";
import { scoreLearning } from "./evaluation";
import { commandSchema, type History, type Snapshot } from "./types";
import { transferResult } from "./transfer";
import { evidenceSchema } from "./types";

const s:Snapshot={revision:0,sessionId:"00000000-0000-4000-8000-000000000001",language:"en",abilities:[],knowledge:[],patterns:[],effects:[],preferences:[],goals:[],evidence:[],history:[],state:"normal",catalog:[]};
const decision={...decide(s),method:"conversation" as const,difficulty:2,exposure:3,speaking:{words:10,preparationSeconds:5,frame:false,followUp:false}};
const cafe=scenarios.find(x=>x.key==="restaurant")!;
const cap={...noCapabilities,tts:true,stt:true,englishVoice:true};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe("centralized free voice routing",()=>{
  it("is safe during SSR",()=>expect(detectCapabilities()).toEqual(noCapabilities));
  it("defaults to native even when OpenAI is configured",()=>expect(resolveVoice(cap,defaultVoiceSettings,true)).toEqual({tts:"browser_native",stt:"browser_native"}));
  it("routes unsupported browsers to readable and typed fallback",()=>expect(resolveVoice(noCapabilities,defaultVoiceSettings,false)).toEqual({tts:"text_fallback",stt:"typed_fallback"}));
  it("honors typing independently of ability",()=>expect(resolveVoice(cap,{...defaultVoiceSettings,input:"typing"},true).stt).toBe("typed_fallback"));
  it("denial is a capability state and chooses typing",()=>{const denied={...cap,microphone:"denied" as const};expect(capabilityState(denied)).toBe("microphone_denied");expect(resolveVoice(denied,defaultVoiceSettings,true).stt).toBe("typed_fallback");});
  it("supports TTS alone",()=>expect(capabilityState({...cap,stt:false})).toBe("tts_only"));
  it("enhanced failure returns to native",()=>expect(resolveVoice(cap,{...defaultVoiceSettings,enhanced:true},true,{enhanced:true})).toEqual({tts:"browser_native",stt:"browser_native"}));
  it("requires both opt-in and configuration for enhanced calls",()=>{expect(resolveVoice(cap,{...defaultVoiceSettings,enhanced:true},false).tts).toBe("browser_native");expect(resolveVoice(cap,{...defaultVoiceSettings,enhanced:true},true).stt).toBe("openai");});
  it("validates safe rates and autoplay off",()=>{expect(defaultVoiceSettings.autoplay).toBe(false);expect(voiceSettingsSchema.safeParse({rate:8}).success).toBe(false);});
});
describe("native browser controller contracts",()=>{
  class FakeRecognition implements Recognition {
    static current:FakeRecognition;lang="";continuous=true;interimResults=false;onresult:Recognition["onresult"]=null;onerror:Recognition["onerror"]=null;onend:Recognition["onend"]=null;
    start=vi.fn();stop=vi.fn();abort=vi.fn();constructor(){FakeRecognition.current=this;}
  }
  it("sets English, surfaces interim and final, and bounds recording duration",()=>{vi.useFakeTimers();const result=vi.fn();const session=new BrowserRecognition(FakeRecognition,{result,error:vi.fn(),end:vi.fn()});session.start();const r=FakeRecognition.current;expect(r.lang).toBe("en-US");expect(r.interimResults).toBe(true);r.onresult!({resultIndex:0,results:{length:1,0:{isFinal:false,length:1,0:{transcript:"Water"}}}});r.onresult!({resultIndex:0,results:{length:1,0:{isFinal:true,length:1,0:{transcript:"Water please"}}}});expect(result.mock.calls).toEqual([["Water",false],["Water please",true]]);vi.advanceTimersByTime(45000);expect(r.stop).toHaveBeenCalledOnce();});
  it("cancel aborts and discards callbacks",()=>{const end=vi.fn();const session=new BrowserRecognition(FakeRecognition,{result:vi.fn(),error:vi.fn(),end});session.start();session.cancel();expect(FakeRecognition.current.abort).toHaveBeenCalledOnce();expect(FakeRecognition.current.onresult).toBeNull();expect(end).not.toHaveBeenCalled();});
  it("does not describe no-speech as an English mistake",()=>expect(recognitionError("no-speech")).toContain("not an English mistake"));
  it("surfaces recognition errors without a score",()=>{const error=vi.fn();new BrowserRecognition(FakeRecognition,{result:vi.fn(),error,end:vi.fn()});FakeRecognition.current.onerror!({error:"not-allowed"});expect(error).toHaveBeenCalledWith(expect.stringContaining("denied"),"not-allowed");});
  it("TTS selects an English voice, bounds rate and cancels on cleanup",()=>{const english={voiceURI:"en",lang:"en-US"};const synth={cancel:vi.fn(),speak:vi.fn(),getVoices:()=>[english]};vi.stubGlobal("window",{speechSynthesis:synth});vi.stubGlobal("SpeechSynthesisUtterance",class {constructor(public text:string){}});const end=vi.fn();const stop=speakBrowser("Hello",8,"en",end,vi.fn());const u=synth.speak.mock.calls[0][0];expect(u).toMatchObject({text:"Hello",lang:"en-US",rate:1.25,voice:english});u.onend();expect(end).toHaveBeenCalledOnce();stop();expect(synth.cancel).toHaveBeenCalledTimes(2);expect(u.onend).toBeNull();});
});
describe("bounded evidence and scenarios",()=>{
  it("contains ten distinct reusable families and multiple turns",()=>{expect(new Set(scenarios.map(x=>x.key)).size).toBe(10);expect(scenarios.every(x=>x.turns.length>=2)).toBe(true);});
  it("accepts every declared model and alternative",()=>{for(const scenario of scenarios)for(let index=0;index<scenario.turns.length;index++){const task=scenarioTask(scenario,index,decision,"run");for(const phrase of task.criteria!.phrases)expect(evaluateBounded(phrase,task.criteria!).quality).toBe(3);}});
  it("recognizes imperfect but clear short requests",()=>expect(evaluateBounded("Please water!",scenarioTask(cafe,0,decision,"run").criteria!).quality).toBe(3));
  it("does not guess intent from negation, keyword soup or novel long text",()=>{const criteria=scenarioTask(cafe,0,decision,"run").criteria!;for(const text of ["I don't want water please","please water train report","A complicated unrecognized request"]){expect(evaluateBounded(text,criteria)).toMatchObject({quality:null,confidence:0});}});
  it("routes strict/local/AI/unassessed separately",()=>{expect(resolveEvaluation("exact",false,false,false)).toBe("DETERMINISTIC");expect(resolveEvaluation("local_bounded",true,false,false)).toBe("LOCAL_BOUNDED");expect(resolveEvaluation("evaluator",false,true,true)).toBe("AI_STRUCTURED");expect(resolveEvaluation("evaluator",false,false,true)).toBe("FALLBACK");});
  it("typed response is written content, never oral fluency",()=>{const task=scenarioTask(cafe,0,decision,"run");expect(scoreLearning(task,"Water please",null,false,false,0,false)).toMatchObject({skill:"written_expression",modality:"written_production",quality:3});});
  it("partner transcript does not turn a spoken response into reading",()=>{const task=scenarioTask(cafe,0,decision,"run");expect(scoreLearning(task,"Water please",null,true,true,5,false)).toMatchObject({skill:"spoken_expression",modality:"spoken_production"});});
  it("revealed listening answers are reading evidence",()=>{const task=scenarioTask(cafe,0,{...decision,method:"listening"},"run");expect(scoreLearning(task,task.answer!,null,false,true,5,false)).toMatchObject({skill:"reading",modality:"reading_recognition",support:5});});
  it("unavailable nuanced evaluation remains unassessed",()=>{const task={...scenarioTask(cafe,0,decision,"run"),criteria:undefined,strategy:"evaluator" as const};expect(scoreLearning(task,"Water please",null,false,false,0,false).quality).toBeNull();});
  const past=(quality:number|null):History=>({id:"h",session_id:s.sessionId,status:"completed",created_at:"2026-09-25",metadata:{decision,task:scenarioTask(cafe,0,decision,"run"),quality,support:0}});
  it("continues a successful short exchange",()=>{const result=planContent({...s,history:[past(3)]},{...decision,method:"review"});expect(result.task.scenario).toMatchObject({family:"restaurant",turn:1,run:"run"});});
  it("gives one bounded repair then returns control",()=>{const h=past(null);const first=planContent({...s,history:[h]},decision);expect(first.task.scenario?.turn).toBe(0);expect(first.decision.support.initial).toBeGreaterThanOrEqual(3);const next=planContent({...s,history:[h,{...h,id:"h2"}]},decision);expect(next.task.scenario?.run).not.toBe("run");});
  it("explicit rejection interrupts scenario continuity",()=>{const h={...past(3),status:"interrupted"};expect(planContent({...s,history:[h]},{...decision,method:"sentence_building"}).task.scenario).toBeUndefined();});
  it("adapts frames and audio-first support",()=>{const low=planContent(s,{...decision,speaking:{...decision.speaking,frame:true},listening:{...decision.listening,speed:.8}});const high=planContent(s,{...decision,difficulty:4});expect(low.decision.support.initial).toBe(4);expect(low.decision.listening.speed).toBe(.8);expect(low.decision.listening.transcript).toBe(false);expect(high.task.prompt).toContain("Respond naturally");});
  it("reuses request knowledge across settings",()=>{const first=scenarioTask(cafe,0,decision,"a");const second=scenarioTask(scenarios.find(x=>x.key==="shopping")!,0,decision,"b");expect(first.criteria!.function).toBe(second.criteria!.function);expect(first.scenario!.family).not.toBe(second.scenario!.family);});
  it("rejects client scores and invalid transcript ids",()=>expect(commandSchema.safeParse({action:"browser_voice",activityId:s.sessionId,attemptId:s.sessionId,text:"Hello",quality:4}).success).toBe(false));
  it("stronger scenarios include concrete misunderstanding repair",()=>{const task=scenarioTask(cafe,1,{...decision,difficulty:4},"run");expect(task.context).toContain("sparkling");expect(task.criteria?.function).toBe("repair");expect(evaluateBounded("No still please",task.criteria!).quality).toBe(3);});
  it("retains new communication functions during targeted intervention",()=>{const h=past(3);h.status="interrupted";h.metadata.decision={...decision,topic:"choose",objective:"Make a choice"};h.metadata.feedback="reject_method";const model={...s,history:[h]};const next=planContent(model,decide(model));expect(next.decision.topic).toBe("choose");});
  it("only independent reuse in a genuinely new context is transfer",()=>{
    const task=scenarioTask(cafe,0,decision,"run");const d={...decision,purpose:"transfer" as const};
    const evidence=evidenceSchema.parse({id:s.sessionId,session_id:s.sessionId,activity_id:s.sessionId,target_skill:"written_expression",knowledge_item_id:null,modality:"written_production",source:"deterministic",evidence_kind:"learning_performance",result:"success",response_quality:3,support_level:0,evaluator_confidence_level:2,transfer_success:null,voice_uncertainty:false,response_time_ms:null,dedupe_key:"a-long-enough-dedupe-key",occurred_at:"2026-09-25",processor_status:"applied",metadata:{difficulty:2,method:"conversation",topic:task.topic,taskKey:"different",errors:[],sessionState:"normal",misunderstood:false,firstListen:false,retries:0,timed:false,scenarioFamily:"shopping"}});
    const model={...s,evidence:[evidence]};expect(transferResult(model,task,d,3,0,2,false,0)).toBe(true);
    for(const [support,uncertain,retries] of [[1,false,0],[0,true,0],[0,false,1]] as const)expect(transferResult(model,task,d,3,support,2,uncertain,retries)).toBeNull();
    expect(transferResult({...model,evidence:[{...evidence,metadata:{...evidence.metadata,scenarioFamily:"restaurant"}}]},task,d,3,0,2,false,0)).toBeNull();
  });
});
