"use client";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { feedbackCategories } from "@/lib/validation/beta-feedback";
import { checkedResponse, friendlyError } from "@/lib/recovery";
export function BetaFeedback() {
  const t = useT(), lock = useRef(false);
  const [text, setText] = useState(""), [category, setCategory] = useState("bug"), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <section className="product-card" id="feedback"><h2>{t("feedback.title")}</h2><p>{t("feedback.privacy")}</p>
    <form aria-busy={busy} onSubmit={async event => {
      event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
      try { await checkedResponse(await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, text, route: "/settings" }) })); setText(""); setMessage("feedback.saved"); }
      catch (error) { setMessage(friendlyError(error)); } finally { lock.current = false; setBusy(false); }
    }}>
      <label>{t("feedback.category")}<select value={category} onChange={e => setCategory(e.target.value)}>{feedbackCategories.map(value => <option value={value} key={value}>{t(`feedback.${value}`)}</option>)}</select></label>
      <label>{t("feedback.details")}<textarea required maxLength={1000} rows={4} value={text} onChange={e => setText(e.target.value)}/></label>
      <button disabled={busy}>{t(busy ? "Saving…" : "feedback.send")}</button><p role="status">{t(message)}</p>
    </form>
  </section>;
}
