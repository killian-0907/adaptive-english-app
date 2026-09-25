"use client";
import { translate, language } from "@/lib/i18n/core";
export default function GlobalError({reset}:{reset:()=>void}){const locale=language(typeof document==="undefined"?"en":document.documentElement.lang);return <html lang={locale}><body><h1>{translate(locale,"We couldn’t load this page")}</h1><button onClick={reset}>{translate(locale,"Try again")}</button><a href="/home">{translate(locale,"Home")}</a></body></html>;}
