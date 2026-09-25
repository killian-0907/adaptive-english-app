import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";

loadEnvFile(".env.local");
if (!process.env.OPENAI_API_KEY) throw new Error("Live verification requires a locally configured OpenAI key.");

export default defineConfig({
  testDir: "./live-tests",
  workers: 1,
  retries: 0,
  timeout: 180000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "off", screenshot: "off", video: "off" },
  webServer: {
    // This suite is explicitly invoked paid verification; ordinary local tests stay free.
    env: { OPENAI_ENHANCED_EVALUATION: "true" },
    command: "corepack pnpm start --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
});
