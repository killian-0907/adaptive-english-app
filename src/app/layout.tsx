import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider, LanguagePicker } from "@/lib/i18n/client";
import { ConnectionStatus } from "@/components/connection-status";
import { PwaShell } from "@/components/pwa-shell";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adaptive English",
  description: "English practice that adapts to you.",
  applicationName: "Adaptive English",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Adaptive English", statusBarStyle: "default" },
  icons: { icon: "/icons/app-192.png", apple: "/icons/apple-180.png" },
};
export const viewport: Viewport = { themeColor: "#245d46", width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale=await getLocale();
  return (
    <html lang={locale}>
      <body><LocaleProvider language={locale}><LanguagePicker/><ConnectionStatus/><PwaShell/>{children}</LocaleProvider></body>
    </html>
  );
}
