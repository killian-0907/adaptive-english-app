import type { Ability, History, Knowledge, Pattern } from "../learning/types";

export const skillLabels:Record<string,string>={listening:"Listening",spoken_expression:"Speaking",reading:"Reading",written_expression:"Writing",vocabulary:"Vocabulary",grammar:"Grammar",practical_communication:"Practical communication",conversational_response:"Conversation",spoken_fluency:"Fluency",intelligibility:"Intelligibility",pronunciation:"Pronunciation"};
export function entryRoute(onboarded:boolean,assessed:boolean){return !onboarded?"/onboarding":!assessed?"/assessment":"/home";}
export function progressCards(abilities:Ability[]){
  return ["listening","spoken_expression","reading","written_expression","vocabulary","grammar","practical_communication"].map(key=>{
    const a=abilities.find(x=>x.dimension===key);const uncertain=!a||a.confidence_level<2;
    return {key,label:skillLabels[key],stage:!a||!a.confidence_level?"Needs more evidence":a.confidence_level<2?"Early observations":a.estimate_level<=1?"Starting":a.estimate_level<=3?"Developing":a.estimate_level<=4?"Functional":"Strong",note:uncertain?`We're still learning about your ${skillLabels[key].toLowerCase()}.`:a.trend==="improving"?"Recent evidence suggests improvement.":a.trend==="declining"?"Some recent tasks need more support. We'll adjust the practice.":"Building on consistent observations.",uncertain};
  });
}
export function recognitionGaps(states:Knowledge[],labels:Map<string,string>){
  return states.filter(k=>k.modality.endsWith("recognition")&&["recognized","strong"].includes(k.state)&&k.confidence_level>=2&&!states.some(p=>p.knowledge_item_id===k.knowledge_item_id&&p.modality==="spoken_production"&&["independent","strong"].includes(p.state)&&p.confidence_level>=2)).slice(0,3).map(k=>`You recognize “${labels.get(k.knowledge_item_id)??"this expression"}” ${k.modality==="listening_recognition"?"when listening":"when reading"}. We're still gathering evidence about using it while speaking.`);
}
export type Change={id:string;changed_at:string;changed_entity_type:string;dimension:string|null;previous_value:unknown;new_value:unknown};
export function progressTimeline(changes:Change[]){
  return changes.flatMap(c=>{const old=(c.previous_value??{}) as Record<string,unknown>;const next=(c.new_value??{}) as Record<string,unknown>;
    if(c.changed_entity_type==="ability"&&Number(next.confidence_level)>=2&&typeof old.estimate_level==="number"&&Number(next.estimate_level)>old.estimate_level)return [{id:c.id,date:c.changed_at,text:`${skillLabels[c.dimension??""]??"A skill"}: recent evidence supports a stronger learning estimate.`}];
    if(c.changed_entity_type==="knowledge"&&["spoken_production","written_production"].includes(String(next.modality))&&["independent","strong"].includes(String(next.state))&&! ["independent","strong"].includes(String(old.state))&&Number(next.confidence_level)>=2)return [{id:c.id,date:c.changed_at,text:`Recent practice shows independent use of an expression ${next.modality==="spoken_production"?"while speaking":"in writing"}.`}];
    if(c.changed_entity_type==="pattern"&&next.status==="improving"&&old.status!=="improving")return [{id:c.id,date:c.changed_at,text:"A recurring difficulty is showing signs of improvement."}];
    return [];
  }).slice(0,6);
}
export function practiceNeeds(abilities:Ability[],patterns:Pattern[]){
  const result=abilities.filter(a=>a.confidence_level>=2&&a.estimate_level<=1).map(a=>`More supported ${skillLabels[a.dimension]?.toLowerCase()??"English"} practice.`);
  if(patterns.some(p=>p.confidence_level>=2&&p.status!=="improving"))result.push("Revisit a recurring difficulty in a useful conversation.");
  return result.slice(0,3);
}
export function sessionSummary(id:string,started:string,ended:string|null,history:History[]){
  const done=history.filter(h=>h.status==="completed");
  return {id,started,ended,count:done.length,focus:[...new Set(done.map(h=>h.metadata.decision.objective))].slice(0,4),scenarios:[...new Set(done.flatMap(h=>h.metadata.task.scenario?[h.metadata.task.scenario.title]:[]))],skills:[...new Set(done.map(h=>skillLabels[h.metadata.task.spoken?"spoken_expression":h.metadata.task.skill]??"English"))],expressions:[...new Set(done.map(h=>h.metadata.task.model))].slice(-4),next:done.at(-1)?.metadata.decision.returnRule??"Continue with a short, useful exchange.",note:done.length?`${done.length} activities practised. Practice is not the same as demonstrated mastery.`:"No completed activities were recorded in this session."};
}
