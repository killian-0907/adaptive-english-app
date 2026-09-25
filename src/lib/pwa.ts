export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "development";
export const INSTALL_PREFERENCE = "adaptive-english.install-dismissed.v1";
export function standalone(displayMode: boolean, iosStandalone?: boolean) { return displayMode || iosStandalone === true; }
export function installPlatform(ua: string, touchPoints = 0) {
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}
export function showInstall(path: string, installed: boolean, dismissed: boolean) {
  return !installed && (path === "/settings" || (path === "/home" && !dismissed));
}
export function canUpdate(path: string, dirty: boolean, busy: boolean) {
  return ["/home", "/settings"].includes(path) && !dirty && !busy;
}
export function disconnected(online: boolean) { return !online; }
