import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/server/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
export async function POST(request:NextRequest){const origin=request.headers.get("origin");if(!origin||!URL.canParse(origin)||new URL(origin).host!==request.headers.get("host"))return new Response(null,{status:403});try{const body=await request.text();if(body.length>200)return new Response(null,{status:413});const input=z.object({language:z.enum(["en","zh","es"])}).strict().parse(JSON.parse(body));const user=await getAuthenticatedUser();if(user){const r=await createAdminSupabaseClient().from("profiles").update({interface_language:input.language}).eq("user_id",user.id);if(r.error)throw new Error();}(await cookies()).set("interface_language",input.language,{httpOnly:true,sameSite:"lax",path:"/",maxAge:31536000});return NextResponse.json({saved:true});}catch{return NextResponse.json({error:"Please try again."},{status:400});}}
