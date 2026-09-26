"use client";
import { methodLabels } from "@/domain/product/settings";
import { useDraft } from "@/lib/use-draft";
import { checkedResponse, friendlyError } from "@/lib/recovery";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LearningView } from "@/server/services/learning";
import { VoiceTools } from "./voice-tools";
import { useVoicePreferences } from "@/lib/voice/preferences";
const subscribe=()=>()=>{};
async function api(body?:object|FormData){const response=await fetch("/api/learning",body?{method:"POST",headers:body instanceof FormData?{}:{"Content-Type":"application/json"},body:body instanceof FormData?body:JSON.stringify(body)}:{cache:"no-store"});return checkedResponse(response);}
export function LearningClient({initial}:{initial:LearningView}){const t=useT();
  const [view,setView]=useState(initial);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
  const actionLock=useRef(false);
  async function action(data?:object){if(actionLock.current)return;actionLock.current=true;setBusy(true);setError("");try{setView(await (await api(data)).json());}catch(e){setError(friendlyError(e));}finally{actionLock.current=false;setBusy(false);}}
  return <main className="assessment-shell" aria-busy={busy}><header><Link href="/">Adaptive English</Link><span>{t("ui.074")}</span></header>
    {error&&<div role="alert" className="error">{t(error)} <Link href="/login">{t("Sign in")}</Link><button onClick={()=>action()}>{t("ui.011")}</button></div>}
    <p role="status">{busy?t("Saving…"):""}</p><fieldset disabled={busy||!ready} className="assessment-stage">
      {view.kind==="assessment_required"?<section className="assessment-card"><h1>{t("ui.075")}</h1><p>{t("ui.076")}</p><Link href="/assessment">{t("ui.077")}</Link></section>:view.kind==="start"?<section className="assessment-card"><h1>{t("ui.078")}</h1><p>{t("ui.079")}</p><button className="primary" onClick={()=>action({action:"start"})}>{t("ui.080")}</button></section>:view.kind==="summary"?<section className="assessment-card"><h1>{t("ui.081")}</h1>{!!view.summary?.completedScenarios.length&&<p>{t("ui.082")} {view.summary.completedScenarios.join(" · ")}</p>}<h2>{t("ui.083")}</h2><ul>{view.summary?.practiced.map(x=><li key={x}>{x}</li>)}</ul><h2>{t("ui.084")}</h2><p>{view.summary?.worked.join(" · ")||t("ui.085")}</p><h2>{t("ui.086")}</h2><p>{view.summary?.needsPractice.join(" · ")||t("ui.087")}</p><h2>{t("ui.088")}</h2><ul>{view.summary?.expressions.map(x=><li key={x}>{x}</li>)}</ul><p>{view.summary?.next}</p><button className="primary" onClick={()=>action({action:"start"})}>{t("ui.089")}</button></section>:<Activity key={view.activityId} view={view} action={action}/>}
    </fieldset><footer>{t("ui.090")}</footer></main>;
}
function Activity({view,action}:{view:LearningView;action:(data?:object)=>Promise<void>}){const t=useT();
  const feedbackRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    // A new activity replaces a form lower down the page. Bring its saved
    // response feedback into view before the learner tackles the next prompt.
    if(!view.correction)return;
    feedbackRef.current?.focus({preventScroll:true});
    feedbackRef.current?.scrollIntoView({block:"start",behavior:"instant"});
  },[view.activityId,view.correction]);
  const [text,setText]=useDraft(view.activityId);const [voice,setVoice]=useState(view.savedVoice?.id??null);const [transcript,setTranscript]=useState(view.savedVoice?.transcript??"");const [showText,setShowText]=useState(false);
  const preferences=useVoicePreferences();const revealedAutomatically=useRef(false);
  useEffect(()=>{if(preferences.transcript==="automatic"&&view.audio&&!view.transcript&&!revealedAutomatically.current){revealedAutomatically.current=true;void action({action:"support",activityId:view.activityId,kind:"transcript"});}},[preferences.transcript,view.audio,view.transcript,view.activityId,action]);
  const started=useRef<number|null>(null);useEffect(()=>{started.current=Date.now();},[]);
  async function voiceRequest(data:object|FormData){if(data instanceof FormData){data.set("activityId",view.activityId!);return api(data);}return api({...data,activityId:view.activityId});}
  const feedback=(kind:string)=>action({action:"feedback",activityId:view.activityId,kind});
  const help=(kind:string)=>action({action:"support",activityId:view.activityId,kind});
  return <section className="assessment-card">
    <p className="eyebrow">{t(methodLabels[view.method?.replaceAll(" ","_") as keyof typeof methodLabels]??view.method)}</p><h1 lang="en">{view.objective}</h1>
    {view.correction&&<div ref={feedbackRef} tabIndex={-1} role="status" className="support" style={{scrollMarginBlockStart:"1rem"}}>{t(view.correction)}</div>}
    {preferences.transcript==="after_attempt"&&view.previousPrompt&&<p className="support">{t("ui.041")} {view.previousPrompt}</p>}<h2 lang="en">{view.prompt}</h2>{view.nativeHelp&&<p className="support">{view.nativeHelp}</p>}{view.explanation&&<p>{view.explanation}</p>}
    <fieldset  className="assessment-stage">
      {view.voiceAllowed&&(view.audio||view.spoken)&&<VoiceTools speechText={view.speechText} spoken={!!view.spoken} speed={view.speed??1} enhancedAvailable={!!view.enhancedAvailable} request={voiceRequest} played={()=>help("replay")} confirmed={(id,value)=>{setVoice(id);setTranscript(value);setText("");}}/>}
      {view.audio&&<><button onClick={()=>help("transcript")}>{t("ui.091")}</button>{view.transcript&&<p>{view.transcript}</p>}</>}
      {view.spoken&&<><p>{t("Prepare for about {seconds} seconds. Aim for around {words} words; a shorter clear response is welcome.",{seconds:view.preparation??0,words:view.words??0})}</p>{view.frame&&<p>{t("ui.096")} {view.frame}</p>}<p>{t("ui.097")}</p></>}
      {!!view.options?.length?<fieldset><legend>{t("ui.043")}</legend>{view.options.map(option=><label className="option" key={option}><input type="radio" name="learning-answer" checked={text===option} onChange={()=>setText(option)}/>{option}</label>)}</fieldset>:<label>{t("ui.044")}<textarea rows={3} maxLength={3000} value={text} onChange={e=>{setText(e.target.value);setVoice(null);}}/></label>}
      {voice&&<><p>{t("ui.098")}</p><button onClick={()=>setShowText(!showText)}>{t("ui.099")}</button>{showText&&<p>{transcript}</p>}</>}
      <div className="helpers"><button onClick={()=>help("next")}>{t("ui.100")}</button><button onClick={()=>help("native")}>{t("ui.046")}</button></div>{(view.support??0)>0&&<p className="support">{view.supportText}</p>}
      <div className="actions"><button className="primary" disabled={!text.trim()&&!voice} onClick={()=>action({action:"answer",activityId:view.activityId,text,voiceId:voice,skip:false,elapsedMs:started.current?Math.min(3600000,Date.now()-started.current):null})}>{t("ui.101")}</button><button onClick={()=>action({action:"answer",activityId:view.activityId,text:"",voiceId:null,skip:true,elapsedMs:null})}>{t("ui.102")}</button><button onClick={()=>feedback("provider_fallback")}>{t("ui.103")}</button></div>
    </fieldset>
    <fieldset ><legend>{view.feedbackDue?t("ui.104"):t("ui.105")}</legend><div className="helpers">
      <button onClick={()=>feedback("reject_method")}>{t("ui.106")}</button><button onClick={()=>feedback("too_difficult")}>{t("ui.107")}</button><details><summary>{t("ui.108")}</summary><button onClick={()=>feedback("cannot_understand")}>{t("ui.109")}</button><button onClick={()=>feedback("cannot_retrieve")}>{t("ui.110")}</button><button onClick={()=>feedback("less_correction")}>{t("ui.111")}</button><button onClick={()=>feedback("more_speaking")}>{t("ui.112")}</button>
      <button onClick={()=>feedback("tired")}>{t("ui.113")}</button><button onClick={()=>feedback("bored")}>{t("ui.114")}</button><button onClick={()=>feedback("frustrated")}>{t("ui.115")}</button><button onClick={()=>feedback("engaged")}>{t("ui.116")}</button><button onClick={()=>feedback("normal")}>{t("ui.117")}</button>
    </details></div><button onClick={()=>action({action:"end",sessionId:view.sessionId})}>{t("ui.118")}</button></fieldset>
  </section>;
}
