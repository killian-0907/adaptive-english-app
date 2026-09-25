import { noCapabilities, type Capabilities } from "@/domain/voice/routing";

export type RecognitionResult = { isFinal: boolean; length: number; [index: number]: { transcript: string } };
export interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: {resultIndex: number; results: {length: number; [index: number]: RecognitionResult}}) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & {SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition};
export function recognitionConstructor() {
  if(typeof window === "undefined")return undefined;
  const w=window as SpeechWindow;return w.SpeechRecognition??w.webkitSpeechRecognition;
}
export function detectCapabilities(): Capabilities {
  if(typeof window === "undefined")return {...noCapabilities};
  return {...noCapabilities,tts:!!window.speechSynthesis && !!window.SpeechSynthesisUtterance,stt:!!recognitionConstructor(),englishVoice:window.speechSynthesis?.getVoices().some(v=>/^en(-|_)/i.test(v.lang))??false};
}
export const recognitionError = (code: string) => code==="not-allowed"||code==="service-not-allowed" ? "Microphone access was denied. You can type your response or change browser permissions." : code==="no-speech" ? "No speech was recognized. Try again or type; this is not an English mistake." : code==="audio-capture" ? "A microphone is unavailable. You can type instead." : "Speech recognition is unavailable right now. Retry or type; your session is saved.";

// Owns one recognition lifetime. Stop requests a final result; cancel discards it.
export class BrowserRecognition {
  private recognition: Recognition;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private canceled=false;
  private active=false;
  constructor(Factory: new()=>Recognition, callbacks:{result:(text:string,final:boolean)=>void;error:(message:string,code:string)=>void;end:()=>void}){
    this.recognition=new Factory();const r=this.recognition;r.lang="en-US";r.continuous=false;r.interimResults=true;
    r.onresult=e=>{if(this.canceled)return;let final="",interim="";for(let i=0;i<e.results.length;i++){const value=e.results[i][0].transcript;if(e.results[i].isFinal)final+=value+" ";else interim+=value+" ";}callbacks.result((final||interim).trim(),!!final.trim());};
    r.onerror=e=>{this.active=false;clearTimeout(this.timer);if(!this.canceled)callbacks.error(recognitionError(e.error),e.error);};
    r.onend=()=>{this.active=false;clearTimeout(this.timer);if(!this.canceled)callbacks.end();};
  }
  start(){this.active=true;this.recognition.start();this.timer=setTimeout(()=>this.stop(),45000);}
  stop(){clearTimeout(this.timer);if(this.active){this.active=false;this.recognition.stop();}}
  cancel(){this.canceled=true;this.active=false;clearTimeout(this.timer);this.recognition.onresult=null;this.recognition.onerror=null;this.recognition.onend=null;this.recognition.abort();}
}

export function speakBrowser(text:string,rate:number,voiceURI:string,onEnd:()=>void,onError:()=>void){
  const synth=window.speechSynthesis;synth.cancel();const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang="en-US";utterance.rate=Math.min(1.25,Math.max(.7,rate));
  utterance.voice=synth.getVoices().find(v=>v.voiceURI===voiceURI&&/^en/i.test(v.lang))??synth.getVoices().find(v=>/^en/i.test(v.lang))??null;
  utterance.onend=onEnd;utterance.onerror=onError;synth.speak(utterance);
  return ()=>{utterance.onend=null;utterance.onerror=null;synth.cancel();};
}
