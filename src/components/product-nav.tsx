"use client";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function ProductNav({language="en"}:{language?:string}){const t=useT();
  const path=usePathname();
  const links=[["/home",t("ui.262")],["/learn",t("ui.263")],["/my-english",t("ui.204")],["/history",t("ui.161")],["/settings",t("ui.235")]];
  return <header className="product-header" lang={language}><Link lang="en" className="brand" href="/home">Adaptive English<span lang={language}>{t("ui.264")}</span></Link><nav aria-label={t("ui.265")}>{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href||path.startsWith(href+"/")?"page":undefined}>{label}</Link>)}</nav></header>;
}
