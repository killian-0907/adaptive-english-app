"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
export default function ErrorPage({reset}:{reset:()=>void}){const t=useT();return <main className="assessment-shell"><h1>{t("We couldn’t load this page")}</h1><p role="alert">{t("Your saved learning progress is safe. Please try again.")}</p><button onClick={reset}>{t("Try again")}</button><Link href="/home">{t("Home")}</Link></main>;}
