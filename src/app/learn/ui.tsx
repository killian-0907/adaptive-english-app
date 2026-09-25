"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LearningView } from "@/server/services/learning";
import { VoiceTools } from "./voice-tools";
const subscribe=()=>()=>{};
async function api(body?:object|FormData){const response=await fetch("/api/learning",body?{method:"POST",headers:body instanceof FormData?{}:{"Content-Type":"application/json"},body:body instanceof FormData?body:JSON.stringify(body)}:{cache:"no-store"});if(!response.ok)throw new Error((await response.json()).error??"Please try again.");return response;}
export function LearningClient({initial}:{initial:LearningView}){
  const [view,setView]=useState(initial);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
  async function action(data?:object){setBusy(true);setError("");try{setView(await (await api(data)).json());}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="assessment-shell"><header><Link href="/">Adaptive English</Link><span>Useful English, one step at a time</span></header>
    {error&&<div role="alert" className="error">{error}<button onClick={()=>action()}>Resume saved progress</button></div>}
    <fieldset disabled={busy||!ready} className="assessment-stage">
      {view.kind==="assessment_required"?<section className="assessment-card"><h1>Find your starting point</h1><p>Complete the initial assessment before starting a learning session.</p><Link href="/assessment">Start or resume assessment</Link></section>:view.kind==="start"?<section className="assessment-card"><h1>Put your English to use</h1><p>We’ll choose a short activity from your starting point and adapt as you practise. You can change the format or ask for help at any time.</p><button className="primary" onClick={()=>action({action:"start"})}>Start learning session</button></section>:view.kind==="summary"?<section className="assessment-card"><h1>Your session</h1>{!!view.summary?.completedScenarios.length&&<p>Completed exchanges: {view.summary.completedScenarios.join(" · ")}</p>}<h2>What you practised</h2><ul>{view.summary?.practiced.map(x=><li key={x}>{x}</li>)}</ul><h2>What worked independently</h2><p>{view.summary?.worked.join(" · ")||"We are still gathering evidence. Supported practice counts as practice, not independent mastery."}</p><h2>Keep practising</h2><p>{view.summary?.needsPractice.join(" · ")||"Try using these ideas again in another situation."}</p><h2>Useful expressions</h2><ul>{view.summary?.expressions.map(x=><li key={x}>{x}</li>)}</ul><p>{view.summary?.next}</p><button className="primary" onClick={()=>action({action:"start"})}>Start another session</button></section>:<Activity key={view.activityId} view={view} action={action}/>}
    </fieldset><footer>You can leave and resume. Temporary tiredness does not define your English ability.</footer></main>;
}
function Activity({view,action}:{view:LearningView;action:(data?:object)=>Promise<void>}){
  const [text,setText]=useState("");const [voice,setVoice]=useState(view.savedVoice?.id??null);const [transcript,setTranscript]=useState(view.savedVoice?.transcript??"");const [showText,setShowText]=useState(false);
  const started=useRef<number|null>(null);useEffect(()=>{started.current=Date.now();},[]);
  async function voiceRequest(data:object|FormData){if(data instanceof FormData){data.set("activityId",view.activityId!);return api(data);}return api({...data,activityId:view.activityId});}
  const feedback=(kind:string)=>action({action:"feedback",activityId:view.activityId,kind});
  const help=(kind:string)=>action({action:"support",activityId:view.activityId,kind});
  return <section className="assessment-card">
    <p className="eyebrow">{view.method}</p><h1>{view.objective}</h1>
    {view.correction&&<div role="status" className="support">{view.correction}</div>}
    <h2>{view.prompt}</h2>{view.nativeHelp&&<p className="support">{view.nativeHelp}</p>}{view.explanation&&<p>{view.explanation}</p>}
    <fieldset  className="assessment-stage">
      {(view.audio||view.spoken)&&<VoiceTools speechText={view.speechText} spoken={!!view.spoken} speed={view.speed??1} enhancedAvailable={!!view.enhancedAvailable} request={voiceRequest} played={()=>help("replay")} confirmed={(id,value)=>{setVoice(id);setTranscript(value);setText("");}}/>}
      {view.audio&&<><button onClick={()=>help("transcript")}>Read instead</button>{view.transcript&&<p>{view.transcript}</p>}</>}
      {view.spoken&&<><p>Take about {view.preparation} seconds to prepare. Aim for {view.words} word{view.words===1?"":"s"}; a shorter clear response is welcome.</p>{view.frame&&<p>Optional frame: {view.frame}</p>}<p>You may record or type. Typed responses count as writing practice.</p></>}
      {!!view.options?.length?<fieldset><legend>Choose an answer</legend>{view.options.map(option=><label className="option" key={option}><input type="radio" name="learning-answer" checked={text===option} onChange={()=>setText(option)}/>{option}</label>)}</fieldset>:<label>Your response<textarea rows={3} maxLength={3000} value={text} onChange={e=>{setText(e.target.value);setVoice(null);}}/></label>}
      {voice&&<><p>Recorded response ready.</p><button onClick={()=>setShowText(!showText)}>Show / hide recognized text</button>{showText&&<p>{transcript}</p>}</>}
      <div className="helpers"><button onClick={()=>help("next")}>Next hint</button><button onClick={()=>help("native")}>Native-language help</button></div>{(view.support??0)>0&&<p className="support">{view.supportText}</p>}
      <div className="actions"><button className="primary" disabled={!text.trim()&&!voice} onClick={()=>action({action:"answer",activityId:view.activityId,text,voiceId:voice,skip:false,elapsedMs:started.current?Math.min(3600000,Date.now()-started.current):null})}>Check response</button><button onClick={()=>action({action:"answer",activityId:view.activityId,text:"",voiceId:null,skip:true,elapsedMs:null})}>Skip unscored</button><button onClick={()=>feedback("provider_fallback")}>Try a structured activity</button></div>
    </fieldset>
    <fieldset ><legend>{view.feedbackDue?"How is this working? A quick adjustment can help.":"Adjust whenever you need"}</legend><div className="helpers">
      <button onClick={()=>feedback("reject_method")}>This method doesn’t work for me</button><button onClick={()=>feedback("too_difficult")}>Too difficult</button><details><summary>More ways to adjust</summary><button onClick={()=>feedback("cannot_understand")}>I don’t understand the question</button><button onClick={()=>feedback("cannot_retrieve")}>I understand, but can’t find the words</button><button onClick={()=>feedback("less_correction")}>Less correction</button><button onClick={()=>feedback("more_speaking")}>More speaking</button>
      <button onClick={()=>feedback("tired")}>I’m tired</button><button onClick={()=>feedback("bored")}>Too easy / bored</button><button onClick={()=>feedback("frustrated")}>I’m frustrated</button><button onClick={()=>feedback("engaged")}>This is engaging</button><button onClick={()=>feedback("normal")}>I’m ready again</button>
    </details></div><button onClick={()=>action({action:"end",sessionId:view.sessionId})}>End session</button></fieldset>
  </section>;
}
