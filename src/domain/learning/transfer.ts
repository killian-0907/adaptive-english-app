import type { Decision, Snapshot, Task } from "./types";

export function transferResult(s:Snapshot,task:Task,decision:Decision,quality:number|null,support:number,confidence:number,uncertain:boolean,retries:number):boolean|null {
  if(decision.purpose!=="transfer"||quality===null||support>0||confidence<2||uncertain||retries>0)return null;
  if(task.scenario){
    const comparable=s.evidence.filter(e=>e.metadata.topic===task.topic);
    if(comparable.some(e=>e.metadata.scenarioFamily===task.scenario!.family))return null;
    if(!comparable.some(e=>e.metadata.scenarioFamily&&e.response_quality!==null&&e.response_quality>=3&&!e.voice_uncertainty&&e.evaluator_confidence_level>=2))return null;
  }else if(s.evidence.some(e=>e.metadata.taskKey===task.key&&e.transfer_success!==null))return null;
  return quality>=3;
}
