import type { Decision, Snapshot, Task } from "./types";
import { makeTask } from "./engine";
import type { BoundedCriteria } from "./bounded";

type Turn = { partner: string; instruction: string; model: string; alternatives: string[]; function: string; zh: string; es: string };
export type Scenario = { key: string; title: string; goals: string[]; turns: Turn[] };
const turn = (partner: string, instruction: string, model: string, alternatives: string[], fn: string, zh: string, es: string): Turn => ({partner,instruction,model,alternatives,function:fn,zh,es});
export const scenarios: Scenario[] = [
  {key:"introductions",title:"Meet a neighbour",goals:["daily_communication"],turns:[
    turn("Hi, I'm Sam. What's your name?","Introduce yourself as Alex.","I'm Alex.",["My name is Alex","Alex","Hello I'm Alex","I am Alex"],"introduce","介绍自己：你叫 Alex。","Preséntate como Alex."),
    turn("Nice to meet you, Alex. Are you new here?","Say you are new here.","Yes, I'm new here.",["Yes I am","I'm new here","Yes","I am new here"],"confirm","说你是新来的。","Di que eres nuevo aquí.") ]},
  {key:"casual",title:"A short catch-up",goals:["daily_communication"],turns:[
    turn("How are you today?","Say you are doing well.","I'm good, thanks.",["Good thanks","I'm fine","Fine thanks","I am good"],"greet","说你今天很好。","Di que estás bien."),
    turn("That's good. Shall we have a coffee?","Accept the invitation.","Yes, please.",["Yes","Sure","Sounds good","I'd like that","Yes please thanks"],"accept","接受邀请。","Acepta la invitación.") ]},
  {key:"work",title:"Ask a coworker",goals:["work"],turns:[
    turn("What do you need for the meeting?","Ask for the report.","Could you send me the report, please?",["The report please","Can you send me the report","I need the report","Report please","Please send the report"],"polite_requests","礼貌地索要报告。","Pide el informe."),
    turn("Of course. Is Friday okay?","Confirm Friday works.","Friday works, thanks.",["Friday is fine","Yes Friday is fine","Yes thanks","Friday please","Yes"],"meeting_times","确认星期五可以。","Confirma que el viernes está bien.") ]},
  {key:"restaurant",title:"Order at a café",goals:["travel","daily_communication"],turns:[
    turn("Hello! What would you like to drink?","Order water politely.","Water, please.",["Could I have some water please","Can I have water please","I'd like water please","I would like water please","Please water"],"polite_requests","礼貌地要一杯水。","Pide agua con cortesía."),
    turn("Still water or sparkling water?","Choose still water.","Still water, please.",["Still please","Still water","Still","I'd like still water"],"choose","选择不含气的水。","Elige agua sin gas."),
    turn("Here you are. Anything else?","Say that is all and thank the server.","That's all, thank you.",["No thanks","No thank you","That is all thank you","Nothing else thanks"],"close","表示不需要别的，并感谢对方。","Di que no necesitas nada más y da las gracias.") ]},
  {key:"shopping",title:"Buy a shirt",goals:["daily_communication","travel"],turns:[
    turn("Can I help you?","Ask for a blue shirt.","A blue shirt, please.",["I'm looking for a blue shirt","I need a blue shirt","Blue shirt please","Could I have a blue shirt please"],"polite_requests","想买一件蓝色衬衫。","Pide una camisa azul."),
    turn("What size would you like?","Ask for medium.","Medium, please.",["Medium","Size medium","A medium please"],"choose","选择中号。","Pide la talla mediana.") ]},
  {key:"transportation",title:"Find your bus",goals:["travel"],turns:[
    turn("Where would you like to go?","Say you want to go to the station.","To the station, please.",["The station please","I want to go to the station","Station please","To the station"],"polite_requests","你要去车站。","Di que quieres ir a la estación."),
    turn("Take bus fifteen from stop B.","Ask the person to repeat that.","Could you say that again?",["Again please","Can you repeat that please","Please repeat that","Sorry could you repeat that"],"clarification","请对方重复一遍。","Pide que lo repitan.") ]},
  {key:"help",title:"Ask for help",goals:["daily_communication","school"],turns:[
    turn("You look lost. Can I help?","Ask where the library is.","Where is the library?",["Where's the library","Where is the library please","Could you tell me where the library is"],"ask_location","询问图书馆在哪里。","Pregunta dónde está la biblioteca."),
    turn("It's next to the post office.","Ask for repetition.","Could you say that again?",["Again please","Please repeat that","Can you say that again"],"clarification","请对方再说一次。","Pide que lo repitan.") ]},
  {key:"travel",title:"Check in at a hotel",goals:["travel"],turns:[
    turn("Welcome. How can I help you?","Ask to check in.","I'd like to check in, please.",["Check in please","I want to check in","I would like to check in please","Can I check in please"],"polite_requests","你想办理入住。","Pide hacer el registro de entrada."),
    turn("Certainly. Do you have a reservation?","Confirm you have a reservation.","Yes, I have a reservation.",["Yes","Yes I do","I have a reservation"],"confirm","确认你有预订。","Confirma que tienes una reserva.") ]},
  {key:"appointments",title:"Arrange an appointment",goals:["work","daily_communication"],turns:[
    turn("When would you like to come?","Ask for Friday.","Friday, please.",["On Friday please","Can I come on Friday","Could we meet on Friday","Friday"],"meeting_times","安排在星期五。","Pide una cita para el viernes."),
    turn("We have nine or ten in the morning.","Choose ten.","At ten, please.",["Ten please","Ten","At ten","Ten in the morning please"],"choose","选择上午十点。","Elige las diez de la mañana.") ]},
  {key:"phone",title:"A short phone call",goals:["work","daily_communication"],turns:[
    turn("Hello, this is Sam speaking.","Introduce yourself as Alex.","Hi, this is Alex.",["This is Alex","Hello I'm Alex","I'm Alex","Hello this is Alex"],"introduce","介绍自己是 Alex。","Preséntate como Alex."),
    turn("The line is a little quiet. I said Friday at ten.","Ask for repetition.","Could you say that again?",["Again please","Please repeat that","Sorry can you repeat that","Can you say that again"],"clarification","没听清，请对方重复。","Pide que lo repitan.") ]},
];
export type ScenarioProgress = { family: string; title: string; turn: number; total: number; run: string; function: string };
const repairTurns:Record<string,Turn>={
  restaurant:turn("So, sparkling water for you?","Correct the misunderstanding: you want still water.","No, still water, please.",["No I wanted still water","Not sparkling still water please","No still please"],"repair","纠正误解：你要不含气的水。","Corrige el error: quieres agua sin gas."),
  work:turn("You wanted the plan on Thursday, right?","Correct both details: the report, on Friday.","No, the report on Friday, please.",["The report on Friday please","No I need the report on Friday"],"repair","纠正两点：报告，星期五。","Corrige ambos detalles: el informe, el viernes."),
  shopping:turn("A large red shirt, right?","Correct both details: medium, blue.","No, medium and blue, please.",["No a medium blue shirt please","Medium blue please","A blue shirt in medium please"],"repair","纠正两点：中号，蓝色。","Corrige ambos detalles: mediana, azul."),
  appointments:turn("Nine in the evening, then?","Correct the time: ten in the morning.","No, ten in the morning, please.",["Ten in the morning please","No at ten in the morning"],"repair","纠正时间：上午十点。","Corrige la hora: las diez de la mañana."),
};

export function scenarioTask(scenario: Scenario, index: number, d: Decision, run: string): Task {
  const t = d.difficulty>=3&&index===1&&repairTurns[scenario.key] ? repairTurns[scenario.key] : scenario.turns[index];
  const listening = d.method === "listening";
  const spoken = ["speaking","conversation","role_play","transfer"].includes(d.method);
  const criteria: BoundedCriteria = {phrases:[t.model,...t.alternatives],maxWords:24,function:t.function};
  return {key:`scenario:${scenario.key}:${index}:${d.difficulty}`,topic:d.topic,
    prompt:`${scenario.title} · ${index+1}/${scenario.turns.length}. ${listening?"Listen, then choose the message you heard.":t.instruction+(d.difficulty>=3?" Respond naturally; ask for help if you need it.":" A short response is welcome.")}`,
    context:listening?t.model:t.partner,options:listening?[t.model,"Goodbye, maybe later.","I have a red bicycle."]:[],answer:listening?t.model:null,
    model:t.model,explanation:`Communicative function: ${t.function.replaceAll("_"," ")}. A useful expression is “${t.model}”`,native:listening?{en:"Listen and choose the message you heard.",zh:"听录音，然后选择听到的句子。",es:"Escucha y elige el mensaje que has oído."}:{en:t.instruction,zh:t.zh,es:t.es},
    skill:listening?"listening":spoken?"spoken_expression":"written_expression",modality:listening?"listening_recognition":spoken?"spoken_production":"written_production",strategy:listening?"exact":"local_bounded",audio:listening||spoken,spoken,variant:index,criteria,
    scenario:{family:scenario.key,title:scenario.title,turn:index,total:scenario.turns.length,run,function:t.function}};
}

export function planContent(s: Snapshot, decision: Decision): {decision:Decision;task:Task} {
  const current=s.history.filter(h=>h.session_id===s.sessionId);
  const last=current.at(-1);const progress=last?.metadata.task.scenario;
  let d={...decision, reasons:[...decision.reasons]};
  const practical=["conversation","role_play","speaking","listening","transfer","guided_writing"].includes(d.method);
  let scenario:Scenario|undefined;let index=0;let run=`${s.sessionId}:${current.length}`;
  // A short successful exchange can continue; explicit feedback and overload return control to the engine.
  if(progress && last?.status==="completed" && s.state==="normal" && (last.metadata.quality??0)>=3 && progress.turn+1<progress.total){
    scenario=scenarios.find(x=>x.key===progress.family);index=progress.turn+1;run=progress.run;
    d={...d,method:last.metadata.decision.method};d.reasons.push("continue_successful_bounded_exchange");
  } else if(progress && last?.status==="completed" && last.metadata.quality===null && !s.evidence.some(e=>e.activity_id===last.id&&e.metadata.skipped) && current.filter(h=>h.metadata.task.scenario?.run===progress.run && h.metadata.task.scenario.turn===progress.turn).length<2){
    scenario=scenarios.find(x=>x.key===progress.family);index=progress.turn;run=progress.run;
    d={...d,support:{...d.support,initial:Math.max(3,d.support.initial)}};d.reasons.push("bounded_repair_then_return_to_engine");
  }
  if(!scenario&&!practical)return {decision:d,task:makeTask(d,current.length)};
  if(!scenario){
    const recent=s.history.slice(-10).map(h=>h.metadata.task.scenario?.family);
    scenario=[...scenarios].sort((a,b)=>{
      const score=(x:Scenario)=> (x.goals.some(g=>s.goals.includes(g))?3:0)+(x.turns.some(t=>t.function===d.topic)?4:0)-(recent.filter(k=>k===x.key).length*3);
      return score(b)-score(a);
    })[0];
    index=Math.max(0,scenario.turns.findIndex(t=>t.function===d.topic));
  }
  const fn=d.difficulty>=3&&index===1&&repairTurns[scenario.key]?"repair":scenario.turns[index].function;
  // Keep the reusable function as the knowledge key across different scenarios.
  d={...d,topic:fn,objective:fn===d.topic?d.objective:`${scenario.title}: ${fn.replaceAll("_"," ")}`,scenario:scenario.key,listening:{...d.listening,transcript:false}};
  if(d.speaking.frame&&d.method!=="listening")d.support={...d.support,initial:Math.max(4,d.support.initial)};
  const task=scenarioTask(scenario,index,d,run);d.targetSkill=task.skill;
  return {decision:d,task};
}
