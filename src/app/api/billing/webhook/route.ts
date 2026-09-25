import { StripeTestProvider } from "../../../../../scripts/billing-provider";
import { synchronizeBilling } from "../../../../../scripts/billing-lifecycle";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { operationLog } from "@/server/observability";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request:Request) {
  const requestId = crypto.randomUUID(), headers = {"X-Request-ID":requestId,"Cache-Control":"no-store"};
  let provider:StripeTestProvider;
  try { provider = new StripeTestProvider(); } catch { return Response.json({received:false},{status:503,headers}); }
  let event;
  try {
    const body = await request.text(); if (body.length > 1000000) return new Response(null,{status:413,headers});
    event = provider.verify(body,request.headers.get("stripe-signature") ?? "");
  } catch { operationLog("webhook","failed",requestId); return Response.json({received:false},{status:400,headers}); }
  try {
    await synchronizeBilling(createAdminSupabaseClient(),event,provider);
    operationLog("webhook","ok",requestId);
    return Response.json({received:true},{headers});
  } catch { operationLog("entitlement","failed",requestId); return Response.json({received:false},{status:503,headers}); }
}
