"use client";
import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
const subscribe=(changed:()=>void)=>{window.addEventListener("online",changed);window.addEventListener("offline",changed);return()=>{window.removeEventListener("online",changed);window.removeEventListener("offline",changed);};};
export function ConnectionStatus(){const t=useT();const online=useSyncExternalStore(subscribe,()=>navigator.onLine,()=>true);return online?null:<p role="status" className="connection-banner">{t("You appear to be offline. Your input stays here. Reconnect and retry.")}</p>;}
