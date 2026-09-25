import { apiGuard } from "@/server/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth";
import { productSettings, saveProductSettings } from "@/server/services/product";
import { ZodError } from "zod";
export async function GET(request:NextRequest){const guard=apiGuard(request);if(guard)return guard;const user=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Please sign in."},{status:401});try{return NextResponse.json(await productSettings(user.id),{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"Could not load settings."},{status:500});}}
export async function POST(request:NextRequest){
  const guard=apiGuard(request);if(guard)return guard;
  const user=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Please sign in."},{status:401});
  if(Number(request.headers.get("content-length")??0)>16000)return NextResponse.json({error:"Settings request is too large."},{status:413});
  try{const body=await request.text();if(body.length>16000)return NextResponse.json({error:"Settings request is too large."},{status:413});return NextResponse.json(await saveProductSettings(user.id,JSON.parse(body)));}catch(error){return NextResponse.json({error:error instanceof ZodError?"Choose at least one goal and valid preferences.":"Could not save settings. Please retry."},{status:400});}
}
