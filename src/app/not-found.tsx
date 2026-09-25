import Link from "next/link";
import { getT } from "@/lib/i18n/server";
export default async function NotFound(){const t=await getT();return <main className="assessment-shell"><h1>{t("This page is unavailable")}</h1><p>{t("Check the link or return to Home.")}</p><Link href="/home">{t("Home")}</Link></main>;}
