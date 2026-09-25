import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { test, expect, type Page } from "@playwright/test";
import type { Database } from "../src/types/database.generated";
import { StripeTestProvider, type BillingProvider, type BillingSnapshot } from "../scripts/billing-provider";
import { removeBilling, synchronizeBilling } from "../scripts/billing-lifecycle";
async function fixture(page:Page) {
  const db=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const email=`billing-${randomUUID()}@example.test`,password=randomUUID();const created=await db.auth.admin.createUser({email,password,email_confirm:true});expect(created.error).toBeNull();const user=created.data.user!;
  await db.from("profiles").update({onboarding_status:"completed",interface_language:"en"}).eq("user_id",user.id);
  await db.from("learning_sessions").insert({user_id:user.id,status:"completed",starting_state_summary:{purpose:"initial_assessment_v1"}});
  await page.goto("/login");const form=page.getByRole("heading",{name:"Sign in",exact:true}).locator("..");await form.getByPlaceholder("Email").fill(email);await form.getByPlaceholder("Password").fill(password);await form.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/home$/);
  return {db,user,cleanup:()=>db.auth.admin.deleteUser(user.id)};
}
test("billing A: unconfigured checkout is honest; forged grants, foreign customer and CSRF denied",async({page})=>{
  const f=await fixture(page);try {
    await page.goto("/membership?checkout=returned");await expect(page.getByRole("heading",{name:"Your account: Free",exact:true})).toBeVisible();await expect(page.getByText("Pricing not configured yet",{exact:false})).toBeVisible();await expect(page.getByRole("button",{name:"Open test checkout",exact:false})).toHaveCount(0);
    const headers={origin:"http://127.0.0.1:3000"};
    for(const data of [{action:"checkout",interval:"month",amount:1},{action:"portal",customer:"cus_other"},{action:"checkout",interval:"month",status:"active"}])expect((await page.request.post("/api/billing",{headers,data})).status()).toBe(400);
    expect((await page.request.post("/api/billing",{headers:{origin:"https://wrong.example"},data:{action:"portal"}})).status()).toBe(403);
    expect((await page.request.post("/api/billing",{headers,data:{action:"checkout",interval:"month"}})).status()).toBe(503);
    const forged=await page.request.post("/api/billing/webhook",{data:{id:"evt_forged",livemode:false,data:{object:{status:"active"}}}});expect([400,503]).toContain(forged.status());
    await page.reload();await expect(page.getByRole("heading",{name:"Your account: Free",exact:true})).toBeVisible();
    expect((await page.request.get("/api/cron/cleanup")).status()).toBe(401);expect((await page.request.get("/api/health")).status()).toBe(200);
  } finally {await f.cleanup();}
});
test("billing B: signed events through the production synchronizer grant/revoke delivery without learner changes",async({page})=>{
  const f=await fixture(page);const eventIds:string[]=[];
  const env={STRIPE_SECRET_KEY:"sk_test_fixture",STRIPE_WEBHOOK_SECRET:"whsec_fixture",STRIPE_PREMIUM_MONTHLY_PRICE_ID:"price_fixture"};const sdk=new Stripe(env.STRIPE_SECRET_KEY), verifier=new StripeTestProvider(env);const customer=`cus_${randomUUID().replaceAll("-","")}`;
  let snapshot:BillingSnapshot={reference:"sub_fixture",status:"active",start:new Date(Date.now()-1000).toISOString(),end:new Date(Date.now()+86400000).toISOString(),cancel:false};
  const provider:BillingProvider={prices:async()=>[],customer:async()=>customer,checkout:async()=>"",portal:async()=>"",snapshot:async()=>snapshot,remove:async()=>{},verify:verifier.verify.bind(verifier)};
  async function event(){const id=`evt_${randomUUID().replaceAll("-","")}`;eventIds.push(id);const payload=JSON.stringify({id,type:"customer.subscription.updated",livemode:false,data:{object:{customer}}});return verifier.verify(payload,sdk.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET}));}
  try {
    expect((await f.db.from("billing_customers").insert({user_id:f.user.id,customer_id:customer})).error).toBeNull();
    await f.db.from("learner_ability_estimates").insert({user_id:f.user.id,dimension:"reading",estimate_level:2,confidence_level:2,trend:"unknown"});
    const before=await f.db.from("learner_ability_estimates").select("*").eq("user_id",f.user.id);
    const first=await event();expect(await synchronizeBilling(f.db,first,provider)).toBe(true);expect(await synchronizeBilling(f.db,first,provider)).toBe(false);
    await page.goto("/membership");await expect(page.getByRole("heading",{name:"Your account: Premium",exact:true})).toBeVisible();await page.goto("/home");await expect(page.getByRole("complementary",{name:"Ad space"})).toHaveCount(0);
    snapshot={...snapshot,cancel:true};await synchronizeBilling(f.db,await event(),provider);await page.goto("/settings");await expect(page.getByText("Canceled: access ends on",{exact:false})).toBeVisible();await page.goto("/membership");await expect(page.getByRole("heading",{name:"Your account: Premium",exact:true})).toBeVisible();
    snapshot={...snapshot,status:"expired",end:new Date().toISOString()};await synchronizeBilling(f.db,await event(),provider);await page.reload();await expect(page.getByRole("heading",{name:"Your account: Free",exact:true})).toBeVisible();
    snapshot={...snapshot,status:"payment_issue"};await synchronizeBilling(f.db,await event(),provider);await page.reload();await expect(page.getByRole("heading",{name:"Your account: Free",exact:true})).toBeVisible();
    expect((await f.db.from("learner_ability_estimates").select("*").eq("user_id",f.user.id)).data).toEqual(before.data);
    await page.goto("/learn");await expect(page.getByRole("button",{name:"Start learning session",exact:true})).toBeVisible();
  } finally {await f.cleanup();if(eventIds.length)await f.db.from("billing_events").delete().in("event_id",eventIds);}
});
test("billing C: failed provider cleanup retains identity and customer linkage for retry",async({page})=>{
  const f=await fixture(page);const customer=`cus_${randomUUID().replaceAll("-","")}`;let fail=true,calls=0;
  const provider:BillingProvider={prices:async()=>[],customer:async()=>customer,checkout:async()=>"",portal:async()=>"",snapshot:async()=>null,verify:()=>({id:"",customer:null}),remove:async id=>{expect(id).toBe(customer);calls++;if(fail)throw new Error("test network failure");}};
  try {await f.db.from("billing_customers").insert({user_id:f.user.id,customer_id:customer});await f.db.from("account_deletion_jobs").insert({user_id:f.user.id});await expect(removeBilling(f.db,f.user.id,provider)).rejects.toThrow();expect((await f.db.auth.admin.getUserById(f.user.id)).data.user).toBeTruthy();expect((await f.db.from("billing_customers").select("user_id").eq("user_id",f.user.id)).data).toHaveLength(1);fail=false;await removeBilling(f.db,f.user.id,provider);expect(calls).toBe(2);}
  finally {await f.db.from("account_deletion_jobs").delete().eq("user_id",f.user.id);await f.cleanup();}
});
