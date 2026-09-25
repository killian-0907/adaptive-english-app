import { BetaFeedback } from "@/components/beta-feedback";
import { BillingPanel } from "@/components/billing-panel";
import { billingOverview } from "@/server/services/billing";
import { getT } from "@/lib/i18n/server";
import { AccountData } from "./account";
import Link from "next/link";
import { voiceDelivery } from "@/server/services/delivery";
import { productIdentity, productSettings } from "@/server/services/product";
import { signOutAction } from "@/app/login/actions";
import { SettingsForm } from "./form";
import { VoiceSettings } from "./voice";
export default async function Settings(){const t=await getT();const user=await productIdentity();const settings=await productSettings(user.id);const billing=await billingOverview(user.id);const delivery=await voiceDelivery(user.id);return <><div className="page-heading"><p className="eyebrow">{t("ui.233")}</p><h1>{t("Settings")}</h1><p>{t("ui.236")}</p></div><section className="product-card"><h2>{t("ui.237")}</h2><SettingsForm initial={settings}/></section><section className="product-card" id="voice"><h2>{t("ui.238")}</h2><p>{t("ui.239")}</p>{delivery.voiceAllowed?<VoiceSettings/>:<p>{t("ui.240")}</p>}</section><section className="product-card" id="privacy"><h2>{t("ui.241")}</h2><p>{t("ui.242")} {user.email}.</p><p>{t("ui.243")}</p><p>{t("ui.244")}</p><Link className="text-link" href="/membership">{t("ui.245")}</Link><form action={signOutAction}><button>{t("ui.246")}</button></form></section><BillingPanel data={billing}/><AccountData/><BetaFeedback/></>;}
