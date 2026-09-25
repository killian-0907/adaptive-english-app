"use client";
import Script from "next/script";
import { useRef } from "react";
import type { AdConfiguration } from "@/domain/ads/provider";
export function AdSenseSlot({config}:{config:AdConfiguration}) {
  const requested=useRef(false);
  return <><ins className="adsbygoogle" style={{display:"block"}} data-ad-client={config.client} data-ad-slot={config.slot} data-ad-format="auto" data-full-width-responsive="true"/><Script id="adsense-provider" strategy="afterInteractive" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`} crossOrigin="anonymous" onReady={()=>{if(requested.current)return;requested.current=true;const w=window as typeof window & {adsbygoogle?:unknown[]};(w.adsbygoogle=w.adsbygoogle||[]).push({});}}/></>;
}
