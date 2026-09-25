"use client";
import { useState } from "react";
import { displayAmount } from "@/domain/billing/policy";
import { useT, useLocale } from "@/lib/i18n/client";
type Overview = {configured:boolean;prices:{interval:"month"|"year";amount:number;currency:string}[];portal:boolean;status:string;endsAt?:string|null;cancel:boolean};
export function BillingPanel({data}:{data:Overview}) {
  const t=useT(), locale=useLocale(), [pending,setPending]=useState(false), [error,setError]=useState(false);
  async function open(action:"checkout"|"portal",interval?:"month"|"year") {
    setPending(true);setError(false);
    try { const response=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...(interval?{interval}:{})})});if(!response.ok)throw new Error();const {url}=await response.json();const target=new URL(url);if(target.protocol!=="https:"||!["checkout.stripe.com","billing.stripe.com"].includes(target.hostname))throw new Error();window.location.assign(url); }
    catch {setError(true);setPending(false);}
  }
  const statuses:Record<string,string>={free:"Free",active:"Active",trial:"Trial",canceled:"Canceled",expired:"Expired",payment_issue:"Payment issue"};
  return <section className="product-card"><h2>{t("Billing settings")}</h2><p>{t("Test mode only. No real-money charging is enabled.")}</p><p>{t("Subscription state")}: {t(statuses[data.status]??"Free")}</p>{data.endsAt&&<p>{t(data.cancel?"Canceled: access ends on":"Current period ends on")} {new Intl.DateTimeFormat(locale).format(new Date(data.endsAt))}</p>} {!data.configured&&<p>{t("Pricing not configured yet")}. {t("Checkout is not configured.")}</p>}
    {["free","expired","canceled"].includes(data.status)&&data.prices.map(p=><button key={p.interval} disabled={pending} onClick={()=>open("checkout",p.interval)}>{t("Open test checkout")} — {displayAmount(p.amount,p.currency,locale)} / {t(p.interval)}</button>)}
    {data.portal&&<button disabled={pending} onClick={()=>open("portal")}>{t("Manage test billing")}</button>}{error&&<p role="alert">{t("Billing is unavailable. Please retry or manage an existing subscription.")}</p>}
    <p>{t("Returning from checkout does not confirm payment. Access updates after a verified provider event.")}</p>
  </section>;
}
