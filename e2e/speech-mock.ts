import type { Page } from "@playwright/test";
export async function speechMock(page:Page,stt=true){
  // Only test browser APIs are replaced. The real server, evaluator and DB remain in use.
  await page.addInitScript(({stt})=>{
    class Utterance {text:string;onend:(()=>void)|null=null;onerror:(()=>void)|null=null;constructor(text:string){this.text=text;}}
    Object.defineProperty(window,"SpeechSynthesisUtterance",{configurable:true,value:Utterance});
    Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{getVoices:()=>[{voiceURI:"test-en",name:"Test English",lang:"en-US"}],cancel(){},speak(u:Utterance){setTimeout(()=>u.onend?.(),30);},addEventListener(){},removeEventListener(){}}});
    class Recognition {lang="";continuous=false;interimResults=true;onresult:((e:unknown)=>void)|null=null;onerror:((e:unknown)=>void)|null=null;onend:(()=>void)|null=null;start(){setTimeout(()=>{this.onresult?.({resultIndex:0,results:[{isFinal:true,length:1,0:{transcript:"Water please"}}]});this.onend?.();},40);}stop(){this.onend?.();}abort(){}}
    Object.defineProperty(window,"SpeechRecognition",{configurable:true,value:stt?Recognition:undefined});Object.defineProperty(window,"webkitSpeechRecognition",{configurable:true,value:undefined});
  },{stt});
}
