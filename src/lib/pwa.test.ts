import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { canUpdate, disconnected, installPlatform, showInstall, standalone } from "./pwa";
import { workerSource } from "./pwa-worker";
import { betaFeedbackSchema, feedbackRow } from "./validation/beta-feedback";
import { messages } from "./i18n/core";

describe("PWA privacy and lifecycle", () => {
  it("detects standalone and iPad desktop user agents without mislabeling Android", () => {
    expect(standalone(false, true)).toBe(true); expect(standalone(true)).toBe(true); expect(standalone(false)).toBe(false);
    expect(installPlatform("Macintosh Safari", 5)).toBe("ios"); expect(installPlatform("Android Chrome")).toBe("android"); expect(installPlatform("Macintosh Safari", 0)).toBe("desktop");
  });
  it("dismisses home suggestions, retains settings access and never prompts during learning", () => {
    expect(showInstall("/home", false, true)).toBe(false); expect(showInstall("/settings", false, true)).toBe(true);
    for (const path of ["/learn", "/assessment", "/auth/reset"]) expect(showInstall(path, false, false)).toBe(false);
    expect(showInstall("/home", true, false)).toBe(false);
  });
  it("blocks update on dirty forms, active work and learning routes", () => {
    expect(canUpdate("/home", false, false)).toBe(true);
    expect(canUpdate("/settings", true, false)).toBe(false); expect(canUpdate("/settings", false, true)).toBe(false);
    expect(canUpdate("/learn", false, false)).toBe(false); expect(disconnected(false)).toBe(true); expect(disconnected(true)).toBe(false);
  });
  it("bounds feedback and excludes supplied identity, queries, raw UA and arbitrary diagnostics", () => {
    const input = { category: "bug", text: " Example ", route: "/settings" };
    const parsed = betaFeedbackSchema.parse(input);
    expect(betaFeedbackSchema.safeParse({ ...input, userId: "other" }).success).toBe(false);
    expect(betaFeedbackSchema.safeParse({ ...input, route: "/settings?token=secret" }).success).toBe(false);
    expect(betaFeedbackSchema.safeParse({ ...input, text: "x".repeat(1001) }).success).toBe(false);
    const row = feedbackRow(parsed, "secret-invalid", "Chrome/123 private-full-agent");
    expect(row.free_text).toBe("Example"); expect(row.value_text).not.toMatch(/secret|private-full/);
    expect(row.value_text.length).toBeLessThan(200);
  });
  it("provides all new UI messages in three languages", () => {
    for (const [key, value] of Object.entries(messages).filter(([key]) => /^(pwa|feedback)\./.test(key))) {
      for (const lang of ["en", "zh", "es"] as const) expect(value[lang], `${key}:${lang}`).toBeTruthy();
    }
  });
  it("executes worker policy: only generic offline HTML enters cache, never private responses", async () => {
    const listeners: Record<string, (event: Record<string, unknown>) => void> = {};
    const put = vi.fn(), match = vi.fn(async () => new Response("generic offline"));
    const remove = vi.fn(), claim = vi.fn(), skipWaiting = vi.fn();
    const network = vi.fn(async () => new Response("private data"));
    runInNewContext(workerSource("build-two"), { URL, Response, fetch: network,
      caches: { open: async () => ({ put, match }), keys: async () => ["adaptive-english-offline-old", "unrelated-cache", "adaptive-english-offline-build-two"], delete: remove },
      self: { location: { origin: "https://app.test" }, clients: { claim }, skipWaiting, addEventListener: (name: string, fn: typeof listeners[string]) => { listeners[name] = fn; } },
    });
    let pending: Promise<unknown> = Promise.resolve(); const waitUntil = (promise: Promise<unknown>) => { pending = promise; };
    listeners.install({ waitUntil }); await pending; expect(put).toHaveBeenCalledTimes(1); expect(put.mock.calls[0][0]).toBe("/offline.html"); expect(skipWaiting).not.toHaveBeenCalled();
    listeners.activate({ waitUntil }); await pending; expect(remove.mock.calls).toEqual([["adaptive-english-offline-old"]]); expect(claim).toHaveBeenCalled();
    for (const [url, method, mode] of [["https://app.test/api/account", "POST", "cors"], ["https://app.test/api/learning", "GET", "cors"], ["https://database.test/rest/v1/profiles", "GET", "cors"], ["https://app.test/home?_rsc=1", "GET", "cors"]]) {
      const respondWith = vi.fn(); listeners.fetch({ request: { url, method, mode }, respondWith }); expect(respondWith).not.toHaveBeenCalled();
    }
    listeners.fetch({ request: { url: "https://app.test/home", method: "GET", mode: "navigate" }, respondWith: waitUntil }); await pending;
    expect(put).toHaveBeenCalledTimes(1); expect(match).not.toHaveBeenCalled();
    network.mockRejectedValueOnce(new TypeError("offline"));
    listeners.fetch({ request: { url: "https://app.test/home", method: "GET", mode: "navigate" }, respondWith: waitUntil });
    expect(await (await pending as Response).text()).toBe("generic offline"); expect(put).toHaveBeenCalledTimes(1);
    listeners.message({ data: { type: "unrelated" }, waitUntil }); expect(skipWaiting).not.toHaveBeenCalled();
    listeners.message({ data: { type: "APPLY_UPDATE" }, waitUntil }); expect(skipWaiting).toHaveBeenCalledOnce();
    expect(workerSource("build-three")).not.toBe(workerSource("build-two"));
  });
});
