"use client";
import { useT } from "@/lib/i18n/client";
export default function AssessmentErrorPage({reset}:{reset:()=>void}) {const t=useT();
  return <main className="assessment-shell"><section className="assessment-card"><h1>{t("ui.007")}</h1><p role="alert">{t("ui.008")}</p><button onClick={reset}>{t("ui.009")}</button></section></main>;
}
