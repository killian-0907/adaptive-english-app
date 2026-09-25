import { getT } from "@/lib/i18n/server";
export default async function Loading(){const t=await getT();return <main className="assessment-shell"><p role="status">{t("Loading your learning space…")}</p></main>;}
