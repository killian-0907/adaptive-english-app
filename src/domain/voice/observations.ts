/** Timing and ASR recoverability are observations, not pronunciation/fluency scores. */
export function voiceObservations(result:{text:string;duration?:number;segments?:{start:number;end:number;text:string;avg_logprob:number;no_speech_prob:number}[]}) {
  const segments=result.segments ?? [];
  const reliable=segments.filter(s=>s.no_speech_prob<0.4 && s.avg_logprob>-0.8);
  const observations:{skill:"intelligibility"|"spoken_fluency";kind:string;metadata:Record<string,string|number|boolean>}[]=[];
  if(reliable.length) observations.push({skill:"intelligibility",kind:"asr_recoverability",metadata:{recovered_segments:reliable.length,total_segments:segments.length,uncertain:true,note:"Recognition is provider-dependent and not pronunciation scoring."}});
  const words=result.text.trim().split(/\s+/).length;
  if(result.duration && result.duration>=4 && words>=8 && reliable.length===segments.length && segments.length>0) {
    const gaps=segments.slice(1).map((s,i)=>Math.max(0,s.start-segments[i].end));
    observations.push({skill:"spoken_fluency",kind:"speech_timing",metadata:{duration_seconds:Math.round(result.duration),word_count:words,long_pauses:gaps.filter(g=>g>2).length,uncertain:true,note:"Timing includes planning and recording silence; no ability inference from one attempt."}});
  }
  return observations;
}
