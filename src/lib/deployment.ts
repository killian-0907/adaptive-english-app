type Env = Record<string, string | undefined>;
export function siteOrigin(env: Env = process.env) {
  const value = env.NEXT_PUBLIC_SITE_URL || (env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : "");
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid site origin");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && !env.VERCEL)) throw new Error("HTTPS site origin required");
  if (env.VERCEL && local) throw new Error("Hosted site origin required");
  return url.origin;
}
export function deploymentReady(env: Env = process.env) {
  try {
    siteOrigin(env);
    const db = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return false;
    if (env.VERCEL && (db.protocol !== "https:" || !db.hostname.endsWith(".supabase.co") || !env.CRON_SECRET || env.CRON_SECRET.length < 32)) return false;
    if (env.VERCEL) for (const key of [env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,env.SUPABASE_SERVICE_ROLE_KEY]) {
      if (key.startsWith("eyJ")) { const claims=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()); if (claims.iss === "supabase-demo" || claims.ref === "supabase-ref") return false; }
    }
    return true;
  } catch { return false; }
}
