// Deliberately no runtime cache: authenticated HTML, RSC, APIs and voice stay network-only.
// A new build changes the script bytes, prompting the normal waiting-worker lifecycle.
export function workerSource(version: string) {
  return `
const CACHE = "adaptive-english-offline-" + ${JSON.stringify(version)};
const OFFLINE = "/offline.html";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    const response = await fetch(OFFLINE, {cache:"reload", credentials:"omit"});
    if (!response.ok || response.redirected) throw new Error("Offline page unavailable");
    await cache.put(OFFLINE, response);
  }));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("adaptive-english-offline-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "APPLY_UPDATE") event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () => {
    const response = await (await caches.open(CACHE)).match(OFFLINE);
    return response || new Response("Offline", {status:503});
  }));
});
`;
}
