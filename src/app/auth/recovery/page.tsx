import { PendingSubmit } from "@/components/pending-submit";
import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { recoverPassword } from "./actions";
export default async function Recovery({searchParams}:{searchParams:Promise<{sent?:string;error?:string}>}){const t=await getT();const p=await searchParams;return <main className="assessment-shell"><section className="assessment-card"><h1>{t("ui.247")}</h1>{p.error&&<p role="alert">{t("ui.248")}</p>}{p.sent?<p role="status">{t("ui.249")}</p>:<form action={recoverPassword}><label>{t("ui.154")}<input type="email" name="email" required maxLength={254} autoComplete="email"/></label><PendingSubmit>{t("ui.250")}</PendingSubmit></form>}<Link href="/login">{t("ui.251")}</Link></section></main>;}
