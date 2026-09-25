import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect,test,type Page } from "@playwright/test";
import type { Database } from "../src/types/database.generated";
const admin=()=>createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
async function learner(page:Page){const db=admin();const email=`lifecycle-${randomUUID()}@example.test`,password=randomUUID();const r=await db.auth.admin.createUser({email,password,email_confirm:true});expect(r.error).toBeNull();const user=r.data.user!;
  expect((await db.from("profiles").update({onboarding_status:"completed",interface_language:"en",native_language:"zh"}).eq("user_id",user.id)).error).toBeNull();await db.from("learning_sessions").insert({user_id:user.id,status:"completed",starting_state_summary:{purpose:"initial_assessment_v1"},session_summary:{complete:true,turns:[]},ending_state_summary:{model:[],support:"native_supported"}});
  await page.goto("/login");const form=page.getByRole("heading",{name:"Sign in",exact:true}).locator("..");await form.getByLabel("Email",{exact:true}).fill(email);await form.getByLabel("Password",{exact:true}).fill(password);await form.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/home$/);return {db,user,email,password,cleanup:()=>db.auth.admin.deleteUser(user.id)};
}

test("PWA metadata, generic offline navigation and reconnect use no private cache",async({page,context})=>{
  await page.goto('/login');
  const manifest=await(await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('/home');
  for(const icon of manifest.icons)expect((await page.request.get(icon.src)).status()).toBe(200);
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href','/manifest.webmanifest');
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content',/viewport-fit=cover/);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);await page.goto('/home');await expect(page.getByRole('heading',{name:"You're offline",exact:true})).toBeVisible();
  const entries=await page.evaluate(async()=>{const names=await caches.keys();return(await Promise.all(names.map(async name=>(await(await caches.open(name)).keys()).map(r=>new URL(r.url).pathname)))).flat();});
  expect(entries).toEqual(['/offline.html']);
  await context.setOffline(false);await page.getByRole('link',{name:'Try again',exact:true}).click();await expect(page).toHaveURL(/\/login/);
});

test("PWA feedback is bounded and private; mobile resume preserves session",async({page})=>{
  const f=await learner(page);try{
    await page.setViewportSize({width:390,height:844});await page.goto('/settings');
    await expect(page.getByText('Installation is not offered here.',{exact:false})).toBeVisible();
    await page.getByLabel('Your feedback',{exact:true}).fill('The buttons are clear.');
    await page.getByRole('button',{name:'Send feedback',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Your feedback has been saved'})).toBeVisible();
    const rows=await f.db.from('user_feedback').select('feedback_type,free_text,value_text').eq('user_id',f.user.id);expect(rows.error).toBeNull();expect(rows.data).toHaveLength(1);expect(rows.data![0].feedback_type).toBe('beta_bug');expect(JSON.parse(rows.data![0].value_text!).route).toBe('/settings');
    expect((await page.request.post('/api/feedback',{headers:{origin:'http://127.0.0.1:3000'},data:{category:'bug',text:'test',route:'/settings',userId:randomUUID()}})).status()).toBe(400);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.goto('/learn');await page.getByRole('button',{name:'Start learning session',exact:true}).click();const before=await(await page.request.get('/api/learning')).json();
    await expect(page.getByRole('button',{name:'Install Adaptive English'})).toHaveCount(0);
    await page.reload();const after=await(await page.request.get('/api/learning')).json();expect(after.activityId).toBe(before.activityId);expect(after.sessionId).toBe(before.sessionId);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.cleanup();}
});

test("PWA install dismissal and update wait for a clean safe page (browser-event doubles)",async({page})=>{
  await page.addInitScript(()=>{
    const worker={postMessage:()=>{document.documentElement.dataset.updateRequested='yes';}};
    const reg={waiting:worker,update:async()=>{},onupdatefound:null};
    Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{controller:{},register:async()=>reg,addEventListener:()=>{},removeEventListener:()=>{}}});
  });
  const f=await learner(page);try{
    await expect(page.getByRole('button',{name:'Update now',exact:true})).toBeVisible();
    await page.evaluate(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});Object.assign(event,{prompt:async()=>{},userChoice:Promise.resolve({outcome:'dismissed'})});window.dispatchEvent(event);});
    await page.getByRole('button',{name:'Not now',exact:true}).click();await expect(page.getByRole('button',{name:'Install Adaptive English',exact:true})).toHaveCount(0);
    await page.goto('/settings');await page.getByLabel('Your feedback',{exact:true}).fill('Unsaved draft');await page.getByRole('button',{name:'Update now',exact:true}).click();await expect(page.getByText('Finish saving your changes, then return to Home to update.',{exact:false})).toBeVisible();expect(await page.locator('html').getAttribute('data-update-requested')).toBeNull();
    await page.getByRole('link',{name:'Home',exact:true}).click();await expect(page).toHaveURL(/\/home$/);await page.getByRole('button',{name:'Update now',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-update-requested','yes');
    await page.goto('/assessment');await expect(page.getByRole('button',{name:'Update now',exact:true})).toHaveCount(0);
  }finally{await f.cleanup();}
});

test("PWA iOS guidance and installed display (platform doubles)",async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'userAgent',{value:'iPhone Safari'});});
  const f=await learner(page);try{await expect(page.getByText('To install: open the Share menu',{exact:false})).toBeVisible();await page.goto('/settings');await page.evaluate(()=>{Object.defineProperty(navigator,'standalone',{value:true,configurable:true});});
    await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{value:true});});await page.reload();await expect(page.getByText('Running as an installed app.',{exact:true})).toBeVisible();await expect(page.getByText('To install: open the Share menu',{exact:false})).toHaveCount(0);
  }finally{await f.cleanup();}
});
