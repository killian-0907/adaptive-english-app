"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/domain/product/lifecycle";
import { z } from "zod";
export async function recoverPassword(form:FormData){
  const email=z.email().max(254).safeParse(form.get("email"));
  if(email.success){const db=await createServerUserSupabaseClient();await db.auth.resetPasswordForEmail(email.data,{redirectTo:`${process.env.NEXT_PUBLIC_SITE_URL??"http://127.0.0.1:3000"}/auth/confirm?next=recovery`});}
  redirect("/auth/recovery?sent=1");
}
export async function resetPassword(form:FormData){
  const store=await cookies();if(store.get("recovery_verified")?.value!=="true")redirect("/auth/recovery?error=expired");
  const password=passwordSchema.safeParse(form.get("password"));if(!password.success)redirect("/auth/reset?error=invalid");
  const db=await createServerUserSupabaseClient();const {data}=await db.auth.getUser();if(!data.user)redirect("/auth/recovery?error=expired");
  const {error}=await db.auth.updateUser({password:password.data});if(error)redirect("/auth/reset?error=invalid");store.delete("recovery_verified");await db.auth.signOut();redirect("/login?message=password_updated");
}
