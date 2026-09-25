import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider, LanguagePicker } from "@/lib/i18n/client";
import { ConnectionStatus } from "@/components/connection-status";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adaptive English",
  description: "Adaptive English-learning foundation",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale=await getLocale();
  return (
    <html lang={locale}>
      <body><LocaleProvider language={locale}><LanguagePicker/><ConnectionStatus/>{children}</LocaleProvider></body>
    </html>
  );
}
