import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
export async function GET(request:NextRequest){
  const token=request.nextUrl.searchParams.get("token_hash"),type=request.nextUrl.searchParams.get("type"),code=request.nextUrl.searchParams.get("code");
  const recovery=type==="recovery"||request.nextUrl.searchParams.get("next")==="recovery";
  const db=await createServerUserSupabaseClient();let valid=false;
  if(token&&(type==="recovery"||type==="signup"||type==="email")){const r=await db.auth.verifyOtp({token_hash:token,type});valid=!r.error;}
  else if(code){const r=await db.auth.exchangeCodeForSession(code);valid=!r.error;}
  if(valid&&recovery)(await cookies()).set("recovery_verified","true",{httpOnly:true,sameSite:"lax",secure:request.nextUrl.protocol==="https:",maxAge:600,path:"/"});
  return NextResponse.redirect(new URL(valid?(recovery?"/auth/reset":"/home"):(recovery?"/auth/recovery?error=expired":"/login?error=expired"),process.env.NEXT_PUBLIC_SITE_URL??"http://127.0.0.1:3000"));
}
