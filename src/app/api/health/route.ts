import { deploymentReady } from "@/lib/deployment";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function GET() {
  let ready = deploymentReady();
  if (ready) {
    try { const result = await createAdminSupabaseClient().from("billing_events").select("event_id").limit(0).abortSignal(AbortSignal.timeout(3000)); ready = !result.error; } catch { ready = false; }
  }
  return Response.json({status:ready?"ready":"unavailable"},{status:ready?200:503,headers:{"Cache-Control":"no-store"}});
}
