import { PendingSubmit } from "@/components/pending-submit";
import { getT } from "@/lib/i18n/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/server/auth";
import { resetPassword } from "../recovery/actions";
export default async function Reset({searchParams}:{searchParams:Promise<{error?:string}>}){const t=await getT();if(!(await getAuthenticatedUser())||(await cookies()).get("recovery_verified")?.value!=="true")redirect("/auth/recovery?error=expired");const p=await searchParams;return <main className="assessment-shell"><section className="assessment-card"><h1>{t("ui.252")}</h1>{p.error&&<p role="alert">{t("ui.253")}</p>}<form action={resetPassword}><label>{t("ui.254")}<input type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label><PendingSubmit>{t("ui.255")}</PendingSubmit></form></section></main>;}
