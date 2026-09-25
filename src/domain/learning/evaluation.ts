import { evaluationSchema, type Dimension, type Modality } from "../assessment/contracts";
import type { Task } from "./types";
import { evaluateBounded } from "./bounded";
export function responseTarget(task:Task,voice:boolean,transcript:boolean):{skill:Dimension;modality:Modality}{
  if(task.modality==="listening_recognition"&&transcript)return {skill:"reading",modality:"reading_recognition"};
  if(task.spoken&&!voice)return {skill:"written_expression",modality:"written_production"};
  return {skill:task.skill,modality:task.modality};
}
export function scoreLearning(task:Task,text:string,evaluation:unknown,voice:boolean,transcript:boolean,support:number,skip:boolean){
  const target=responseTarget(task,voice,transcript);
  if(skip)return {...target,quality:null,confidence:0,errors:[] as string[],support};
  if(task.strategy==="exact"){
    const normalize=(s:string)=>s.trim().toLowerCase().replace(/[.,!?]/g,"").replace(/\s+/g," ");
    const quality=normalize(text)===normalize(task.answer??"")?4:0;
    return {...target,quality,confidence:3,errors:quality===0?["target_expression"]:[],support};
  }
  if(task.criteria)return {...target,...evaluateBounded(text,task.criteria),support};
  if(!evaluation)return {...target,quality:null,confidence:0,errors:[] as string[],support};
  const result=evaluationSchema.parse(evaluation);
  const observation=result.recommended_evidence.find(e=>e.skill===target.skill);
  // Global communication success alone cannot establish an unobserved target skill.
  const quality=observation&&result.evaluator_confidence>0?Math.min(result.communicative_success,observation.quality):null;
  return {...target,quality,confidence:quality===null?0:result.evaluator_confidence,errors:result.likely_error_categories,support:Math.max(support,result.support_required)};
}
