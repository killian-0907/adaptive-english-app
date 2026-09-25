import "server-only";
import { cache } from "react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";

export const getAuthenticatedUser=cache(async()=> {
  const supabase = await createServerUserSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  if(data.user){const {data:job,error:jobError}=await createAdminSupabaseClient().from("account_deletion_jobs").select("user_id").eq("user_id",data.user.id).maybeSingle();if(jobError||job)return null;}
  return data.user;
});

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}
