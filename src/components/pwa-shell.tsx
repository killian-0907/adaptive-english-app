"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { APP_VERSION, INSTALL_PREFERENCE, canUpdate, installPlatform, showInstall, standalone } from "@/lib/pwa";
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function PwaShell() {
  const t = useT(), path = usePathname();
  const [installed, setInstalled] = useState(false), [dismissed, setDismissed] = useState(true);
  const [platform, setPlatform] = useState("desktop"), [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null), [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const dirty = useRef(false), applying = useRef(false), route = useRef(path);
  useEffect(() => { route.current = path; dirty.current = false; }, [path]);
  useEffect(() => {
    const mode = matchMedia("(display-mode: standalone)");
    const detect = () => setInstalled(standalone(mode.matches, (navigator as Navigator & { standalone?: boolean }).standalone));
    detect();
    // Browser preferences are read only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(installPlatform(navigator.userAgent, navigator.maxTouchPoints));
    try { setDismissed(localStorage.getItem(INSTALL_PREFERENCE) === "true"); } catch { setDismissed(false); }
    setReady(true);
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installedEvent = () => { setInstalled(true); setPrompt(null); };
    const changed = () => { dirty.current = true; };
    mode.addEventListener("change", detect);
    window.addEventListener("beforeinstallprompt", offer); window.addEventListener("appinstalled", installedEvent);
    document.addEventListener("input", changed);
    let registration: ServiceWorkerRegistration | undefined, disposed = false;
    const controller = () => {
      if (!applying.current) return;
      applying.current = false;
      const busy = !!document.querySelector('[aria-busy="true"], [data-voice-active="true"], dialog[open], form button[disabled], fieldset[disabled]');
      if (canUpdate(route.current, dirty.current, busy)) location.reload();
      else { setWaiting(null); setMessage("pwa.finishFirst"); }
    };
    const check = () => { if (document.visibilityState === "visible" && navigator.onLine) void registration?.update().catch(() => {}); };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", controller);
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(reg => {
        if (disposed) return;
        registration = reg;
        if (reg.waiting) setWaiting(reg.waiting);
        reg.onupdatefound = () => {
          const worker = reg.installing;
          if (worker) worker.onstatechange = () => {
            if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(reg.waiting);
          };
        };
        check();
      }).catch(() => { /* Ordinary online learning remains available without a worker. */ });
    }
    document.addEventListener("visibilitychange", check); window.addEventListener("online", check);
    return () => {
      disposed = true; if (registration) registration.onupdatefound = null;
      mode.removeEventListener("change", detect); window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installedEvent); document.removeEventListener("input", changed);
      navigator.serviceWorker?.removeEventListener("controllerchange", controller);
      document.removeEventListener("visibilitychange", check); window.removeEventListener("online", check);
    };
  }, []);
  function dismiss() { setDismissed(true); try { localStorage.setItem(INSTALL_PREFERENCE, "true"); } catch {} }
  async function install() {
    if (!prompt) return;
    try { await prompt.prompt(); const choice = await prompt.userChoice; setPrompt(null); if (choice.outcome === "dismissed") dismiss(); }
    catch { setMessage("pwa.installUnavailable"); setPrompt(null); }
  }
  function update() {
    const busy = !!document.querySelector('[aria-busy="true"], [data-voice-active="true"], dialog[open], form button[disabled], fieldset[disabled]');
    if (!canUpdate(route.current, dirty.current, busy)) { setMessage("pwa.finishFirst"); return; }
    if (waiting) { applying.current = true; waiting.postMessage({ type: "APPLY_UPDATE" }); }
  }
  if (!ready || !["/home", "/settings"].includes(path)) return null;
  const offer = showInstall(path, installed, dismissed);
  return <aside className="pwa-panel" aria-label={t("pwa.about")}>
    {path === "/settings" && <p><strong>{t("pwa.beta")}</strong> · {t("pwa.version", { version: APP_VERSION })}</p>}
    {installed && path === "/settings" && <p>{t("pwa.installed")}</p>}
    {offer && <>
      {prompt ? <button onClick={install}>{t("pwa.install")}</button> : platform === "ios" ? <p>{t("pwa.ios")}</p> : path === "/settings" ? <p>{t("pwa.installUnavailable")}</p> : null}
      {(prompt || platform === "ios") && path === "/home" && <button onClick={dismiss}>{t("pwa.notNow")}</button>}
    </>}
    {waiting && <div role="status"><p>{t("pwa.updateReady")}</p><button onClick={update}>{t("pwa.update")}</button></div>}
    {message && <p role="status">{t(message)}</p>}
  </aside>;
}
