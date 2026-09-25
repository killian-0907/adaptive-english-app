import type { ReactNode } from "react";
import Link from "next/link";
import { ProductNav } from "./product-nav";
import { isAdAllowed } from "@/domain/ads/service";
export function ProductShell({children,language}:{children:ReactNode;language:string}){return <div className="product-shell" lang="en"><a className="skip-link" href="#main-content">Skip to content</a><ProductNav language={language}/><main tabIndex={-1} id="main-content" className="product-main">{children}</main><footer className="product-footer"><span>A little useful English, at your pace.</span><Link href="/membership">Membership preview</Link><Link href="/settings#privacy">Privacy & account</Link></footer></div>;}
export async function AdSlot({userId,surface}:{userId:string;surface:"dashboard"|"progress"}){if(!await isAdAllowed({userId,surfaceKey:surface,activeLearningProtected:false}))return null;return <aside className="ad-slot" aria-label="Ad space"><span>Ad space</span><p>Placement preview only. No advertiser, tracking or ad network is connected.</p></aside>;}
export function EmptyState({children}:{children:ReactNode}){return <p className="empty-state">{children}</p>;}
