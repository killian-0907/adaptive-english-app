import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import { language, translate } from "./core";
export const getLocale=cache(async()=>{const cookie=(await cookies()).get("interface_language")?.value;try{const db=await createServerUserSupabaseClient();const {data}=await db.auth.getUser();if(data.user){const p=await db.from("profiles").select("interface_language").eq("user_id",data.user.id).single();if(p.data?.interface_language)return language(p.data.interface_language);}}catch{}return language(cookie);});
export async function getT(){const locale=await getLocale();return(key:string,values?:Record<string,string|number>)=>translate(locale,key,values);}
