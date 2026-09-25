"use client";
import { useT } from "@/lib/i18n/client";
export default function LearningError({reset}:{reset:()=>void}){const t=useT();return <main className="assessment-shell"><h1>{t("ui.072")}</h1><p>{t("ui.073")}</p><button onClick={reset}>{t("ui.006")}</button></main>;}
