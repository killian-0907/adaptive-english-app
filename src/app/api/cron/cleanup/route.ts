import { timingSafeEqual } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { maintainVoice } from "../../../../../scripts/voice-maintenance";
import { operationLog } from "@/server/observability";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request:Request) {
  const expected = process.env.CRON_SECRET, actual = request.headers.get("authorization") ?? "";
  const target = `Bearer ${expected}`;
  if (!expected || expected.length < 32 || Buffer.byteLength(target) !== Buffer.byteLength(actual) || !timingSafeEqual(Buffer.from(target),Buffer.from(actual))) return new Response(null,{status:401});
  const requestId = crypto.randomUUID();
  try { const result = await maintainVoice(createAdminSupabaseClient()); operationLog("cleanup",result.failed?"failed":"ok",requestId); return Response.json({ok:result.failed===0},{status:result.failed?503:200,headers:{"Cache-Control":"no-store","X-Request-ID":requestId}}); }
  catch { operationLog("cleanup","failed",requestId); return Response.json({ok:false},{status:503,headers:{"Cache-Control":"no-store","X-Request-ID":requestId}}); }
}
