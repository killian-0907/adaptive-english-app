import { RateLimitError } from "@/server/services/lifecycle";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getAuthenticatedUser } from "@/server/auth";
import { commandSchema } from "@/domain/learning/types";
import { learningCommand, learningView, learningVoice, LearningError } from "@/server/services/learning";
import { ProviderUnavailable } from "@/server/services/assessment-provider";
export const runtime="nodejs";
export const maxDuration=60;
function failure(error:unknown){
  if(error instanceof RateLimitError)return NextResponse.json({error:error.message},{status:429,headers:{"Cache-Control":"no-store"}});
  const requestId=crypto.randomUUID();const provider=error instanceof ProviderUnavailable;const invalid=error instanceof ZodError;
  console.error(JSON.stringify({event:"learning_request_failed",requestId,category:provider?"provider":invalid?"validation":"save_or_state",type:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:provider?"The service is temporarily unavailable. Your saved progress is safe. Please retry.":invalid?"Please check your response and try again.":"Could not save this step. Your input is kept. Retry or resume saved progress."},{status:provider?503:400,headers:{"X-Request-ID":requestId}});
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
