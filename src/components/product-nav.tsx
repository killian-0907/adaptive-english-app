"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export const productText=(language:string,en:string,zh:string,es:string)=>language==="zh"?zh:language==="es"?es:en;
export function ProductNav({language="en"}:{language?:string}){
  const path=usePathname();const t=(en:string,zh:string,es:string)=>productText(language,en,zh,es);
  const links=[["/home",t("Home","首页","Inicio")],["/learn",t("Learn","学习","Aprender")],["/my-english",t("My English","我的英语","Mi inglés")],["/history",t("History","学习记录","Historial")],["/settings",t("Settings","设置","Ajustes")]];
  return <header className="product-header" lang={language}><Link lang="en" className="brand" href="/home">Adaptive English<span>Everyday words. Real connections.</span></Link><nav aria-label={t("Main navigation","主导航","Navegación principal")}>{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href||path.startsWith(href+"/")?"page":undefined}>{label}</Link>)}</nav></header>;
}
