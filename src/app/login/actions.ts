"use server";

import { redirect } from "next/navigation";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import { authCredentialsSchema } from "@/lib/validation/auth";

function readCredentials(formData: FormData) {
  return authCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signInAction(formData: FormData) {
  const parsed = readCredentials(formData);
  if (!parsed.success) redirect("/login?error=Invalid+email+or+password");

  const supabase = await createServerUserSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=${"invalid"}`);
  redirect("/home");
}

export async function signUpAction(formData: FormData) {
  const parsed = readCredentials(formData);
  if (!parsed.success) redirect("/login?error=Use+a+valid+email+and+an+8%2B+character+password");

  const supabase = await createServerUserSupabaseClient();
  const { error } = await supabase.auth.signUp({...parsed.data,options:{emailRedirectTo:`${process.env.NEXT_PUBLIC_SITE_URL??"http://127.0.0.1:3000"}/auth/confirm`}});
  if (error) redirect(`/login?error=${"invalid"}`);
  redirect("/login?message=Account+created.+Confirm+your+email+if+required,+then+sign+in.");
}

export async function signOutAction() {
  const supabase = await createServerUserSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
