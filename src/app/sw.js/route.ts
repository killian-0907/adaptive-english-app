import { APP_VERSION } from "@/lib/pwa";
import { workerSource } from "@/lib/pwa-worker";
export const dynamic = "force-static";
export function GET() {
  return new Response(workerSource(APP_VERSION), { headers: {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Service-Worker-Allowed": "/",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'",
  } });
}
