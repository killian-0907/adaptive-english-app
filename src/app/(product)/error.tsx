"use client";
import { useT } from "@/lib/i18n/client";
export default function ErrorPage({reset}:{reset:()=>void}){const t=useT();return <section className="product-card"><h1>{t("ui.004")}</h1><p>{t("ui.005")}</p><button onClick={reset}>{t("ui.006")}</button></section>;}
