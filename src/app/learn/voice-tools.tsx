"use client";
import { useT } from "@/lib/i18n/client";
import { useEffect, useRef, useState } from "react";
import { capabilityState, defaultVoiceSettings, noCapabilities, resolveVoice, voiceSettingsSchema, type VoiceSettings } from "@/domain/voice/routing";
import { BrowserRecognition, detectCapabilities, recognitionConstructor, speakBrowser } from "@/lib/voice/browser";

const settingsKey="adaptive-english.voice.v1";
export function VoiceTools({speechText,spoken,speed,enhancedAvailable,enhancedRecordsReplay=true,request,played,confirmed}:{speechText?:string;spoken:boolean;speed:number;enhancedAvailable:boolean;enhancedRecordsReplay?:boolean;request:(body:object|FormData)=>Promise<Response>;played:()=>Promise<void>;confirmed:(id:string,text:string)=>void}){const t=useT();
  const [cap,setCap]=useState(noCapabilities);const [settings,setSettings]=useState(defaultVoiceSettings);const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
  const [message,setMessage]=useState("");const [listening,setListening]=useState(false);const [playing,setPlaying]=useState(false);const [pending,setPending]=useState(false);const [draft,setDraft]=useState("");const [final,setFinal]=useState(false);
  const [failed,setFailed]=useState({enhanced:false,tts:false,stt:false});const recognition=useRef<BrowserRecognition|null>(null);const stopSpeech=useRef<(()=>void)|null>(null);const alive=useRef(true);const attempt=useRef("");const recorder=useRef<MediaRecorder|null>(null);const media=useRef<MediaStream|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const canceled=useRef(false);const autoPlayed=useRef(false);
  const routes=resolveVoice(cap,settings,enhancedAvailable,failed);
  useEffect(()=>{
    alive.current=true;
    const update=()=>{setCap(c=>({...detectCapabilities(),microphone:c.microphone}));setVoices(window.speechSynthesis?.getVoices().filter(v=>/^en/i.test(v.lang))??[]);};update();
    // Browser-only storage must be read after SSR hydration, never in the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try{const parsed=voiceSettingsSchema.safeParse(JSON.parse(localStorage.getItem(settingsKey)??"{}"));if(parsed.success)setSettings(parsed.data);}catch{}
    window.speechSynthesis?.addEventListener("voiceschanged",update);
    let permission:PermissionStatus|undefined;
    void navigator.permissions?.query({name:"microphone" as PermissionName}).then(p=>{if(!alive.current)return;permission=p;const changed=()=>setCap(c=>({...c,microphone:p.state}));changed();p.onchange=changed;}).catch(()=>{});
    return()=>{alive.current=false;recognition.current?.cancel();stopSpeech.current?.();canceled.current=true;if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==="recording")recorder.current.stop();media.current?.getTracks().forEach(t=>t.stop());window.speechSynthesis?.removeEventListener("voiceschanged",update);if(permission)permission.onchange=null;};
  },[]);
  function configure(patch:Partial<VoiceSettings>){const next=voiceSettingsSchema.parse({...settings,...patch});setSettings(next);try{localStorage.setItem(settingsKey,JSON.stringify(next));window.dispatchEvent(new Event("voice-preferences"));}catch{} }
  function stop(){stopSpeech.current?.();setPlaying(false);}
  async function play(){
    stop();setMessage("");setPlaying(true);
    const native=()=>{
      if(!cap.tts||failed.tts){setMessage("Audio is unavailable. Choose Read instead to continue.");setPlaying(false);return;}
      stopSpeech.current=speakBrowser(speechText??"",speed*settings.rate,settings.voice,()=>{if(alive.current){setPlaying(false);void played();}},()=>{if(alive.current){setPlaying(false);setFailed(f=>({...f,tts:true}));setMessage("Audio could not play. Choose Read instead.");}});
    };
    if(routes.tts!=="openai"){native();return;}
    try{const response=await request({action:"tts"});const url=URL.createObjectURL(await response.blob());if(!alive.current){URL.revokeObjectURL(url);return;}const audio=new Audio(url);audio.playbackRate=Math.min(1.25,Math.max(.7,speed*settings.rate));stopSpeech.current=()=>{audio.pause();URL.revokeObjectURL(url);};audio.onended=()=>{URL.revokeObjectURL(url);if(alive.current){setPlaying(false);if(!enhancedRecordsReplay)void played();}};audio.onerror=()=>{URL.revokeObjectURL(url);if(alive.current){setFailed(f=>({...f,enhanced:true}));setMessage("Enhanced voice is unavailable. Using browser voice.");native();}};await audio.play();}
    catch{if(alive.current){setFailed(f=>({...f,enhanced:true}));setMessage("Enhanced voice is unavailable. Using browser voice; your session is saved.");native();}}
  }
  // Autoplay is off by default. Persisted opt-in still respects browser gesture restrictions.
  useEffect(()=>{if(settings.autoplay&&speechText&&cap.tts&&!autoPlayed.current){autoPlayed.current=true;void play();}},[settings.autoplay,speechText,cap.tts]); // eslint-disable-line react-hooks/exhaustive-deps
  function nativeRecord(){
    const Factory=recognitionConstructor();if(!Factory)return;recognition.current?.cancel();attempt.current=crypto.randomUUID();setDraft("");setFinal(false);setListening(true);
    const r=new BrowserRecognition(Factory,{result:(text,isFinal)=>{setDraft(text);setFinal(isFinal);},error:(msg,code)=>{setMessage(msg);setListening(false);if(code==="not-allowed"||code==="service-not-allowed")setCap(c=>({...c,microphone:"denied"}));},end:()=>setListening(false)});recognition.current=r;
    try{r.start();}catch{r.cancel();setListening(false);setFailed(f=>({...f,stt:true}));setMessage("Speech recognition could not start. Type your response to continue.");}
  }
  async function record(){
    stop();setMessage("");if(routes.stt==="browser_native"){nativeRecord();return;}if(routes.stt!=="openai")return;
    canceled.current=false;
    try{media.current=await navigator.mediaDevices.getUserMedia({audio:true});if(!alive.current){media.current.getTracks().forEach(t=>t.stop());return;}const r=new MediaRecorder(media.current);recorder.current=r;const chunks:BlobPart[]=[];r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};r.onstop=async()=>{if(timer.current)clearTimeout(timer.current);media.current?.getTracks().forEach(t=>t.stop());if(canceled.current||!alive.current)return;setListening(false);setPending(true);try{const form=new FormData();form.set("audio",new Blob(chunks,{type:r.mimeType}),`response.${r.mimeType.includes("mp4")?"mp4":"webm"}`);const result=await(await request(form)).json();if(alive.current)confirmed(result.voiceId,result.transcript);}catch{if(alive.current){setFailed(f=>({...f,enhanced:true}));setMessage("Enhanced recognition is unavailable. Retry with browser speech or type; your session is saved.");}}finally{if(alive.current)setPending(false);}};r.start();setListening(true);timer.current=setTimeout(()=>{if(r.state==="recording")r.stop();},45000);}catch{media.current?.getTracks().forEach(t=>t.stop());setFailed(f=>({...f,enhanced:true}));setMessage("Enhanced recording is unavailable. Retry with browser speech or type.");}
  }
  function cancel(){canceled.current=true;recognition.current?.cancel();if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==="recording")recorder.current.stop();media.current?.getTracks().forEach(t=>t.stop());setListening(false);setDraft("");setFinal(false);}
  async function confirm(){setPending(true);try{const value=await(await request({action:"browser_voice",attemptId:attempt.current,text:draft})).json();confirmed(value.voiceId,value.transcript);setDraft("");setFinal(false);}catch{setMessage("Could not save the transcript. Retry confirmation or type instead.");}finally{if(alive.current)setPending(false);}}
  return <div className="support" data-voice-state={capabilityState(cap)}>
    <p>{t("ui.119")}{cap.stt?t("ui.120"):t("ui.121")} {cap.microphone==="denied"?t("ui.122"):""}</p>
    <p className="muted">{t("ui.123")}</p>
    {speechText&&<><button disabled={pending||listening} onClick={play}>{t("ui.124")}</button><button disabled={!playing} onClick={stop}>{t("ui.125")}</button></>}
    {spoken&&<><button disabled={pending||routes.stt==="typed_fallback"||listening} onClick={record}>{failed.enhanced?t("ui.126"):t("ui.127")}</button>{listening&&<><button onClick={()=>{if(recorder.current?.state==="recording")recorder.current.stop();else recognition.current?.stop();}}>{t("ui.128")}</button><button onClick={cancel}>{t("ui.129")}</button><p role="status">{t("ui.130")}</p></>}{draft&&<><p aria-live="polite">{final?t("ui.131"):t("ui.132")}: {draft}</p><button disabled={!final||listening||pending} onClick={confirm}>{t("ui.133")}</button><button onClick={cancel}>{t("ui.134")}</button></>}</>}
    {message&&<p role="status">{t(message)}</p>}
    <details><summary>{t("ui.135")}</summary><label>{t("ui.136")}<select value={settings.input} onChange={e=>{cancel();configure({input:e.target.value as VoiceSettings["input"]});}}><option value="speaking">{t("ui.137")}</option><option value="typing">{t("ui.138")}</option></select></label><label>{t("ui.139")}<select value={settings.voice} onChange={e=>configure({voice:e.target.value})}><option value="">{t("ui.140")}</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label>{!cap.englishVoice&&<p>{t("ui.141")}</p>}<label>{t("ui.142")}<input type="range" min="0.7" max="1.25" step="0.05" value={settings.rate} onChange={e=>configure({rate:Number(e.target.value)})}/></label><label><input type="checkbox" checked={settings.autoplay} onChange={e=>configure({autoplay:e.target.checked})}/>{t("ui.143")}</label>{enhancedAvailable&&<label><input type="checkbox" checked={settings.enhanced} onChange={e=>configure({enhanced:e.target.checked})}/>{t("ui.144")}</label>}<label>{t("ui.145")}<select value={settings.transcript} onChange={e=>configure({transcript:e.target.value as VoiceSettings["transcript"]})}><option value="on_request">{t("ui.146")}</option><option value="after_attempt">{t("ui.147")}</option><option value="automatic">{t("ui.148")}</option></select></label><p>{t("ui.149")}</p></details>
  </div>;
}
