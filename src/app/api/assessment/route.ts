import { mobileContext } from "@/domain/auth/request";
import { apiGuard } from "@/server/api-guard";
import { RateLimitError } from "@/server/services/lifecycle";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getAuthenticatedUser } from "@/server/auth";
import { assessmentView, saveOnboarding, submitAnswer, AssessmentError, ownedActivity, recordSupport } from "@/server/services/assessment";
import { ProviderUnavailable } from "@/server/services/assessment-provider";
import { assessmentVoice } from "@/server/services/assessment-voice";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { commandSchema } from "@/domain/learning/types";

import { requireVoiceDelivery } from "@/server/services/delivery";

export const runtime = "nodejs";
export const maxDuration = 60;
function failure(error:unknown,request:Request){
  if(error instanceof RateLimitError)return NextResponse.json({error:error.message},{status:429,headers:{"Cache-Control":"no-store"}});
  const requestId=crypto.randomUUID();const provider=error instanceof ProviderUnavailable;const invalid=error instanceof ZodError;
  console.error(JSON.stringify({event:"learning_request_failed",requestId,...mobileContext(request.headers),route:"/assessment",category:provider?"provider":invalid?"validation":"save_or_state",type:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:provider?"The service is temporarily unavailable. Your saved progress is safe. Please retry.":invalid?"Please check your response and try again.":"Could not save this step. Your input is kept. Retry or resume saved progress."},{status:provider?503:400,headers:{"X-Request-ID":requestId}});
}
export async function GET(request:NextRequest) {
  const guard=apiGuard(request);if(guard)return guard;
  const user = await getAuthenticatedUser(); if(!user) return NextResponse.json({error:"Please sign in again."},{status:401});
  try { return NextResponse.json(await assessmentView(user.id),{headers:{"Cache-Control":"no-store"}}); } catch(e) {return failure(e,request);}
}
export async function POST(request: NextRequest) {
  const guard=apiGuard(request);if(guard)return guard;
  const user = await getAuthenticatedUser(); if(!user) return NextResponse.json({error:"Please sign in again."},{status:401});
  if(Number(request.headers.get("content-length") ?? 0)>8_100_000) return NextResponse.json({error:"Recording is too large."},{status:413});
  try {
    if(request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(); const activityId = z.uuid().parse(form.get("activityId")); const audio = form.get("audio");
      if(!(audio instanceof File)) throw new AssessmentError("A recording is required.");
      return NextResponse.json(await assessmentVoice(user.id,activityId,audio));
    }
    const body = await request.json();
    if(body.action === "onboarding") await saveOnboarding(user.id,body.data);
    else if(body.action === "answer") await submitAnswer(user.id,body.data);
    else if((body.action === "browser_voice" || body.action === "native_voice")) {
      await requireVoiceDelivery(user.id);
      const command=commandSchema.parse(body);
      if(command.action!=="browser_voice"&&command.action!=="native_voice")throw new AssessmentError("Invalid voice request.");
      const {item}=await ownedActivity(user.id,command.activityId);
      if(!["spoken","practical"].includes(item.type))throw new AssessmentError("This activity does not accept speech.");
      const result=await createAdminSupabaseClient().rpc(command.action==="native_voice"?"record_native_transcript":"record_browser_transcript",{p_user:user.id,p_activity:command.activityId,p_attempt:command.attemptId,p_text:command.text});
      if(result.error)throw new AssessmentError("Could not save recognized text. Retry or type instead.");
      return NextResponse.json({voiceId:result.data,transcript:command.text});
    }
    else if(body.action === "tts") {
      const result = await assessmentVoice(user.id,z.uuid().parse(body.activityId));
      return new Response(result.audio,{headers:{"Content-Type":"audio/mpeg","Cache-Control":"private, no-store"}});
    } else if(body.action === "transcript") {
      const {item} = await ownedActivity(user.id,z.uuid().parse(body.activityId));
      await recordSupport(user.id,body.activityId,"transcript");
      return NextResponse.json({text:item.tts});
    } else if(body.action === "support") {
      return NextResponse.json(await recordSupport(user.id,z.uuid().parse(body.activityId),z.enum(["hints","translation","transcript","replays"]).parse(body.kind)));
    } else throw new AssessmentError("Unknown action.");
    return NextResponse.json(await assessmentView(user.id));
  } catch(e) {return failure(e,request);}
}
