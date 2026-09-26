import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { LearningView } from "../src/server/services/learning";
const admin=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function fixture(page:Page){
  const db=admin();const email=`learning-${randomUUID()}@example.test`;const password=randomUUID();
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});if(created.error||!created.data.user)throw new Error("Test user setup failed");const user=created.data.user;
  // Assessed-user fixture. Assessment behavior has its own browser and database coverage.
  const session=await db.from("learning_sessions").insert({user_id:user.id,status:"completed",starting_state_summary:{purpose:"initial_assessment_v1"},session_summary:{complete:true,turns:[]},ending_state_summary:{model:[],support:"native_supported"}});expect(session.error).toBeNull();
  await db.from("profiles").update({onboarding_status:"completed",native_language:"en",interface_language:"en"}).eq("user_id",user.id);
  await db.from("learner_ability_estimates").insert({user_id:user.id,dimension:"vocabulary",estimate_level:0,confidence_level:1});
  await page.goto("/login");const form=page.getByRole("heading",{name:"Sign in",exact:true}).locator("..");await form.getByPlaceholder("Email").fill(email);await form.getByPlaceholder("Password").fill(password);await form.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/home$/);
  await page.goto("/learn");await page.getByRole("button",{name:"Start learning session",exact:true}).click();await expect(page.getByRole("heading",{name:"Make a polite request",exact:true})).toBeVisible();
  return {db,user,cleanup:async()=>{await db.auth.admin.deleteUser(user.id);}};
}
async function view(page:Page):Promise<LearningView>{const r=await page.request.get("/api/learning");expect(r.ok()).toBe(true);return r.json();}
async function post(page:Page,data:object){return page.request.post("/api/learning",{headers:{origin:"http://127.0.0.1:3000"},data});}
test("feedback stays in the mobile viewport after submitting from lower down the page",async({page})=>{
  await page.setViewportSize({width:390,height:600});
  const initial:LearningView={kind:"activity",activityId:randomUUID(),sessionId:randomUUID(),objective:"Make a polite request",method:"sentence building",prompt:"You are talking to a colleague. Ask politely for the report. Put the words in order: please / report / the / send / me",spoken:false,audio:false,voiceAllowed:false};
  const correction="Your message worked. Let's try another context.";
  await page.route("**/api/learning",async route=>{
    const command=route.request().postDataJSON();
    if(command?.action==="start"||command?.action==="answer")await route.fulfill({json:command.action==="start"?initial:{...initial,activityId:randomUUID(),correction,prompt:"Now make a polite request in another context."}});
    else await route.continue();
  });
  const f=await fixture(page);
  try{
    await page.getByLabel("Your response",{exact:true}).fill("Send me the report, please.");
    await page.getByRole("button",{name:"Check response",exact:true}).click();
    const feedback=page.getByRole("status").filter({hasText:correction});
    await expect(feedback).toBeInViewport();
    await expect(feedback).toBeFocused();
    await expect(page.getByRole("heading",{name:"Now make a polite request in another context."})).toBeVisible();
  }finally{await f.cleanup();}
});
test("A: assessed learner completes deterministic practice, updates model and resumes next decision",async({page})=>{
  const f=await fixture(page);try{
    await page.setViewportSize({width:390,height:844});const before=await view(page);expect(before.options?.length).toBeGreaterThan(0);
    await page.getByLabel("Water, please.",{exact:true}).check();await page.getByRole("button",{name:"Check response",exact:true}).click();await expect(page.getByText("Your message worked. Let's try another context.",{exact:true})).toBeVisible();await expect(page.getByText("Your message worked. Let's try another context.",{exact:true})).toBeInViewport();
    const after=await view(page);expect(after.activityId).not.toBe(before.activityId);expect(after.method).toBe("transfer");
    const events=await f.db.from("evidence_events").select("id,processor_status,modality").eq("activity_id",before.activityId);expect(events.data).toHaveLength(1);expect(events.data?.[0]).toMatchObject({processor_status:"applied",modality:"reading_recognition"});
    const changes=await f.db.from("learner_model_changes").select("id").eq("user_id",f.user.id).eq("model_version","learning-v1");expect(changes.data?.length).toBeGreaterThanOrEqual(2);
    const decisions=await f.db.from("teaching_decisions").select("id").eq("user_id",f.user.id);expect(decisions.data).toHaveLength(2);
    const replay=await post(page,{action:"answer",activityId:before.activityId,text:"Water, please.",voiceId:null,skip:false,elapsedMs:1000});expect(replay.ok()).toBe(true);expect((await f.db.from("evidence_events").select("id").eq("activity_id",before.activityId)).data).toHaveLength(1);
    const telemetry=await f.db.from("operational_events").select("properties").eq("activity_id",before.activityId).eq("event_name","adaptive_quality_activity");expect(telemetry.error).toBeNull();expect(telemetry.data).toHaveLength(1);expect(JSON.stringify(telemetry.data)).not.toContain("Water, please.");expect(telemetry.data?.[0].properties).toMatchObject({kind:"activity",support:0,quality:4,typedFallback:false});
    const forged=await post(page,{action:"answer",activityId:after.activityId,text:"Hello",voiceId:null,skip:false,elapsedMs:null,user_id:f.user.id,quality:4});expect(forged.status()).toBe(400);
    const csrf=await page.request.post("/api/learning",{headers:{origin:"https://wrong.example"},data:{action:"start"}});expect(csrf.status()).toBe(403);
    // Test-only unavailable-service response exercises the visible fallback without paid calls.
    await page.route("**/api/learning",async route=>{if(route.request().method()==="POST"&&route.request().postDataJSON()?.action==="answer")await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"The evaluation service is unavailable. Try a structured activity."})});else await route.continue();});
    await page.getByLabel("Your response",{exact:true}).fill("Water, please.");await page.getByRole("button",{name:"Check response",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"unavailable"})).toBeVisible();await page.unroute("**/api/learning");
    await page.getByRole("button",{name:"Try a structured activity",exact:true}).click();expect((await view(page)).objective).toBe(before.objective);await page.reload();expect((await view(page)).kind).toBe("activity");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"test-results/learning-mobile.png",fullPage:true});
    await page.getByRole("button",{name:"End session",exact:true}).click();await expect(page.getByRole("heading",{name:"Your session",exact:true})).toBeVisible();await expect(page.getByText("Water, please.",{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByRole("heading",{name:"Your session",exact:true})).toBeVisible();
  }finally{await f.cleanup();}
});
test("B: explicit method rejection changes format and preserves objective without rewriting effectiveness",async({page})=>{
  const f=await fixture(page);try{const before=await view(page);await page.getByRole("button",{name:"This method doesn’t work for me",exact:true}).click();await expect.poll(async()=> (await view(page)).method).not.toBe(before.method);const after=await view(page);expect(after.objective).toBe(before.objective);
    const prefs=await f.db.from("learning_preferences").select("target_key,strength").eq("user_id",f.user.id);expect(prefs.data).toContainEqual({target_key:"vocabulary_context",strength:-2});
    expect((await f.db.from("method_effectiveness").select("id").eq("user_id",f.user.id)).data).toHaveLength(0);
    expect((await f.db.from("user_feedback").select("id").eq("user_id",f.user.id)).data).toHaveLength(1);
  }finally{await f.cleanup();}
});
test("C: repeated struggle adds support; tired feedback changes session teaching without lowering ability",async({page})=>{
  const f=await fixture(page);try{
    const first=await view(page);expect((await post(page,{action:"answer",activityId:first.activityId,text:"That is a blue chair.",voiceId:null,skip:false,elapsedMs:45000})).ok()).toBe(true);
    let current=await view(page);if(!current.options?.length){expect((await post(page,{action:"feedback",activityId:current.activityId,kind:"provider_fallback"})).ok()).toBe(true);current=await view(page);}
    expect((await post(page,{action:"answer",activityId:current.activityId,text:"wrong",voiceId:null,skip:false,elapsedMs:45000})).ok()).toBe(true);
    current=await view(page);expect(current.support).toBeGreaterThanOrEqual(3);await page.reload();await expect(page.getByText(current.supportText!,{exact:true})).toBeVisible();
    const before=(await f.db.from("learner_ability_estimates").select("dimension,estimate_level").eq("user_id",f.user.id)).data;
    await page.getByText("More ways to adjust",{exact:true}).click();await page.getByRole("button",{name:"I’m tired",exact:true}).click();await expect.poll(async()=>(await view(page)).activityId).not.toBe(current.activityId);
    const state=await f.db.from("session_states").select("state_type").eq("user_id",f.user.id).is("ended_at",null);expect(state.data).toEqual([{state_type:"tired"}]);expect((await f.db.from("learner_ability_estimates").select("dimension,estimate_level").eq("user_id",f.user.id)).data).toEqual(before);
    await page.getByRole("button",{name:"Native-language help",exact:true}).click();expect((await view(page)).support).toBeGreaterThanOrEqual(5);
  }finally{await f.cleanup();}
});
