import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/server/auth";
import { startBilling } from "@/server/services/billing";
import { requestSlot } from "@/server/services/lifecycle";
import { operationLog } from "@/server/observability";
export const runtime = "nodejs";
const inputSchema = z.discriminatedUnion("action",[
  z.object({action:z.literal("checkout"),interval:z.enum(["month","year"])}).strict(),
  z.object({action:z.literal("portal")}).strict(),
]);
export async function POST(request:NextRequest) {
  const requestId = crypto.randomUUID(), headers = {"Cache-Control":"no-store","X-Request-ID":requestId};
  const origin = request.headers.get("origin");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({error:"Invalid origin"},{status:403,headers});
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({error:"Please sign in again"},{status:401,headers});
  try {
    const raw = await request.text(); if (raw.length > 1000) return NextResponse.json({error:"Invalid request"},{status:413,headers});
    const parsed = inputSchema.safeParse(JSON.parse(raw)); if (!parsed.success) return NextResponse.json({error:"Invalid request"},{status:400,headers});
    await requestSlot(user.id,"billing",10,3600);
    const url = await startBilling(user.id,parsed.data.action,parsed.data.action === "checkout" ? parsed.data.interval : undefined);
    operationLog("billing","ok",requestId);
    return NextResponse.json({url},{headers});
  } catch { operationLog("billing","failed",requestId); return NextResponse.json({error:"Billing is unavailable. Please retry or manage an existing subscription."},{status:503,headers}); }
}
