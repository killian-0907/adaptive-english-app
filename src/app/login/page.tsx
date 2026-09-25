import { PendingSubmit } from "@/components/pending-submit";
import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { signInAction, signUpAction, resendConfirmation } from "./actions";

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function LoginPage({ searchParams }: Props) {const t=await getT();
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 p-8">
      <h1 className="text-2xl font-semibold">{t("Welcome to Adaptive English")}</h1>
      {params.error ? <p role="alert">{t(params.error==="expired"?"auth.expired":"ui.150")}</p> : null}
      {params.message ? <p role="status">{params.message==="check_email"?t("auth.inbox"):params.message==="deleted"?t("ui.151"):params.message==="password_updated"?t("ui.152"):t("ui.153")}</p> : null}
      <form action={signInAction} className="flex flex-col gap-3">
        <h2 className="font-medium">{t("ui.003")}</h2>
        <input className="border p-2" name="email" type="email" autoComplete="email" required aria-label={t("ui.154")} placeholder={t("ui.154")} />
        <input className="border p-2" name="password" type="password" autoComplete="current-password" required minLength={8} aria-label={t("ui.155")} placeholder={t("ui.155")} />
        <PendingSubmit>{t("ui.003")}</PendingSubmit>
      </form>
      <form action={signUpAction} className="flex flex-col gap-3">
        <h2 className="font-medium">{t("ui.156")}</h2>
        <input className="border p-2" name="email" type="email" autoComplete="email" required aria-label={t("ui.154")} placeholder={t("ui.154")} />
        <input className="border p-2" name="password" type="password" autoComplete="new-password" required minLength={8} aria-label={t("ui.155")} placeholder={t("ui.155")} />
        <PendingSubmit>{t("ui.157")}</PendingSubmit>
      </form>
    <details><summary>{t("auth.resend")}</summary><form action={resendConfirmation} className="flex flex-col gap-3"><label>{t("ui.154")}<input className="border p-2" name="email" type="email" autoComplete="email" required/></label><PendingSubmit>{t("auth.resend")}</PendingSubmit><p>{t("auth.inbox")}</p></form></details>
    <Link href="/auth/recovery">{t("ui.158")}</Link></main>
  );
}
