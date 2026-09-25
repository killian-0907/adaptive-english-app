import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/server/auth";

export default async function HomePage() {const t=await getT();
  if(await getAuthenticatedUser())redirect("/home");
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Adaptive English</h1>
      <p>{t("ui.001")}</p>
      <div className="flex gap-4">
        <Link className="underline" href="/assessment">{t("ui.002")}</Link>
        <Link className="underline" href="/login">{t("ui.003")}</Link>
      </div>
    </main>
  );
}
