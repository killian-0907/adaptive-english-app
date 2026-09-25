import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { speechMock } from "./speech-mock";

test("new learner onboarding, deterministic evidence, resume, completion and secure results",async({page})=>{
  test.setTimeout(60000);
  await speechMock(page);
  page.on("pageerror",error=>console.error("Browser error:",error.message));
  page.on("requestfailed",request=>console.error("Failed browser request:",new URL(request.url()).pathname,request.failure()?.errorText));
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const email=`assessment-${Date.now()}@example.test`;const password="AssessmentTest123!";let userId:string|undefined;
  try{
    await page.goto("/login");
    const signup=page.getByRole("heading",{name:"Create test account"}).locator("..");
    await signup.getByPlaceholder("Email").fill(email);await signup.getByPlaceholder("Password").fill(password);await signup.getByRole("button",{name:"Sign up"}).click();
    await expect(page).toHaveURL(/message=/);
    const users=await admin.auth.admin.listUsers({perPage:1000});userId=users.data.users.find(u=>u.email===email)!.id;
    await page.setViewportSize({width:390,height:844});
    await page.goto("/assessment");await page.locator('select[name="interfaceLanguage"]').selectOption("en");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:"test-results/onboarding-mobile.png",fullPage:true});
    await page.getByLabel("Work",{exact:true}).check();await page.locator('input[name="liked"][value="conversation"]').check();await page.locator('input[name="disliked"][value="writing"]').check();
    await page.getByRole("button",{name:"Start assessment",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Which greeting did you hear?"})).toBeVisible();
    await page.getByRole("button",{name:"Play / replay prompt",exact:true}).click();
    await page.getByLabel("Hello",{exact:true}).check();
    const response=page.waitForResponse(r=>r.url().endsWith("/api/assessment")&&r.request().method()==="POST"&&!!r.request().postData()?.includes('"action":"answer"'));
    await page.getByRole("button",{name:"Continue",exact:true}).click();const submitted=(await response).request().postDataJSON();
    await expect(page.getByRole("heading",{name:"Say hello. One word is enough."})).toBeVisible();
    await page.reload();await expect(page.getByRole("heading",{name:"Say hello. One word is enough."})).toBeVisible();
    const forged=await page.request.post("/api/assessment",{headers:{origin:"http://127.0.0.1:3000"},data:{...submitted,data:{...submitted.data,user_id:userId,confidence:3}}});expect(forged.status()).toBe(400);
    const replay=await page.request.post("/api/assessment",{headers:{origin:"http://127.0.0.1:3000"},data:submitted});expect(replay.ok()).toBe(true);
    // Resume a confirmed browser transcript. Free open-ended assessment remains unassessed.
    await page.getByRole("button",{name:"Record response",exact:true}).click();
    await page.getByRole("button",{name:"Confirm recognized text",exact:true}).click();
    await expect(page.getByText("Water please",{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByText("Water please",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Continue",exact:true}).click();
    await page.getByRole("button",{name:"I'm tired · finish for now",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Ready to begin"})).toBeVisible();
    const profile=await admin.from("profiles").select("onboarding_status").eq("user_id",userId).single();expect(profile.data?.onboarding_status).toBe("completed");
    const goals=await admin.from("learning_goals").select("goal_type").eq("user_id",userId);expect(goals.data?.map(g=>g.goal_type)).toContain("work");
    const prefs=await admin.from("learning_preferences").select("target_key,strength").eq("user_id",userId);expect(prefs.data).toEqual(expect.arrayContaining([expect.objectContaining({target_key:"conversation",strength:1}),expect.objectContaining({target_key:"writing",strength:-1})]));
    const evidence=await admin.from("evidence_events").select("id").eq("user_id",userId).eq("evidence_kind","listening_recognition_performance");expect(evidence.data).toHaveLength(1);
    const model=await admin.from("learner_ability_estimates").select("dimension,confidence_level").eq("user_id",userId);expect(model.data).toEqual([{dimension:"listening",confidence_level:1}]);
    await page.reload();await expect(page.getByRole("heading",{name:"Ready to begin"})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:"test-results/results-mobile.png",fullPage:true});
  }finally{if(userId)await admin.auth.admin.deleteUser(userId);}
});
