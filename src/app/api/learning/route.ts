import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getAuthenticatedUser } from "@/server/auth";
import { commandSchema } from "@/domain/learning/types";
import { learningCommand, learningView, learningVoice, LearningError } from "@/server/services/learning";
import { AssessmentError } from "@/server/services/assessment";
import { ProviderUnavailable } from "@/server/services/assessment-provider";
export const runtime="nodejs";
export const maxDuration=60;
function failure(error:unknown){
  const message=error instanceof ProviderUnavailable?"The voice or evaluation service is unavailable. Your progress is safe. Try a structured activity, type instead of recording, or skip this response.":error instanceof LearningError||error instanceof AssessmentError?error.message:error instanceof ZodError?"Please check the response and try again.":"Could not complete this step. Your saved progress is safe; please resume.";
  return NextResponse.json({error:message},{status:error instanceof ProviderUnavailable?503:400});
}
export async function GET(){const user=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Please sign in."},{status:401});try{return NextResponse.json(await learningView(user.id),{headers:{"Cache-Control":"no-store"}});}catch(e){return failure(e);}}
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(!origin||!URL.canParse(origin)||new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Invalid request origin."},{status:403});
  const user=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Please sign in."},{status:401});
  if(Number(request.headers.get("content-length")??0)>8_100_000)return NextResponse.json({error:"Recording is too large."},{status:413});
  try{
    if(request.headers.get("content-type")?.includes("multipart/form-data")){const data=await request.formData();const id=z.uuid().parse(data.get("activityId"));const audio=data.get("audio");if(!(audio instanceof File))throw new LearningError("A recording is required.");return NextResponse.json(await learningVoice(user.id,id,audio));}
    const command=commandSchema.parse(await request.json());
    if(command.action==="tts"){const result=await learningVoice(user.id,command.activityId);return new Response(result.audio,{headers:{"Content-Type":"audio/mpeg","Cache-Control":"private, no-store"}});}
    return NextResponse.json(await learningCommand(user.id,command));
  }catch(e){return failure(e);}
}
