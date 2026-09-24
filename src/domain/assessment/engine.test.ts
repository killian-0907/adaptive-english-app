import { describe, expect, it } from "vitest";
import { initialState, type Answer, type Evaluation, type Observation, type Turn } from "./contracts";
import { advance, initialModel, languageSupport, nextItem } from "./engine";
import { getItem } from "./items";
import { scoreResponse } from "./evidence";

const turn = (itemId:string,quality:number|null,support=0):Turn => ({itemId,quality,support,difficulty:getItem(itemId).difficulty,observations:[]});
const answer = (text:string):Answer => ({activityId:"00000000-0000-4000-8000-000000000001",text,voiceId:null,skip:false,dontKnow:false,fatigue:false,support:{hints:0,replays:0,retries:0,translation:false,transcript:false}});
const evaluation:Evaluation = {communicative_success:4,comprehension_success:4,meaning_accuracy:4,sentence_quality:4,vocabulary_retrieval:4,grammar_observations:[],likely_error_categories:[],support_required:0,evaluator_confidence:2,recommended_evidence:[{skill:"spoken_expression",quality:4},{skill:"grammar",quality:3},{skill:"intelligibility",quality:4}]};
describe("assessment branching",()=>{
  it("includes the reading passage but keeps listening text out of the visible question",()=>{expect(getItem("reading-1").prompt).toContain("Closed on Sunday");expect(getItem("reading-5").prompt).toContain("absence of evidence");expect(getItem("listening-1").prompt).not.toContain("The bus leaves at nine");});
  it("starts at true beginner listening, without a self-selected level",()=>{expect(nextItem(initialState())?.id).toBe("listening-0");});
  it("raises difficulty rapidly after independent successes",()=>{const s=advance(advance(initialState(),turn("listening-0",4)),turn("spoken-0",4));expect(s.difficulty).toBe(2);expect(nextItem(s)?.difficulty).toBe(2);});
  it("lowers difficulty immediately on breakdown",()=>{expect(advance({...initialState(),difficulty:4},turn("spoken-4",0)).difficulty).toBe(3);});
  it("does not increase difficulty when success needed help",()=>{expect(advance(advance(initialState(),turn("listening-0",4,2)),turn("spoken-0",4,1)).difficulty).toBe(0);});
  it("keeps mixed performance nearby",()=>{const s=advance({...initialState(),difficulty:2},turn("reading-2",2));expect(s.difficulty).toBe(2);});
  it("finishes a zero beginner without paragraphs or long conversation",()=>{let s=initialState();for(const id of ["listening-0","spoken-0","practical-0","recognition-0"])s=advance(s,turn(id,0));expect(s.reason).toBe("beginner_floor");expect(nextItem(s)).toBeNull();});
  it("takes a strong learner through advanced tasks in fewer than fourteen turns",()=>{let s=initialState();while(!s.complete){const i=nextItem(s)!;s=advance(s,turn(i.id,4));}expect(s.reason).toBe("strong_fast_path");expect(s.turns.length).toBeLessThan(14);expect(s.turns.filter(t=>t.difficulty===0)).toHaveLength(2);});
  it("bounds missing evidence and permits fatigue",()=>{let s=initialState();while(!s.complete){s=advance(s,turn(nextItem(s)!.id,null));}expect(s.turns).toHaveLength(14);const a=advance(initialState(),turn("listening-0",2));expect(advance(a,turn("spoken-0",null),true).reason).toBe("fatigue");});
  it("resumes deterministically and ignores duplicate responses",()=>{const s=advance(initialState(),turn("listening-0",4));expect(nextItem(JSON.parse(JSON.stringify(s)))).toEqual(nextItem(s));expect(advance(s,turn("listening-0",0))).toEqual(s);});
  it("selects comprehensible language support",()=>{expect(languageSupport(0)).toBe("native_supported");expect(languageSupport(3)).toBe("english_with_fallback");expect(languageSupport(5)).toBe("mostly_english");expect(languageSupport(5,true)).toBe("native_supported");});
});
describe("conservative evidence and estimates",()=>{
  it("scores fixed responses without an evaluator",()=>{const r=scoreResponse(getItem("listening-0"),answer("Hello"),null,false);expect(r.turn.quality).toBe(4);expect(r.turn.observations.map(o=>o.skill)).toEqual(["listening"]);});
  it("never converts recognition into production",()=>{const r=scoreResponse(getItem("recognition-0"),answer("Yes"),null,false);expect(r.turn.observations[0].modality).toBe("reading_recognition");expect(initialModel(r.turn.observations).some(x=>x.dimension==="spoken_expression")).toBe(false);});
  it("typed fallback creates writing evidence, never spoken or pronunciation evidence",()=>{const r=scoreResponse(getItem("spoken-2"),answer("I walk to work."),evaluation,false);expect(r.turn.observations.some(o=>o.skill==="written_expression")).toBe(true);expect(r.turn.observations.some(o=>o.skill==="spoken_expression"||o.skill==="intelligibility")).toBe(false);expect(r.turn.observations.every(o=>o.modality==="written_production")).toBe(true);});
  it("explicit incomprehension simplifies without fabricating a failed performance",()=>{const a=answer("");a.skip=true;a.dontKnow=true;const r=scoreResponse(getItem("spoken-0"),a,null,false);expect(r.turn.quality).toBe(0);expect(r.turn.observations).toHaveLength(0);expect(r.events.some(e=>e.evidence_kind==="task_misunderstanding")).toBe(true);});
  it("transcript reveal invalidates pure listening inference",()=>{const a=answer("Hello");a.support.transcript=true;expect(scoreResponse(getItem("listening-0"),a,null,false).turn.observations).toEqual([]);});
  it("missing speech is neutral and not a failure",()=>{const a=answer("");a.skip=true;const r=scoreResponse(getItem("spoken-0"),a,null,false);expect(r.turn.quality).toBeNull();expect(r.events.some(e=>e.evidence_kind==="voice_uncertainty")).toBe(true);});
  it("one success is tentative; support and inconsistency limit confidence",()=>{const o:Observation={itemId:"spoken-2",skill:"spoken_expression",modality:"spoken_production",quality:4,difficulty:2,support:0,confidence:2,knowledge:"greeting",errors:[]};expect(initialModel([o])[0].confidence_level).toBe(1);expect(initialModel([o,{...o,itemId:"b"},{...o,itemId:"c"}])[0].confidence_level).toBe(2);expect(initialModel([o,{...o,difficulty:5},{...o,support:3}])[0].confidence_level).toBe(1);});
});
