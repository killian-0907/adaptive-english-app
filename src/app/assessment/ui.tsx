"use client";
import { language as supportedLanguage } from "@/lib/i18n/core";
import { useDraft } from "@/lib/use-draft";
import { checkedResponse, friendlyError } from "@/lib/recovery";
import { useT, useLocale, LocaleProvider } from "@/lib/i18n/client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { methods, type Support } from "@/domain/assessment/contracts";
import type { AssessmentView } from "@/server/services/assessment";
import { VoiceTools } from "../learn/voice-tools";
import { useVoicePreferences } from "@/lib/voice/preferences";
const subscribeHydration=()=>()=>{};

async function api(body?: object | FormData) {
  const response = await fetch("/api/assessment",body ? {method:"POST",headers:body instanceof FormData ? {} : {"Content-Type":"application/json"},body:body instanceof FormData ? body : JSON.stringify(body)} : {cache:"no-store"});
  return checkedResponse(response);
}
export function AssessmentClient({initialView}:{initialView:AssessmentView}) {const t=useT();
  const hydrated=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
  const [view,setView] = useState<AssessmentView>(initialView); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  async function load(){try{setView(await (await api()).json());setError("");}catch(e){setError(friendlyError(e));}}
  async function action(body:object){setBusy(true);setError("");try{setView(await (await api(body)).json());}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  return <main className="assessment-shell"><header><Link href="/">Adaptive English</Link><span>{t("ui.010")}</span></header>
    {error && <div role="alert" className="error">{t(error)} <Link href="/login">{t("Sign in")}</Link> <button onClick={load}>{t("ui.011")}</button></div>}
    <p role="status">{busy?t("Saving…"):""}</p><fieldset disabled={!hydrated || busy} className="assessment-stage"><LocaleProvider language={supportedLanguage(view.profile.interface_language)}>{view.onboarding ? <Onboarding busy={busy} onSave={data=>action({action:"onboarding",data})}/> : view.complete ? <Results result={view.result} language={view.profile.interface_language}/> : <Activity key={view.activityId} view={view} busy={busy} onAnswer={data=>action({action:"answer",data})}/>}</LocaleProvider></fieldset>
    <footer>{t("ui.012")}</footer></main>;
}
function Onboarding({busy,onSave}:{busy:boolean;onSave:(data:object)=>void}) {
  const locale=useLocale();const [language,setLanguage] = useState<string>(locale);const t=useT(language);

  return <section className="assessment-card"><p className="eyebrow">01 · {t("ui.013")}</p><h1>{t("ui.014")}</h1><p>{t("ui.015")}</p>
  <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);onSave({nativeLanguage:f.get("nativeLanguage"),interfaceLanguage:f.get("interfaceLanguage"),goals:f.getAll("goals"),experience:f.get("experience"),liked:f.getAll("liked"),disliked:f.getAll("disliked"),correction:f.get("correction"),pace:f.get("pace") || null});}}>
    <div className="form-grid"><label>{t("ui.016")}<select name="nativeLanguage" defaultValue="zh"><option value="zh">中文</option><option value="en">{t("ui.017")}</option><option value="es">{t("ui.018")}</option></select></label>
    <label>{t("ui.019")}<select name="interfaceLanguage" value={language} onChange={e=>setLanguage(e.target.value)}><option value="zh">中文</option><option value="en">{t("ui.017")}</option><option value="es">{t("ui.018")}</option></select></label></div>
    <fieldset><legend>{t("ui.020")}</legend>{[["daily_communication","Daily communication"],["work","Work"],["school","School"],["exams","Exams"]].map(([value,en])=><label className="check" key={value}><input type="checkbox" name="goals" value={value}/>{t(en)}</label>)}</fieldset>
    <label>{t("ui.021")}<select name="experience"><option value="none">{t("ui.022")}</option><option value="some_school">{t("ui.023")}</option><option value="regular_use">{t("ui.024")}</option></select></label>
    {(["liked","disliked"] as const).map(name=><fieldset key={name}><legend>{name === "liked" ? t("ui.025") : t("ui.026")}</legend>{methods.map(m=><label className="check" key={m}><input type="checkbox" name={name} value={m}/>{t(m)}</label>)}</fieldset>)}
    <div className="form-grid"><label>{t("ui.027")}<select name="correction"><option value="after_turn">{t("ui.028")}</option><option value="immediate">{t("ui.029")}</option><option value="gentle">{t("ui.030")}</option></select></label>
    <label>{t("ui.031")}<select name="pace"><option value="">{t("ui.032")}</option><option value="gentle">{t("ui.033")}</option><option value="balanced">{t("ui.034")}</option><option value="brisk">{t("ui.035")}</option></select></label></div>
    <button className="primary" disabled={busy}>{busy ? t("ui.036") : t("ui.037")}</button>
  </form></section>;
}
type ActiveView = Extract<AssessmentView,{complete:false}>;
function Activity({view,busy,onAnswer}:{view:ActiveView;busy:boolean;onAnswer:(data:object)=>void}) {const t=useT();
  const [text,setText]=useDraft(view.activityId);const [support,setSupport]=useState<Support>(view.savedSupport);const [voiceId,setVoiceId]=useState<string|null>(view.savedVoice?.id ?? null);const [recognized,setRecognized]=useState(view.savedVoice?.transcript ?? "");const [revealed,setRevealed]=useState(!!view.savedVoice);const [promptText,setPromptText]=useState("");const [error,setError]=useState("");const [fallback,setFallback]=useState(!view.savedVoice?.id);
  const voicePreferences=useVoicePreferences();const autoTranscript=useRef(false);
  useEffect(()=>{if(voicePreferences.transcript==="automatic"&&view.item.hasAudio&&!autoTranscript.current){autoTranscript.current=true;void api({action:"transcript",activityId:view.activityId}).then(r=>r.json()).then(data=>{setPromptText(data.text);setSupport(s=>({...s,transcript:true}));}).catch(()=>setError("Could not reveal the prompt. Please try Read prompt instead."));}},[voicePreferences.transcript,view.item.hasAudio,view.activityId]);

  async function requestSupport(kind:string){try{setSupport(await(await api({action:"support",activityId:view.activityId,kind})).json());}catch(e){setError(friendlyError(e));}}
  async function voiceRequest(data:object|FormData){if(data instanceof FormData){data.set("activityId",view.activityId);return api(data);}return api({...data,activityId:view.activityId});}
  async function revealPrompt(){try{const data=await (await api({action:"transcript",activityId:view.activityId})).json();setPromptText(data.text);setSupport(s=>({...s,transcript:true}));}catch(e){setError(friendlyError(e));}}
  function submit(skip=false,fatigue=false,dontKnow=false){onAnswer({activityId:view.activityId,text,voiceId:fallback?null:voiceId,skip,fatigue,dontKnow,support});}
  return <section className="assessment-card"><p className="eyebrow">02 · {t("ui.038")}</p><p role="status">{view.count} {t("ui.039")}</p><progress value={view.count} max={14} aria-label={t("ui.040")}/>
    {voicePreferences.transcript==="after_attempt"&&view.previousPrompt&&<p className="support">{t("ui.041")}{view.previousPrompt}</p>}<h1>{view.item.prompt}</h1>{(view.support==="native_supported" || support.translation) && <p className="support">{view.item.instruction}</p>}
    {view.voiceAllowed&&(view.item.hasAudio||view.item.spoken)&&<VoiceTools speechText={view.item.speechText} spoken={view.item.spoken} speed={view.support==="native_supported"?.8:1} enhancedAvailable={view.enhancedAvailable} enhancedRecordsReplay={false} request={voiceRequest} played={()=>requestSupport("replays")} confirmed={(id,value)=>{setVoiceId(id);setRecognized(value);setFallback(false);setRevealed(true);}}/>}
    {error&&<div role="alert" className="error">{t(error)}</div>}
    {view.item.spoken&&<><button onClick={()=>{setFallback(true);setVoiceId(null);}}>{t("ui.042")}</button>{revealed&&<p>{recognized}</p>}</>}
    {view.item.options.length ? <fieldset><legend>{t("ui.043")}</legend>{view.item.options.map(option=><label className="option" key={option}><input type="radio" name="answer" value={option} checked={text===option} onChange={()=>setText(option)}/>{option}</label>)}</fieldset> : fallback && <label>{t("ui.044")}<textarea value={text} maxLength={3000} onChange={e=>setText(e.target.value)} rows={3}/></label>}
    <div className="helpers"><button onClick={()=>requestSupport("hints")}>{t("ui.045")}</button><button onClick={()=>requestSupport("translation")}>{t("ui.046")}</button>{view.item.type==="listening" && <button onClick={revealPrompt}>{t("ui.047")}</button>}</div>
    {support.hints>0 && <p className="support">{view.item.hint}</p>}{promptText && <p>{promptText}</p>}
    <div className="actions"><button disabled={busy} onClick={()=>submit(true,false,true)}>{t("ui.048")}</button><button className="primary" disabled={busy || (!text.trim()&&!voiceId) || (view.item.type==="listening" && !support.replays && !support.transcript)} onClick={()=>submit()}>{busy?t("ui.036"):t("ui.049")}</button><button disabled={busy} onClick={()=>submit(true)}>{t("ui.050")}</button>{view.count>=2 && <button disabled={busy} onClick={()=>submit(true,true)}>{t("ui.051")}</button>}</div>
  </section>;
}
function Results({result}:{result:{model?:{dimension:string;estimate_level:number;confidence_level:number}[];support?:string};language:string|null}) {const t=useT();

  const model=result.model??[];
  const areas=[[t("ui.052"),"listening"],[t("ui.053"),"spoken_expression"],[t("ui.054"),"reading"],[t("ui.055"),"written_expression"]];
  const observed=areas.flatMap(([label,key])=>{const m=model.find(m=>m.dimension===key&&m.confidence_level>0);return m?[{...m,label}]:[];}).sort((a,b)=>b.estimate_level-a.estimate_level);
  const untested=areas.filter(([,key])=>!observed.some(m=>m.dimension===key)).map(([label])=>label);
  const words=["Start with familiar words","Build short everyday phrases","Develop everyday communication","Handle longer ideas","Explore complex situations","Refine nuanced expression","Extend advanced communication"].map(x=>t(x));
  return <section className="assessment-card"><p className="eyebrow">03 · {t("ui.056")}</p><h1>{t("ui.057")}</h1><p>{t("ui.058")}</p>
    <div className="result-grid">{areas.map(([label,key])=>{const m=model.find(x=>x.dimension===key);return <article key={key}><h2>{label}</h2><p>{m&&m.confidence_level>0?words[m.estimate_level]:t("ui.059")}</p><small>{m?.confidence_level===2?t("ui.060"):t("ui.061")}</small></article>;})}</div>
    <h2>{t("ui.062")}</h2><p>{observed.length?observed.slice(0,2).map(m=>m.label).join(" · "):t("ui.063")}</p>
    <h2>{t("ui.064")}</h2><p>{untested.length?`${untested.slice(0,2).join(" · ")} — ${t("ui.065")}`:observed.slice(-2).map(m=>m.label).join(" · ")}</p>
    <h2>{t("ui.066")}</h2><p>{result.support==="mostly_english"?t("ui.067"):result.support==="english_with_fallback"?t("ui.068"):t("ui.069")}</p><p>{t("ui.070")}</p>
    <Link className="primary" href="/learn">{t("ui.071")}</Link>
  </section>;
}
