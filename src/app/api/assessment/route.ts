import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getAuthenticatedUser } from "@/server/auth";
import { assessmentView, saveOnboarding, submitAnswer, AssessmentError, ownedActivity, recordSupport } from "@/server/services/assessment";
import { ProviderUnavailable } from "@/server/services/assessment-provider";
import { assessmentVoice } from "@/server/services/assessment-voice";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { commandSchema } from "@/domain/learning/types";

export const runtime = "nodejs";
export const maxDuration = 60;
function failure(error: unknown) {
  const message = error instanceof ZodError ? "Please check your answers and try again." : error instanceof AssessmentError || error instanceof ProviderUnavailable ? error.message : "Something went wrong. Your saved progress is safe. Please retry.";
  return NextResponse.json({error:message},{status:error instanceof ProviderUnavailable ? 503 : 400});
}
export async function GET() {
  const user = await getAuthenticatedUser(); if(!user) return NextResponse.json({error:"Please sign in again."},{status:401});
  try { return NextResponse.json(await assessmentView(user.id),{headers:{"Cache-Control":"no-store"}}); } catch(e) {return failure(e);}
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if(!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({error:"Invalid request origin."},{status:403});
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
    else if(body.action === "browser_voice") {
      const command=commandSchema.parse(body);
      if(command.action!=="browser_voice")throw new AssessmentError("Invalid voice request.");
      const {item}=await ownedActivity(user.id,command.activityId);
      if(!["spoken","practical"].includes(item.type))throw new AssessmentError("This activity does not accept speech.");
      const result=await createAdminSupabaseClient().rpc("record_browser_transcript",{p_user:user.id,p_activity:command.activityId,p_attempt:command.attemptId,p_text:command.text});
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
  } catch(e) {return failure(e);}
}
