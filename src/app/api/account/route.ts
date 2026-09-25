import { apiGuard } from "@/server/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import { deleteAccount, exportAccount, requestSlot, RateLimitError } from "@/server/services/lifecycle";
import { deletionSchema } from "@/domain/product/lifecycle";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:NextRequest){
  const guard=apiGuard(request);if(guard)return guard;
  const user=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Please sign in again."},{status:401});
  try{
    const body=await request.text();if(body.length>1000)return NextResponse.json({error:"Please check your request."},{status:413});const input=JSON.parse(body);
    if(input.action==="export"&&Object.keys(input).length===1){await requestSlot(user.id,"export",3,3600);return NextResponse.json(await exportAccount(user.id,user.email??""),{headers:{"Cache-Control":"no-store","Content-Disposition":"attachment; filename=adaptive-english-data.json"}});}
    deletionSchema.parse(input);await deleteAccount(user.id);if(!request.headers.has("authorization"))await(await createServerUserSupabaseClient()).auth.signOut();return NextResponse.json({deleted:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){if(error instanceof RateLimitError)return NextResponse.json({error:"Please wait before trying again."},{status:429,headers:{"Retry-After":"3600"}});return NextResponse.json({error:"Could not finish this request. Please wait and retry. Confirmed deletion requests continue safely in the background."},{status:400});}
}
