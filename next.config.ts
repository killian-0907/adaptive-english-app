import type { NextConfig } from "next";

const build = process.env.COMMIT_REF || process.env.GITHUB_SHA || "development";
const nextConfig: NextConfig = { allowedDevOrigins: ["127.0.0.1"], env: {
  NEXT_PUBLIC_APP_VERSION: /^[a-f0-9]{40}$/i.test(build) ? build.slice(0, 12) : "development",
} };

export default nextConfig;
