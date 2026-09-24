import { expect,it } from "vitest";
import { voiceObservations } from "./observations";
it("does not infer pronunciation weakness from missing or uncertain STT",()=>{expect(voiceObservations({text:""})).toEqual([]);expect(voiceObservations({text:"Hello",segments:[{start:0,end:1,text:"Hello",avg_logprob:-2,no_speech_prob:0.8}]})).toEqual([]);});
it("collects conservative timing and recoverability without scores",()=>{const results=voiceObservations({text:"I would like to meet you tomorrow at ten",duration:8,segments:[{start:0,end:7,text:"I would like to meet you tomorrow at ten",avg_logprob:-0.3,no_speech_prob:0.1}]});expect(results.map(o=>o.skill)).toEqual(["intelligibility","spoken_fluency"]);expect(results.every(o=>o.metadata.uncertain)).toBe(true);});
