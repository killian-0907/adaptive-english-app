import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { productHome, productIdentity } from "@/server/services/product";
import { AdSlot, EmptyState } from "@/components/product-shell";
export default async function Home(){const t=await getT();const user=await productIdentity(true);const data=await productHome(user.id);return <>
  <div className="page-heading"><p className="eyebrow">{t("ui.170")}</p><h1>{t("Your English, in everyday life")}</h1><p>{t("ui.173")}</p></div>
  <section className="product-card focus-card"><div><span className="status-chip">{data.active?t("ui.174"):t("ui.175")}</span><h2>{t("ui.176")}</h2><p className="focus-title">{data.focus}</p><p>{data.active?t("ui.177"):t("ui.178")}</p></div><Link className="button primary" href="/learn">{data.active?t("ui.179"):t("ui.071")}<span aria-hidden="true"> →</span></Link></section>
  <div className="product-grid"><section className="product-card"><h2>{t("ui.180")}</h2>{data.progress.timeline.length?<ul className="timeline">{data.progress.timeline.slice(0,3).map(x=><li key={x.id}>{t(x.text)}</li>)}</ul>:<EmptyState>{t("ui.181")}</EmptyState>}<Link className="text-link" href="/my-english">{t("ui.182")}</Link></section><section className="product-card"><h2>{t("ui.183")}</h2>{data.progress.needs.length?<ul>{data.progress.needs.map(x=><li key={t(x)}>{t(x)}</li>)}</ul>:<p>{t("ui.184")}</p>}{data.progress.reviewSuggested&&<p className="callout">{t("ui.185")}</p>}<Link className="text-link" href="/settings">{t("ui.186")}</Link></section></div><AdSlot userId={user.id} surface="dashboard"/>
  </>;}
