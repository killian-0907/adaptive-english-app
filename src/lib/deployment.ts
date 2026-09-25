type Env = Record<string, string | undefined>;
export function isHosted(env: Env = process.env) {
  return env.NETLIFY === "true" || Boolean(env.VERCEL);
}
export function siteOrigin(env: Env = process.env) {
  const value = env.NEXT_PUBLIC_SITE_URL || (env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : "");
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid site origin");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && !isHosted(env))) throw new Error("HTTPS site origin required");
  if (isHosted(env) && local) throw new Error("Hosted site origin required");
  return url.origin;
}
export function deploymentReady(env: Env = process.env) {
  try {
    siteOrigin(env);
    const db = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
    const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !secret) return false;
    if (isHosted(env) && (db.protocol !== "https:" || !db.hostname.endsWith(".supabase.co") || !env.CRON_SECRET || env.CRON_SECRET.length < 32)) return false;
    if (env.NETLIFY === "true" && (!secret.startsWith("sb_secret_") || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_"))) return false;
    if (isHosted(env)) for (const key of [env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret]) {
      if (key.startsWith("eyJ")) { const claims=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()); if (claims.iss === "supabase-demo" || claims.ref === "supabase-ref") return false; }
    }
    return true;
  } catch { return false; }
}
