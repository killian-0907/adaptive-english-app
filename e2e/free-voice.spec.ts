import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { LearningView } from "../src/server/services/learning";

import { speechMock } from "./speech-mock";
async function current(page:Page):Promise<LearningView>{const response=await page.request.get("/api/learning");expect(response.ok()).toBe(true);return response.json();}
async function fixture(page:Page,method="conversation"){
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);const email=`voice-${randomUUID()}@example.test`;const password=randomUUID();
  const result=await db.auth.admin.createUser({email,password,email_confirm:true});if(result.error||!result.data.user)throw Error("Fixture failed");const user=result.data.user;
  const setup=await Promise.all([
    db.from("learning_sessions").insert({user_id:user.id,status:"completed",starting_state_summary:{purpose:"initial_assessment_v1"},session_summary:{complete:true,turns:[]}}),
    db.from("profiles").update({onboarding_status:"completed",native_language:"en",interface_language:"en"}).eq("user_id",user.id),
    db.from("learning_preferences").insert({user_id:user.id,preference_type:"method",target_key:method,strength:2,confidence_level:3,source:"explicit_feedback"}),
    db.from("learning_goals").insert({user_id:user.id,goal_type:"daily_communication"}),
  ]);for(const r of setup)expect(r.error).toBeNull();
  await page.goto("/login");const form=page.getByRole("heading",{name:"Sign in",exact:true}).locator("..");await form.getByPlaceholder("Email").fill(email);await form.getByPlaceholder("Password").fill(password);await form.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/home$/);
  await page.goto("/learn");await page.getByRole("button",{name:"Start learning session",exact:true}).click();await expect(page.getByRole("button",{name:"Play / replay prompt",exact:true})).toBeVisible();
  return {db,user,cleanup:()=>db.auth.admin.deleteUser(user.id)};
}
async function play(page:Page){await page.getByRole("button",{name:"Play / replay prompt",exact:true}).click();await expect.poll(async()=>{const r=await current(page);return r.activityId;}).toBeTruthy();await expect(page.getByRole("button",{name:"Stop audio",exact:true})).toBeDisabled();}

test("free A: browser listening and spoken transcript persist cautious evidence and continue",async({page})=>{
  await speechMock(page);let enhancedCalls=0;page.on("request",r=>{if(r.url().endsWith("/api/learning")&&r.postData()?.includes('"action":"tts"'))enhancedCalls++;});const f=await fixture(page);
  try{const before=await current(page);expect(before.scenario?.family).toBe("restaurant");await play(page);await page.getByRole("button",{name:"Record response",exact:true}).click();await expect(page.getByRole("button",{name:"Confirm recognized text",exact:true})).toBeEnabled();await page.getByRole("button",{name:"Confirm recognized text",exact:true}).click();await expect(page.getByText("Recorded response ready.",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Check response",exact:true}).click();await expect.poll(async()=>(await current(page)).scenario?.turn).toBe(1);
    const events=await f.db.from("evidence_events").select("modality,voice_uncertainty,evaluator_confidence_level,metadata,processor_status").eq("activity_id",before.activityId).eq("evidence_kind","learning_performance");expect(events.data).toHaveLength(1);expect(events.data![0]).toMatchObject({modality:"spoken_production",voice_uncertainty:true,evaluator_confidence_level:1,processor_status:"applied",metadata:{voiceProvider:"browser_native",evaluationStrategy:"LOCAL_BOUNDED"}});
    const receipt=await f.db.from("voice_interactions").select("provider,recognition_status,audio_object_path,transcript").eq("activity_id",before.activityId);expect(receipt.data).toEqual([{provider:"browser_native",recognition_status:"client_confirmed_unverified",audio_object_path:null,transcript:"Water please"}]);expect(enhancedCalls).toBe(0);
  }finally{await f.cleanup();}
});
test("free B: unsupported recognition keeps typed fallback usable",async({page})=>{
  await speechMock(page,false);const f=await fixture(page);try{await expect(page.getByText(/Speech recognition is unavailable here/)).toBeVisible();await expect(page.getByRole("button",{name:"Record response",exact:true})).toBeDisabled();const before=await current(page);await page.getByRole("button",{name:"Read instead",exact:true}).click();await page.getByLabel("Your response",{exact:true}).fill("Water please");await page.getByRole("button",{name:"Check response",exact:true}).click();await expect.poll(async()=>(await current(page)).activityId).not.toBe(before.activityId);const events=await f.db.from("evidence_events").select("modality,support_level").eq("activity_id",before.activityId).eq("evidence_kind","learning_performance");expect(events.data![0]).toMatchObject({modality:"written_production",support_level:5});}finally{await f.cleanup();}
});
test("free C: optional enhanced quota failure falls back to browser TTS without losing session",async({page})=>{
  await speechMock(page);let calls=0;
  // Test-only capability response makes this case independent of a real API key.
  await page.route("**/api/learning",async route=>{
    if(route.request().method()==="POST"&&route.request().postDataJSON()?.action==="tts"){
      calls++;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Voice unavailable"})});
    }else{const response=await route.fetch();const data=await response.json();if(data.kind==="activity")data.enhancedAvailable=true;await route.fulfill({response,json:data});}
  });
  const f=await fixture(page);try{await page.getByText("Voice preferences",{exact:true}).click();await page.getByLabel(/Use optional enhanced voice/).check();const before=await current(page);await play(page);await expect(page.getByText(/Enhanced voice is unavailable. Using browser voice/)).toBeVisible();expect((await current(page)).activityId).toBe(before.activityId);expect(calls).toBe(1);await page.getByLabel("Your response",{exact:true}).fill("Water please");await page.getByRole("button",{name:"Check response",exact:true}).click();await expect.poll(async()=>(await current(page)).activityId).not.toBe(before.activityId);}finally{await f.cleanup();}
});
test("free D: completes a multi-turn café exchange and persists the next engine decision",async({page})=>{
  await speechMock(page);const f=await fixture(page);try{const ids:string[]=[];for(const [index,text] of ["Water please","Still water please","No thank you"].entries()){const before=await current(page);expect(before.scenario).toMatchObject({family:"restaurant",turn:index});ids.push(before.activityId!);await page.getByRole("button",{name:"Read instead",exact:true}).click();await page.getByLabel("Your response",{exact:true}).fill(text);await page.getByRole("button",{name:"Check response",exact:true}).click();await expect.poll(async()=>(await current(page)).activityId).not.toBe(before.activityId);}const next=await current(page);expect(ids).not.toContain(next.activityId);const decisions=await f.db.from("teaching_decisions").select("id").eq("user_id",f.user.id);expect(decisions.data).toHaveLength(4);const evidence=await f.db.from("evidence_events").select("response_quality").in("activity_id",ids).eq("evidence_kind","learning_performance");expect(evidence.data).toEqual([{response_quality:3},{response_quality:3},{response_quality:3}]);await page.getByRole("button",{name:"End session",exact:true}).click();await expect(page.getByText("Completed exchanges: Order at a café",{exact:true})).toBeVisible();}finally{await f.cleanup();}
});

test("free E: first-listen evidence stays separate from revealed-text success",async({page})=>{
  await speechMock(page);const f=await fixture(page,"listening");try{
    const first=await current(page);await play(page);await page.getByLabel("Water, please.",{exact:true}).check();await page.getByRole("button",{name:"Check response",exact:true}).click();await expect.poll(async()=>(await current(page)).activityId).not.toBe(first.activityId);
    const second=await current(page);await page.getByRole("button",{name:"Read instead",exact:true}).click();await page.getByLabel("Still water, please.",{exact:true}).check();await page.getByRole("button",{name:"Check response",exact:true}).click();await expect.poll(async()=>(await current(page)).activityId).not.toBe(second.activityId);
    const events=await f.db.from("evidence_events").select("activity_id,modality,support_level,metadata").in("activity_id",[first.activityId,second.activityId]).eq("evidence_kind","learning_performance");expect(events.data).toEqual(expect.arrayContaining([expect.objectContaining({activity_id:first.activityId,modality:"listening_recognition",support_level:0,metadata:expect.objectContaining({firstListen:true})}),expect.objectContaining({activity_id:second.activityId,modality:"reading_recognition",support_level:5,metadata:expect.objectContaining({firstListen:false})})]));
  }finally{await f.cleanup();}
});

test("free F: backgrounding stops native capture and playback without saving evidence",async({page})=>{
  await speechMock(page);
  await page.addInitScript(()=>{
    class PendingRecognition {lang='';continuous=false;interimResults=true;onresult=null;onerror=null;onend=null;start(){}stop(){}abort(){document.documentElement.dataset.captureCanceled='yes';}}
    Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:PendingRecognition});
  });
  const f=await fixture(page);try{
    await page.getByRole('button',{name:'Record response',exact:true}).click();await expect(page.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    await expect(page.getByRole('button',{name:'Stop recording',exact:true})).toHaveCount(0);await expect(page.locator('html')).toHaveAttribute('data-capture-canceled','yes');
    expect((await f.db.from('voice_interactions').select('id').eq('user_id',f.user.id)).data).toEqual([]);
    await page.getByRole('button',{name:'Record response',exact:true}).click();await expect(page.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel recording',exact:true}).click();
    const before=await current(page);await page.getByRole('button',{name:'Read instead',exact:true}).click();await page.getByLabel('Your response',{exact:true}).fill('Water please');await page.getByRole('button',{name:'Check response',exact:true}).click();await expect.poll(async()=>(await current(page)).activityId).not.toBe(before.activityId);
  }finally{await f.cleanup();}
});
