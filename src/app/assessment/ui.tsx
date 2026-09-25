"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { methods, type Support } from "@/domain/assessment/contracts";
import type { AssessmentView } from "@/server/services/assessment";
import { VoiceTools } from "../learn/voice-tools";
import { useVoicePreferences } from "@/lib/voice/preferences";
const subscribeHydration=()=>()=>{};

async function api(body?: object | FormData) {
  const response = await fetch("/api/assessment",body ? {method:"POST",headers:body instanceof FormData ? {} : {"Content-Type":"application/json"},body:body instanceof FormData ? body : JSON.stringify(body)} : {cache:"no-store"});
  if(!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Please try again."); }
  return response;
}
export function AssessmentClient({initialView}:{initialView:AssessmentView}) {
  const hydrated=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
  const [view,setView] = useState<AssessmentView>(initialView); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  async function load(){try{setView(await (await api()).json());setError("");}catch(e){setError((e as Error).message);}}
  async function action(body:object){setBusy(true);setError("");try{setView(await (await api(body)).json());}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="assessment-shell"><header><Link href="/">Adaptive English</Link><span>A starting point, made for you</span></header>
    {error && <div role="alert" className="error">{error} <button onClick={load}>Resume saved progress</button></div>}
    <fieldset disabled={!hydrated || busy} className="assessment-stage">{view.onboarding ? <Onboarding busy={busy} onSave={data=>action({action:"onboarding",data})}/> : view.complete ? <Results result={view.result} language={view.profile.interface_language}/> : <Activity key={view.activityId} view={view} busy={busy} onAnswer={data=>action({action:"answer",data})}/>}</fieldset>
    <footer>Your answers help us find a comfortable starting point. You can leave and resume later.</footer></main>;
}
function Onboarding({busy,onSave}:{busy:boolean;onSave:(data:object)=>void}) {
  const [language,setLanguage] = useState("zh");
  const zh = language === "zh"; const es = language === "es";
  const t = (en:string,cn:string,sp:string) => zh ? cn : es ? sp : en;
  return <section className="assessment-card"><p className="eyebrow">01 · {t("About you","认识你","Sobre ti")}</p><h1>{t("Make English useful to you","让英语适合你的生活","Haz que el inglés te sea útil")}</h1><p>{t("These preferences are starting ideas. They can change as you learn.","这些偏好只是起点，会随着学习逐渐调整。","Estas preferencias son un punto de partida y pueden cambiar.")}</p>
  <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);onSave({nativeLanguage:f.get("nativeLanguage"),interfaceLanguage:f.get("interfaceLanguage"),goals:f.getAll("goals"),experience:f.get("experience"),liked:f.getAll("liked"),disliked:f.getAll("disliked"),correction:f.get("correction"),pace:f.get("pace") || null});}}>
    <div className="form-grid"><label>{t("Native language","母语","Lengua materna")}<select name="nativeLanguage" defaultValue="zh"><option value="zh">中文</option><option value="en">English</option><option value="es">Español</option></select></label>
    <label>{t("Interface language","界面语言","Idioma de interfaz")}<select name="interfaceLanguage" value={language} onChange={e=>setLanguage(e.target.value)}><option value="zh">中文</option><option value="en">English</option><option value="es">Español</option></select></label></div>
    <fieldset><legend>{t("What will you use English for? Choose at least one.","你想用英语做什么？至少选择一项。","¿Para qué usarás el inglés? Elige al menos uno.")}</legend>{[["daily_communication","Daily communication","日常交流","Comunicación diaria"],["work","Work","工作","Trabajo"],["school","School","学校","Estudios"],["exams","Exams","考试","Exámenes"]].map(([value,en,cn,sp])=><label className="check" key={value}><input type="checkbox" name="goals" value={value}/>{t(en,cn,sp)}</label>)}</fieldset>
    <label>{t("Previous experience","以前的英语学习经历","Experiencia previa")}<select name="experience"><option value="none">{t("Little or none","几乎没有","Poca o ninguna")}</option><option value="some_school">{t("Some classes","上过一些课","Algunas clases")}</option><option value="regular_use">{t("I use English regularly","经常使用英语","Uso inglés con frecuencia")}</option></select></label>
    {(["liked","disliked"] as const).map(name=><fieldset key={name}><legend>{name === "liked" ? t("Methods you enjoy (optional)","喜欢的学习方式（可选）","Métodos que disfrutas (opcional)") : t("Methods you dislike (optional)","不喜欢的学习方式（可选）","Métodos que no disfrutas (opcional)")}</legend>{methods.map((m,i)=><label className="check" key={m}><input type="checkbox" name={name} value={m}/>{t(m,["对话","听力","阅读","写作","例子","重复练习"][i],["conversación","escucha","lectura","escritura","ejemplos","repetición"][i])}</label>)}</fieldset>)}
    <div className="form-grid"><label>{t("Correction preference","纠错偏好","Correcciones")}<select name="correction"><option value="after_turn">{t("After my turn","说完再纠正","Después de mi turno")}</option><option value="immediate">{t("Immediately","立即纠正","Inmediatamente")}</option><option value="gentle">{t("Gentle, only key points","温和提醒重点","Solo lo esencial")}</option></select></label>
    <label>{t("Pace (optional)","节奏（可选）","Ritmo (opcional)")}<select name="pace"><option value="">{t("No preference","暂不选择","Sin preferencia")}</option><option value="gentle">{t("Gentle","慢慢来","Suave")}</option><option value="balanced">{t("Balanced","适中","Equilibrado")}</option><option value="brisk">{t("Brisk","快一点","Rápido")}</option></select></label></div>
    <button className="primary" disabled={busy}>{busy ? t("Saving…","保存中…","Guardando…") : t("Start assessment","开始评估","Empezar evaluación")}</button>
  </form></section>;
}
type ActiveView = Extract<AssessmentView,{complete:false}>;
function Activity({view,busy,onAnswer}:{view:ActiveView;busy:boolean;onAnswer:(data:object)=>void}) {
  const [text,setText]=useState("");const [support,setSupport]=useState<Support>(view.savedSupport);const [voiceId,setVoiceId]=useState<string|null>(view.savedVoice?.id ?? null);const [recognized,setRecognized]=useState(view.savedVoice?.transcript ?? "");const [revealed,setRevealed]=useState(!!view.savedVoice);const [promptText,setPromptText]=useState("");const [error,setError]=useState("");const [fallback,setFallback]=useState(!view.savedVoice?.id);
  const voicePreferences=useVoicePreferences();const autoTranscript=useRef(false);
  useEffect(()=>{if(voicePreferences.transcript==="automatic"&&view.item.hasAudio&&!autoTranscript.current){autoTranscript.current=true;void api({action:"transcript",activityId:view.activityId}).then(r=>r.json()).then(data=>{setPromptText(data.text);setSupport(s=>({...s,transcript:true}));}).catch(()=>setError("Could not reveal the prompt. Please try Read prompt instead."));}},[voicePreferences.transcript,view.item.hasAudio,view.activityId]);
  const lang=view.profile.interface_language;const t=(en:string,zh:string,es:string)=>lang==="zh"?zh:lang==="es"?es:en;
  async function requestSupport(kind:string){try{setSupport(await(await api({action:"support",activityId:view.activityId,kind})).json());}catch(e){setError((e as Error).message);}}
  async function voiceRequest(data:object|FormData){if(data instanceof FormData){data.set("activityId",view.activityId);return api(data);}return api({...data,activityId:view.activityId});}
  async function revealPrompt(){try{const data=await (await api({action:"transcript",activityId:view.activityId})).json();setPromptText(data.text);setSupport(s=>({...s,transcript:true}));}catch(e){setError((e as Error).message);}}
  function submit(skip=false,fatigue=false,dontKnow=false){onAnswer({activityId:view.activityId,text,voiceId:fallback?null:voiceId,skip,fatigue,dontKnow,support});}
  return <section className="assessment-card"><p className="eyebrow">02 · {t("Finding your starting point","寻找适合你的起点","Tu punto de partida")}</p><p role="status">{view.count} {t("activities saved · up to 14 brief activities","项已保存 · 最多 14 个简短活动","actividades guardadas · hasta 14 actividades breves")}</p><progress value={view.count} max={14} aria-label="Assessment progress"/>
    {voicePreferences.transcript==="after_attempt"&&view.previousPrompt&&<p className="support">Previous prompt: {view.previousPrompt}</p>}<h1>{view.item.prompt}</h1>{(view.support==="native_supported" || support.translation) && <p className="support">{view.item.instruction}</p>}
    {view.voiceAllowed&&(view.item.hasAudio||view.item.spoken)&&<VoiceTools speechText={view.item.speechText} spoken={view.item.spoken} speed={view.support==="native_supported"?.8:1} enhancedAvailable={view.enhancedAvailable} enhancedRecordsReplay={false} request={voiceRequest} played={()=>requestSupport("replays")} confirmed={(id,value)=>{setVoiceId(id);setRecognized(value);setFallback(false);setRevealed(true);}}/>}
    {error&&<div role="alert" className="error">{error}</div>}
    {view.item.spoken&&<><button onClick={()=>{setFallback(true);setVoiceId(null);}}>Type instead</button>{revealed&&<p>{recognized}</p>}</>}
    {view.item.options.length ? <fieldset><legend>{t("Choose an answer","选择答案","Elige una respuesta")}</legend>{view.item.options.map(option=><label className="option" key={option}><input type="radio" name="answer" value={option} checked={text===option} onChange={()=>setText(option)}/>{option}</label>)}</fieldset> : fallback && <label>{t("Your response","你的回答","Tu respuesta")}<textarea value={text} maxLength={3000} onChange={e=>setText(e.target.value)} rows={3}/></label>}
    <div className="helpers"><button onClick={()=>requestSupport("hints")}>{t("Get a hint","提示","Pista")}</button><button onClick={()=>requestSupport("translation")}>{t("Native-language help","母语帮助","Ayuda en tu idioma")}</button>{view.item.type==="listening" && <button onClick={revealPrompt}>{t("Read prompt instead","改为阅读题目","Leer el texto")}</button>}</div>
    {support.hints>0 && <p className="support">{view.item.hint}</p>}{promptText && <p>{promptText}</p>}
    <div className="actions"><button disabled={busy} onClick={()=>submit(true,false,true)}>{t("I do not understand yet","还不懂，简单一点","Todavía no entiendo")}</button><button className="primary" disabled={busy || (!text.trim()&&!voiceId) || (view.item.type==="listening" && !support.replays && !support.transcript)} onClick={()=>submit()}>{busy?t("Saving…","保存中…","Guardando…"):t("Continue","继续","Continuar")}</button><button disabled={busy} onClick={()=>submit(true)}>{t("I don't know / skip","不知道 / 跳过","No sé / omitir")}</button>{view.count>=2 && <button disabled={busy} onClick={()=>submit(true,true)}>{t("I'm tired · finish for now","有点累 · 暂时结束","Estoy cansado · terminar")}</button>}</div>
  </section>;
}
function Results({result,language}:{result:{model?:{dimension:string;estimate_level:number;confidence_level:number}[];support?:string};language:string|null}) {
  const t=(en:string,zh:string,es:string)=>language==="zh"?zh:language==="es"?es:en;
  const model=result.model??[];
  const areas=[[t("Listening","听力","Escucha"),"listening"],[t("Speaking","口语","Expresión oral"),"spoken_expression"],[t("Reading","阅读","Lectura"),"reading"],[t("Writing","写作","Escritura"),"written_expression"]];
  const observed=areas.flatMap(([label,key])=>{const m=model.find(m=>m.dimension===key&&m.confidence_level>0);return m?[{...m,label}]:[];}).sort((a,b)=>b.estimate_level-a.estimate_level);
  const untested=areas.filter(([,key])=>!observed.some(m=>m.dimension===key)).map(([label])=>label);
  const words=language==="zh"?["从熟悉的单词开始","逐步掌握简短日常表达","发展日常交流能力","尝试表达更长的想法","探索复杂情景","练习细腻准确的表达","拓展高级交流能力"]:language==="es"?["Empieza con palabras familiares","Desarrolla frases cotidianas cortas","Desarrolla la comunicación cotidiana","Trabaja con ideas más largas","Explora situaciones complejas","Afina la expresión de matices","Amplía la comunicación avanzada"]:["Start with familiar words","Build short everyday phrases","Develop everyday communication","Handle longer ideas","Explore complex situations","Refine nuanced expression","Extend advanced communication"];
  return <section className="assessment-card"><p className="eyebrow">03 · {t("Your starting point","你的起点","Tu punto de partida")}</p><h1>{t("Ready to begin","可以开始了","Listo para empezar")}</h1><p>{t("This is an initial snapshot, not a certification. We will learn more as you practise.","这只是初步观察，不是等级认证。随着练习，我们会更了解你。","Es una primera impresión, no una certificación. Aprenderemos más mientras practicas.")}</p>
    <div className="result-grid">{areas.map(([label,key])=>{const m=model.find(x=>x.dimension===key);return <article key={key}><h2>{label}</h2><p>{m&&m.confidence_level>0?words[m.estimate_level]:t("Not enough evidence yet","暂时没有足够证据","Aún no hay suficiente evidencia")}</p><small>{m?.confidence_level===2?t("Some consistent evidence","已有一些一致的观察","Algunas observaciones coherentes"):t("Tentative · more practice will clarify","初步判断 · 需要更多练习来了解","Provisional · más práctica lo aclarará")}</small></article>;})}</div>
    <h2>{t("What to build on","可以发挥的方面","Tu punto de apoyo")}</h2><p>{observed.length?observed.slice(0,2).map(m=>m.label).join(" · "):t("We will start gently and discover your strengths.","我们会从简单内容开始，一起发现你的长处。","Empezaremos con calma para descubrir tus fortalezas.")}</p>
    <h2>{t("First focus","首先关注","Primer enfoque")}</h2><p>{untested.length?`${untested.slice(0,2).join(" · ")} — ${t("gentle practice to learn more","通过轻松练习继续了解","práctica suave para conocer más")}`:observed.slice(-2).map(m=>m.label).join(" · ")}</p>
    <h2>{t("Language support","语言帮助","Apoyo lingüístico")}</h2><p>{result.support==="mostly_english"?t("Mostly English, with help whenever needed.","以英语为主，需要时随时提供帮助。","Principalmente inglés, con ayuda cuando la necesites."):result.support==="english_with_fallback"?t("English first, with native-language help available.","英语优先，同时提供母语帮助。","Inglés primero, con ayuda en tu idioma."):t("Bilingual instructions and short, clear English.","双语提示，简短清晰的英语，循序渐进。","Instrucciones bilingües e inglés breve y claro.")}</p><p>{t("Speaking fluency and pronunciation need more direct evidence. A transcription failure is never a pronunciation judgment.","口语流利度和发音还需要更多直接证据。语音识别失败不代表发音不好。","La fluidez y pronunciación requieren más evidencia directa. Un fallo de transcripción no juzga tu pronunciación.")}</p>
    <Link className="primary" href="/learn">{t("Start learning","开始学习","Empezar a aprender")}</Link>
  </section>;
}
