import { AdSenseSlot } from "./adsense-slot";
import { adSenseConfiguration, adDeliveryEnabled } from "@/domain/ads/provider";
import { getT } from "@/lib/i18n/server";
import type { ReactNode } from "react";
import Link from "next/link";
import { ProductNav } from "./product-nav";
import { isAdAllowed } from "@/domain/ads/service";
export async function ProductShell({children,language}:{children:ReactNode;language:string}){const t=await getT();return <div className="product-shell" lang={language}><a className="skip-link" href="#main-content">{t("ui.266")}</a><ProductNav language={language}/><main tabIndex={-1} id="main-content" className="product-main">{children}</main><footer className="product-footer"><span>{t("ui.267")} · {t("pwa.beta")}</span><Link href="/settings#feedback">{t("feedback.title")}</Link><Link href="/membership">{t("ui.268")}</Link><Link href="/settings#privacy">{t("ui.269")}</Link></footer></div>;}
export async function AdSlot({userId,surface}:{userId:string;surface:"dashboard"|"progress"}){const t=await getT();if(!await isAdAllowed({userId,surfaceKey:surface,activeLearningProtected:false}))return null;const config=adSenseConfiguration(process.env,surface);if(adDeliveryEnabled(process.env)&&config)return <AdSenseSlot config={config}/>;if(process.env.NODE_ENV!=="development")return null;return <aside className="ad-slot" aria-label={t("ui.270")}><span>{t("ui.270")}</span><p>{t("ui.271")}</p></aside>;}
export function EmptyState({children}:{children:ReactNode}){return <p className="empty-state">{children}</p>;}
