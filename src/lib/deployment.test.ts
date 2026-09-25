import { afterEach, describe, expect, it, vi } from "vitest";
import { deploymentReady, siteOrigin } from "./deployment";
import { maintainVoice } from "../../scripts/voice-maintenance";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.generated";

const hosted = {
  NETLIFY: "true", NEXT_PUBLIC_SITE_URL: "https://beta.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
  SUPABASE_SECRET_KEY: "sb_secret_test_fixture", CRON_SECRET: "x".repeat(32),
};
afterEach(() => vi.unstubAllEnvs());
describe("Netlify deployment", () => {
  it("accepts newer keys and requires secure hosted origins and cleanup authorization", () => {
    expect(deploymentReady(hosted)).toBe(true);
    expect(deploymentReady({ ...hosted, CRON_SECRET: "" })).toBe(false);
    expect(deploymentReady({ ...hosted, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" })).toBe(false);
    expect(() => siteOrigin({ ...hosted, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toThrow();
    expect(deploymentReady({ ...hosted, SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "legacy-jwt" })).toBe(false);
  });
  it("does not start an interval inside Netlify serverless instances", async () => {
    vi.stubEnv("NETLIFY", "true");
    const timer = vi.spyOn(globalThis, "setInterval");
    const { register } = await import("../instrumentation");
    await register();
    expect(timer).not.toHaveBeenCalled();
    timer.mockRestore();
  });
  it("stops maintenance before issuing requests after its execution budget expires", async () => {
    const db = { from: vi.fn() };
    await expect(maintainVoice(db as unknown as SupabaseClient<Database>, { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });
});
